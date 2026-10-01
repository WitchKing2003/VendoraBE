import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { CartsService } from './carts.service.js';
import { AddCartItemDto, UpdateCartItemDto } from './dto/cart-item.dto.js';

@ApiTags('cart')
@ApiBearerAuth()
@Controller('cart')
export class CartsController {
  constructor(private readonly cartsService: CartsService) {}

  @Get()
  @ApiOperation({ summary: 'Get my cart with computed totals' })
  getCart(@CurrentUser('userId') userId: string) {
    return this.cartsService.getCart(userId);
  }

  @Post('items')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a product/variant to my cart (validates status + stock)' })
  addItem(
    @CurrentUser('userId') userId: string,
    @Body() dto: AddCartItemDto,
  ) {
    return this.cartsService.addItem(userId, dto);
  }

  @Patch('items/:id')
  @ApiOperation({ summary: 'Change a cart item quantity (re-validates stock)' })
  updateItem(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartsService.updateItem(userId, id, dto);
  }

  @Delete('items/:id')
  @ApiOperation({ summary: 'Remove an item from my cart' })
  removeItem(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.cartsService.removeItem(userId, id);
  }

  @Delete()
  @ApiOperation({ summary: 'Clear my cart' })
  clearCart(@CurrentUser('userId') userId: string) {
    return this.cartsService.clearCart(userId);
  }
}
