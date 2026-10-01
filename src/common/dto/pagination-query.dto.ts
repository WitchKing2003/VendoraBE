import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** Standard `?page=&limit=` query parameters. */
export class PaginationQueryDto {
  @ApiProperty({ default: 1, minimum: 1, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiProperty({ default: 10, minimum: 1, maximum: 100, example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 10;
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

/** Shared `?search=` parameter. */
export class SearchQueryDto {
  @ApiProperty({ required: false, description: 'Free-text search term' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
