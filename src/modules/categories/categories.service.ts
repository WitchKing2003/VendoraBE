import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Category, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { slugify, uniqueSlug } from '../../common/utils/slug.util.js';
import { isUuid } from '../../common/utils/uuid.util.js';
import type { CreateCategoryDto } from './dto/create-category.dto.js';
import type { UpdateCategoryDto } from './dto/update-category.dto.js';

export type CategoryNode = Category & { children: CategoryNode[] };

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns the category tree (roots with nested children). */
  async findAll(includeInactive = false): Promise<CategoryNode[]> {
    const categories = await this.prisma.category.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { name: 'asc' },
    });

    return this.buildTree(categories);
  }

  async findOne(idOrSlug: string): Promise<Category & { children: Category[] }> {
    const category = await this.prisma.category.findFirst({
      where: this.byIdOrSlug(idOrSlug),
      include: { children: { orderBy: { name: 'asc' } } },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async create(dto: CreateCategoryDto): Promise<Category> {
    if (dto.parentId) {
      const parent = await this.prisma.category.findUnique({ where: { id: dto.parentId } });
      if (!parent) {
        throw new NotFoundException('Parent category not found');
      }
    }

    const slug = dto.slug
      ? await this.claimSlug(dto.slug)
      : await uniqueSlug(dto.name, (candidate) => this.slugTaken(candidate));

    return this.prisma.category.create({
      data: {
        name: dto.name.trim(),
        slug,
        description: dto.description,
        imageUrl: dto.imageUrl,
        parentId: dto.parentId,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    if (dto.slug !== undefined && dto.slug !== category.slug) {
      await this.claimSlug(dto.slug);
    }

    if (dto.parentId) {
      if (dto.parentId === id) {
        throw new BadRequestException('A category cannot be its own parent');
      }

      const parent = await this.prisma.category.findUnique({ where: { id: dto.parentId } });
      if (!parent) {
        throw new NotFoundException('Parent category not found');
      }

      if (await this.isDescendant(dto.parentId, id)) {
        throw new BadRequestException('Cannot move a category under one of its own children');
      }
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.slug !== undefined && dto.slug !== category.slug ? { slug: dto.slug } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
        ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async remove(id: string): Promise<{ data: null; message: string }> {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { children: true, products: true } } },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    if (category._count.children > 0) {
      throw new ConflictException('Cannot delete a category that has subcategories');
    }

    if (category._count.products > 0) {
      throw new ConflictException('Cannot delete a category that contains products');
    }

    await this.prisma.category.delete({ where: { id } });
    return { data: null, message: 'Category deleted' };
  }

  private buildTree(categories: Category[]): CategoryNode[] {
    const nodes = new Map<string, CategoryNode>();
    for (const category of categories) {
      nodes.set(category.id, { ...category, children: [] });
    }

    const roots: CategoryNode[] = [];
    for (const category of categories) {
      const node = nodes.get(category.id)!;
      const parent = category.parentId ? nodes.get(category.parentId) : undefined;
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  /** Walks up from `candidateParentId` to detect a cycle around `categoryId`. */
  private async isDescendant(candidateParentId: string, categoryId: string): Promise<boolean> {
    let cursor: string | null = candidateParentId;
    for (let depth = 0; cursor && depth < 50; depth += 1) {
      if (cursor === categoryId) return true;
      const node: Pick<Category, 'parentId'> | null = await this.prisma.category.findUnique({
        where: { id: cursor },
        select: { parentId: true },
      });
      cursor = node?.parentId ?? null;
    }
    return false;
  }

  private byIdOrSlug(value: string): Prisma.CategoryWhereInput {
    return isUuid(value) ? { OR: [{ id: value }, { slug: value }] } : { slug: value };
  }

  private async claimSlug(slug: string): Promise<string> {
    if (await this.slugTaken(slug)) {
      throw new ConflictException(`Slug "${slug}" is already in use`);
    }
    return slug;
  }

  private async slugTaken(slug: string): Promise<boolean> {
    const existing = await this.prisma.category.findUnique({
      where: { slug },
      select: { id: true },
    });
    return existing !== null;
  }
}
