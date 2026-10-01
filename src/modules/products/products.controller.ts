import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { QueryProductsDto } from './dto/query-products.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ProductsService } from './products.service.js';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'List products with pagination, search, filters and sorting',
    description:
      'Supports `search`, `category`, `brand`, `minPrice`, `maxPrice`, `sort`, `order`, `featured`, `inStock` and `status` (admin/staff only).',
  })
  findAll(@Query() query: QueryProductsDto, @CurrentUser() viewer?: AuthUser) {
    return this.productsService.findAll(query, viewer);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a product by id or slug' })
  findOne(@Param('id') idOrSlug: string, @CurrentUser() viewer?: AuthUser) {
    return this.productsService.findOne(idOrSlug, viewer);
  }

  @Post()
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a product with images and variants (admin/staff)' })
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a product; passing images/variants replaces them (admin/staff)' })
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a product (admin; blocked when order history exists)' })
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
