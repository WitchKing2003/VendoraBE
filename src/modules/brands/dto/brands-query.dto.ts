import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { QueryBoolean } from '../../../common/utils/query.util.js';

export class BrandsQueryDto {
  @ApiPropertyOptional({ description: 'Search by brand name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ description: 'Include inactive brands (admin tooling)' })
  @IsOptional()
  @QueryBoolean()
  @IsBoolean()
  includeInactive?: boolean;
}
