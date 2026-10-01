import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsUUID, Min } from 'class-validator';

export class AddCartItemDto {
  @ApiProperty({ description: 'Product id' })
  @IsUUID()
  productId: string;

  @ApiPropertyOptional({ description: 'Product variant id (for variant products)' })
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @ApiProperty({ minimum: 1, default: 1, example: 2 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  quantity: number;
}

export class UpdateCartItemDto {
  @ApiProperty({ minimum: 1, example: 3 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;
}
