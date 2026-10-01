import { Controller, Delete, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { WishlistsService } from './wishlists.service.js';

@ApiTags('wishlist')
@ApiBearerAuth()
@Controller('wishlist')
export class WishlistsController {
  constructor(private readonly wishlistsService: WishlistsService) {}

  @Get()
  @ApiOperation({ summary: 'Get my wishlist' })
  getWishlist(@CurrentUser('userId') userId: string) {
    return this.wishlistsService.getWishlist(userId);
  }

  @Post(':productId')
  @ApiOperation({ summary: 'Add a product to my wishlist (idempotent)' })
  addItem(
    @CurrentUser('userId') userId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.wishlistsService.addItem(userId, productId);
  }

  @Delete(':productId')
  @ApiOperation({ summary: 'Remove a product from my wishlist (idempotent)' })
  removeItem(
    @CurrentUser('userId') userId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.wishlistsService.removeItem(userId, productId);
  }
}
