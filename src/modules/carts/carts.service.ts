import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProductStatus, type Prisma } from '@prisma/client';
import { toAmount } from '../../common/utils/math.util.js';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import type { AddCartItemDto, UpdateCartItemDto } from './dto/cart-item.dto.js';

const cartProductSelect = {
  id: true,
  name: true,
  slug: true,
  price: true,
  stock: true,
  status: true,
  images: { take: 1, orderBy: { position: 'asc' as const }, select: { url: true } },
} satisfies Prisma.ProductSelect;

type CartItemWithRelations = Prisma.CartItemGetPayload<{
  include: { product: { select: typeof cartProductSelect }; variant: true };
}>;

export interface CartItemView {
  id: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  available: boolean;
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    stock: number;
    status: ProductStatus;
    image?: string;
  };
  variant: { id: string; name: string; price: number | null; stock: number; options: Prisma.JsonValue } | null;
}

export interface CartView {
  id: string;
  items: CartItemView[];
  itemCount: number;
  subtotal: number;
}

@Injectable()
export class CartsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCart(userId: string): Promise<CartView> {
    const cart = await this.getOrCreateCart(userId);

    const items = await this.prisma.cartItem.findMany({
      where: { cartId: cart.id },
      include: { product: { select: cartProductSelect }, variant: true },
      orderBy: { createdAt: 'asc' },
    });

    return this.buildCartView(cart.id, items);
  }

  async addItem(userId: string, dto: AddCartItemDto): Promise<CartView> {
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    if (product.status !== ProductStatus.ACTIVE) {
      throw new BadRequestException('This product is not available for purchase');
    }

    let variant: { id: string; productId: string; stock: number } | null = null;
    if (dto.variantId) {
      const found = await this.prisma.productVariant.findUnique({
        where: { id: dto.variantId },
      });
      if (!found || found.productId !== product.id) {
        throw new BadRequestException('Variant does not belong to this product');
      }
      variant = found;
    }

    const availableStock = variant ? variant.stock : product.stock;
    const cart = await this.getOrCreateCart(userId);

    const existing = await this.prisma.cartItem.findFirst({
      where: { cartId: cart.id, productId: dto.productId, variantId: dto.variantId ?? null },
    });

    const requested = (existing?.quantity ?? 0) + dto.quantity;
    if (requested > availableStock) {
      throw new ConflictException(
        availableStock === 0
          ? 'This product is out of stock'
          : `Only ${availableStock} unit(s) left in stock`,
      );
    }

    if (existing) {
      await this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: requested },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: dto.productId,
          variantId: dto.variantId,
          quantity: dto.quantity,
        },
      });
    }

    return this.getCart(userId);
  }

  async updateItem(userId: string, itemId: string, dto: UpdateCartItemDto): Promise<CartView> {
    const item = await this.findOwnItem(userId, itemId);

    if (item.product.status !== ProductStatus.ACTIVE) {
      throw new BadRequestException('This product is no longer available');
    }

    const availableStock = item.variant ? item.variant.stock : item.product.stock;
    if (dto.quantity > availableStock) {
      throw new ConflictException(
        availableStock === 0
          ? 'This product is out of stock'
          : `Only ${availableStock} unit(s) left in stock`,
      );
    }

    await this.prisma.cartItem.update({
      where: { id: item.id },
      data: { quantity: dto.quantity },
    });

    return this.getCart(userId);
  }

  async removeItem(userId: string, itemId: string): Promise<CartView> {
    const item = await this.findOwnItem(userId, itemId);
    await this.prisma.cartItem.delete({ where: { id: item.id } });
    return this.getCart(userId);
  }

  async clearCart(userId: string): Promise<CartView> {
    const cart = await this.getOrCreateCart(userId);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return this.getCart(userId);
  }

  private async getOrCreateCart(userId: string) {
    return this.prisma.cart.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  private async findOwnItem(userId: string, itemId: string) {
    const cart = await this.getOrCreateCart(userId);

    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cartId: cart.id },
      include: { product: { select: cartProductSelect }, variant: true },
    });

    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    return item;
  }

  private buildCartView(cartId: string, items: CartItemWithRelations[]): CartView {
    const views: CartItemView[] = items.map((item) => {
      const unitPrice = item.variant?.price != null ? toAmount(item.variant.price) : toAmount(item.product.price);
      const stock = item.variant ? item.variant.stock : item.product.stock;

      return {
        id: item.id,
        quantity: item.quantity,
        unitPrice,
        lineTotal: Math.round(unitPrice * item.quantity * 100) / 100,
        available: item.product.status === ProductStatus.ACTIVE && stock >= item.quantity,
        product: {
          id: item.product.id,
          name: item.product.name,
          slug: item.product.slug,
          price: toAmount(item.product.price),
          stock: item.product.stock,
          status: item.product.status,
          image: item.product.images[0]?.url,
        },
        variant: item.variant
          ? {
              id: item.variant.id,
              name: item.variant.name,
              price: item.variant.price != null ? toAmount(item.variant.price) : null,
              stock: item.variant.stock,
              options: item.variant.options,
            }
          : null,
      };
    });

    return {
      id: cartId,
      items: views,
      itemCount: views.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: Math.round(views.reduce((sum, item) => sum + item.lineTotal, 0) * 100) / 100,
    };
  }
}
