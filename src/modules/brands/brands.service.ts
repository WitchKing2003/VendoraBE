import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Brand, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { uniqueSlug } from '../../common/utils/slug.util.js';
import { isUuid } from '../../common/utils/uuid.util.js';
import type { CreateBrandDto } from './dto/create-brand.dto.js';
import type { UpdateBrandDto } from './dto/update-brand.dto.js';
import type { BrandsQueryDto } from './dto/brands-query.dto.js';

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: BrandsQueryDto): Promise<Brand[]> {
    return this.prisma.brand.findMany({
      where: {
        ...(query.includeInactive ? {} : { isActive: true }),
        ...(query.search
          ? { name: { contains: query.search, mode: 'insensitive' } }
          : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(idOrSlug: string): Promise<Brand & { products?: unknown[] }> {
    const brand = await this.prisma.brand.findFirst({
      where: this.byIdOrSlug(idOrSlug),
      include: {
        products: {
          where: { status: 'ACTIVE' },
          select: { id: true, name: true, slug: true, price: true, stock: true, status: true },
          orderBy: { createdAt: 'desc' },
          take: 12,
        },
      },
    });

    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    return brand;
  }

  async create(dto: CreateBrandDto): Promise<Brand> {
    const slug = dto.slug
      ? await this.claimSlug(dto.slug)
      : await uniqueSlug(dto.name, (candidate) => this.slugTaken(candidate));

    return this.prisma.brand.create({
      data: {
        name: dto.name.trim(),
        slug,
        description: dto.description,
        logoUrl: dto.logoUrl,
        websiteUrl: dto.websiteUrl,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateBrandDto): Promise<Brand> {
    const brand = await this.prisma.brand.findUnique({ where: { id } });
    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    let slug: string | undefined;
    if (dto.slug !== undefined && dto.slug !== brand.slug) {
      slug = await this.claimSlug(dto.slug);
    }

    return this.prisma.brand.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(slug !== undefined ? { slug } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.logoUrl !== undefined ? { logoUrl: dto.logoUrl } : {}),
        ...(dto.websiteUrl !== undefined ? { websiteUrl: dto.websiteUrl } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async remove(id: string): Promise<{ data: null; message: string }> {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });

    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    if (brand._count.products > 0) {
      throw new ConflictException(
        `Cannot delete a brand that has ${brand._count.products} product(s); remove or reassign them first`,
      );
    }

    await this.prisma.brand.delete({ where: { id } });
    return { data: null, message: 'Brand deleted' };
  }

  private byIdOrSlug(value: string): Prisma.BrandWhereInput {
    return isUuid(value) ? { OR: [{ id: value }, { slug: value }] } : { slug: value };
  }

  private async claimSlug(slug: string): Promise<string> {
    if (await this.slugTaken(slug)) {
      throw new ConflictException(`Slug "${slug}" is already in use`);
    }
    return slug;
  }

  private async slugTaken(slug: string): Promise<boolean> {
    const existing = await this.prisma.brand.findUnique({
      where: { slug },
      select: { id: true },
    });
    return existing !== null;
  }
}
