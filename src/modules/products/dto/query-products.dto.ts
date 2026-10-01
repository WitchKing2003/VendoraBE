import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProductStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { PaginationQueryDto, SortOrder } from '../../../common/dto/pagination-query.dto.js';
import { QueryBoolean } from '../../../common/utils/query.util.js';

export enum ProductSortField {
  NAME = 'name',
  PRICE = 'price',
  NEWEST = 'createdAt',
  RATING = 'rating',
}

export class QueryProductsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Free-text search over name/description/SKU' })
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Category id or slug' })
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ description: 'Brand id or slug' })
  @IsOptional()
  brand?: string;

  @ApiPropertyOptional({ minimum: 0, example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ minimum: 0, example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ enum: ProductStatus, description: 'Admin/staff only; ignored for anonymous users' })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional({ enum: ProductSortField, default: ProductSortField.NEWEST })
  @IsOptional()
  @IsEnum(ProductSortField)
  sort?: ProductSortField;

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.DESC })
  @IsOptional()
  @IsEnum(SortOrder)
  order?: SortOrder;

  @ApiPropertyOptional({ description: 'Only featured products (?featured=true)' })
  @IsOptional()
  @QueryBoolean()
  @IsBoolean()
  featured?: boolean;

  @ApiPropertyOptional({ description: 'Only products with stock (?inStock=true)' })
  @IsOptional()
  @QueryBoolean()
  @IsBoolean()
  inStock?: boolean;
}
