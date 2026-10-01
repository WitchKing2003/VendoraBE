import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUrl, MaxLength, Min } from 'class-validator';

export class CreateProductImageDto {
  @ApiProperty({ format: 'uri', example: 'https://cdn.shop.com/products/shoe-1.jpg' })
  @IsUrl({ require_protocol: true })
  url: string;

  @ApiPropertyOptional({ example: 'Red running shoe' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  alt?: string;

  @ApiPropertyOptional({ default: 0, description: 'Display order (0 = first)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;
}
