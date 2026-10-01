import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { QueryBoolean } from '../../../common/utils/query.util.js';

export class CategoriesQueryDto {
  @ApiPropertyOptional({ description: 'Include inactive categories (admin tooling)' })
  @IsOptional()
  @QueryBoolean()
  @IsBoolean()
  includeInactive?: boolean;
}
