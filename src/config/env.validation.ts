import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

class EnvVariables {
  @IsString()
  @IsIn(['development', 'production', 'test'], {
    message: 'NODE_ENV must be one of: development, production, test',
  })
  NODE_ENV!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT?: number;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_EXPIRES_IN!: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_EXPIRES_IN!: string;

  @IsOptional()
  @IsString()
  CORS_ORIGIN?: string;
}

/**
 * Validates process.env at boot so the app fails fast with a clear message
 * instead of crashing later on a missing secret.
 */
export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const env = plainToInstance(EnvVariables, config);
  const errors = validateSync(env, { skipMissingProperties: false });

  if (errors.length > 0) {
    const details = errors
      .map((error) => `${error.property}: ${Object.values(error.constraints ?? {}).join(', ')}`)
      .join('\n  ');
    throw new Error(`Invalid environment variables:\n  ${details}`);
  }

  return config;
}
