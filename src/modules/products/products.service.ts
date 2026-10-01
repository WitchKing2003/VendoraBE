import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProductStatus, Role, type Prisma } from '@prisma/client';
import type { AuthUser } from '../../common/decorators/current-user.decorator.js';
import { SortOrder } from '../../common/dto/pagination-query.dto.js';
import { uniqueSlug } from '../../common/utils/slug.util.js';
import { type PaginatedResult, paginate } from '../../common/utils/pagination.util.js';
import { isUuid } from '../../common/utils/uuid.util.js';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import type { CreateProductDto } from './dto/create-product.dto.js';
import { ProductSortField, type QueryProductsDto } from './dto/query-products.dto.js';
import type { UpdateProductDto } from './dto/update-product.dto.js';

const productInclude = {
  category: true,
  brand: true,
  images: { orderBy: { position: 'asc' as const } },
  variants: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.ProductInclude;

export type ProductWithRelations = Prisma.ProductGetPayload<{
  include: typeof productInclude;
}>;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: QueryProductsDto,
    viewer?: AuthUser,
  ): Promise<PaginatedResult<ProductWithRelations>> {
    const isAdmin = viewer?.role === Role.ADMIN || viewer?.role === Role.STAFF;
    const where: Prisma.ProductWhereInput = {
      status: isAdmin && query.status ? query.status : ProductStatus.ACTIVE,
    };

    if (query.category) {
      const category = await this.prisma.category.findFirst({
        where: this.byIdOrSlug(query.category),
        select: { id: true },
      });
      if (!category) return paginate([], 0, query.page, query.limit);
      where.categoryId = category.id;
    }

    if (query.brand) {
      const brand = await this.prisma.brand.findFirst({
        where: this.byIdOrSlug(query.brand),
        select: { id: true },
      });
      if (!brand) return paginate([], 0, query.page, query.limit);
      where.brandId = brand.id;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { sku: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.price = {
        ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
        ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
      };
    }

    if (query.featured !== undefined) {
      where.featured = query.featured;
    }

    if (query.inStock) {
      where.AND = [{ OR: [{ stock: { gt: 0 } }, { variants: { some: { stock: { gt: 0 } } } }] }];
    }

    const skip = (query.page - 1) * query.limit;

    const [total, items] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy: this.buildOrderBy(query.sort, query.order),
        skip,
        take: query.limit,
        include: productInclude,
      }),
    ]);

    return paginate(items, total, query.page, query.limit);
  }

  async findOne(idOrSlug: string, viewer?: AuthUser): Promise<ProductWithRelations> {
    const product = await this.prisma.product.findFirst({
      where: this.byIdOrSlug(idOrSlug),
      include: productInclude,
    });

    const isAdmin = viewer?.role === Role.ADMIN || viewer?.role === Role.STAFF;
    if (!product || (product.status !== ProductStatus.ACTIVE && !isAdmin)) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async create(dto: CreateProductDto): Promise<ProductWithRelations> {
    await this.assertCategoryExists(dto.categoryId);
    if (dto.brandId) await this.assertBrandExists(dto.brandId);
    if (dto.sku) await this.assertSkuFree(dto.sku);

    const slug = dto.slug
      ? await this.claimSlug(dto.slug)
      : await uniqueSlug(dto.name, (candidate) => this.slugTaken(candidate));

    const images = [...(dto.images ?? [])]
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((image, index) => ({
        url: image.url,
        alt: image.alt,
        position: image.position ?? index,
      }));

    const variants = (dto.variants ?? []).map((variant) => ({
      name: variant.name,
      sku: variant.sku,
      options: variant.options === undefined ? undefined : (variant.options as Prisma.InputJsonValue),
      price: variant.price,
      stock: variant.stock ?? 0,
    }));

    return this.prisma.product.create({
      data: {
        name: dto.name.trim(),
        slug,
        description: dto.description,
        price: dto.price,
        compareAtPrice: dto.compareAtPrice,
        sku: dto.sku,
        stock: dto.stock ?? 0,
        status: dto.status ?? ProductStatus.DRAFT,
        featured: dto.featured ?? false,
        categoryId: dto.categoryId,
        brandId: dto.brandId,
        ...(images.length > 0 ? { images: { create: images } } : {}),
        ...(variants.length > 0 ? { variants: { create: variants } } : {}),
      },
      include: productInclude,
    });
  }

  async update(id: string, dto: UpdateProductDto): Promise<ProductWithRelations> {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (dto.slug !== undefined && dto.slug !== product.slug) {
      await this.claimSlug(dto.slug);
    }
    if (dto.sku !== undefined && dto.sku !== product.sku) {
      await this.assertSkuFree(dto.sku);
    }
    if (dto.categoryId) await this.assertCategoryExists(dto.categoryId);
    if (dto.brandId) await this.assertBrandExists(dto.brandId);

    const replaceImages = dto.images !== undefined;
    const replaceVariants = dto.variants !== undefined;

    const images = replaceImages
      ? [...dto.images!]
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
          .map((image, index) => ({
            url: image.url,
            alt: image.alt,
            position: image.position ?? index,
          }))
      : [];

    const variants = replaceVariants
      ? dto.variants!.map((variant) => ({
          name: variant.name,
          sku: variant.sku,
          options: variant.options === undefined ? undefined : (variant.options as Prisma.InputJsonValue),
          price: variant.price,
          stock: variant.stock ?? 0,
        }))
      : [];

    return this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.slug !== undefined && dto.slug !== product.slug ? { slug: dto.slug } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.price !== undefined ? { price: dto.price } : {}),
          ...(dto.compareAtPrice !== undefined ? { compareAtPrice: dto.compareAtPrice } : {}),
          ...(dto.sku !== undefined && dto.sku !== product.sku ? { sku: dto.sku } : {}),
          ...(dto.stock !== undefined ? { stock: dto.stock } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.featured !== undefined ? { featured: dto.featured } : {}),
          ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
          ...(dto.brandId !== undefined ? { brandId: dto.brandId } : {}),
        },
      });

      if (replaceImages) {
        await tx.productImage.deleteMany({ where: { productId: id } });
        if (images.length > 0) {
          await tx.productImage.createMany({
            data: images.map((image) => ({ ...image, productId: id })),
          });
        }
      }

      if (replaceVariants) {
        await tx.productVariant.deleteMany({ where: { productId: id } });
        if (variants.length > 0) {
          await tx.productVariant.createMany({
            data: variants.map((variant) => ({ ...variant, productId: id })),
          });
        }
      }

      return (await tx.product.findUnique({
        where: { id },
        include: productInclude,
      }))!;
    });
  }

  async remove(id: string): Promise<{ data: null; message: string }> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { _count: { select: { orderItems: true } } },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product._count.orderItems > 0) {
      throw new ConflictException(
        'Product has order history and cannot be deleted; set its status to ARCHIVED instead',
      );
    }

    await this.prisma.product.delete({ where: { id } });
    return { data: null, message: 'Product deleted' };
  }

  private buildOrderBy(
    sort?: ProductSortField,
    order?: SortOrder,
  ): Prisma.ProductOrderByWithRelationInput {
    const direction = order === SortOrder.ASC ? 'asc' : 'desc';
    switch (sort) {
      case ProductSortField.NAME:
        return { name: direction };
      case ProductSortField.PRICE:
        return { price: direction };
      case ProductSortField.RATING:
        return { ratingAverage: direction };
      default:
        return { createdAt: direction };
    }
  }

  private byIdOrSlug(value: string): Prisma.ProductWhereInput | { slug: string } {
    return isUuid(value) ? { OR: [{ id: value }, { slug: value }] } : { slug: value };
  }

  private async assertCategoryExists(categoryId: string): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
  }

  private async assertBrandExists(brandId: string): Promise<void> {
    const brand = await this.prisma.brand.findUnique({
      where: { id: brandId },
      select: { id: true },
    });
    if (!brand) {
      throw new NotFoundException('Brand not found');
    }
  }

  private async assertSkuFree(sku: string): Promise<void> {
    const [product, variant] = await Promise.all([
      this.prisma.product.findFirst({ where: { sku }, select: { id: true } }),
      this.prisma.productVariant.findFirst({ where: { sku }, select: { id: true } }),
    ]);
    if (product || variant) {
      throw new ConflictException(`SKU "${sku}" is already in use`);
    }
  }

  private async claimSlug(slug: string): Promise<string> {
    if (await this.slugTaken(slug)) {
      throw new ConflictException(`Slug "${slug}" is already in use`);
    }
    return slug;
  }

  private async slugTaken(slug: string): Promise<boolean> {
    const existing = await this.prisma.product.findUnique({
      where: { slug },
      select: { id: true },
    });
    return existing !== null;
  }
}
