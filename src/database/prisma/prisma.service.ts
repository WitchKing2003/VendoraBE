import {
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Connected to PostgreSQL');
    } catch (error) {
      // Allow the API to boot (Swagger, health checks) even without a DB.
      this.logger.warn(
        `Could not connect to PostgreSQL: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.$disconnect();
  }
}
