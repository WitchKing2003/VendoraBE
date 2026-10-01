import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service.js';

const wishlistProductInclude = {
  images: { take: 1, orderBy: { position: 'asc' as const }, select: { url: true } },
} satisfies Prisma.ProductInclude;

type WishlistItemWithProduct = Prisma.WishlistItemGetPayload<{
  include: { product: { include: typeof wishlistProductInclude } };
}>;

export interface WishlistView {
  id: string;
  count: number;
  items: WishlistItemWithProduct[];
}

@Injectable()
export class WishlistsService {
  constructor(private readonly prisma: PrismaService) {}

  async getWishlist(userId: string): Promise<WishlistView> {
    const wishlist = await this.getOrCreate(userId);

    const items = await this.prisma.wishlistItem.findMany({
      where: { wishlistId: wishlist.id },
      include: { product: { include: wishlistProductInclude } },
      orderBy: { createdAt: 'desc' },
    });

    return { id: wishlist.id, count: items.length, items };
  }

  async addItem(userId: string, productId: string): Promise<WishlistView> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const wishlist = await this.getOrCreate(userId);

    const existing = await this.prisma.wishlistItem.findUnique({
      where: { wishlistId_productId: { wishlistId: wishlist.id, productId } },
    });

    if (!existing) {
      await this.prisma.wishlistItem.create({
        data: { wishlistId: wishlist.id, productId },
      });
    }

    return this.getWishlist(userId);
  }

  async removeItem(userId: string, productId: string): Promise<WishlistView> {
    const wishlist = await this.getOrCreate(userId);

    await this.prisma.wishlistItem.deleteMany({
      where: { wishlistId: wishlist.id, productId },
    });

    return this.getWishlist(userId);
  }

  private async getOrCreate(userId: string) {
    return this.prisma.wishlist.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }
}
