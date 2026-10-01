import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { type Observable, map } from 'rxjs';

export interface ApiEnvelope<T = unknown> {
  success: boolean;
  data: T;
  message: string;
}

/**
 * Wraps every successful response into `{ success, data, message }` and
 * serializes Prisma `Decimal` values into plain numbers so a TS/React
 * client gets natural JSON types.
 */
@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<ApiEnvelope> {
    return next.handle().pipe(map((payload) => this.toEnvelope(payload)));
  }

  private toEnvelope(payload: unknown): ApiEnvelope {
    if (payload && typeof payload === 'object') {
      const record = payload as Partial<ApiEnvelope> & Record<string, unknown>;

      if ('success' in record && 'data' in record && 'message' in record) {
        return {
          success: record.success as boolean,
          data: this.serialize(record.data),
          message: record.message as string,
        };
      }

      // Handlers may return `{ data, message }` to customize the message.
      if ('data' in record && 'message' in record && typeof record.message === 'string') {
        return { success: true, data: this.serialize(record.data), message: record.message };
      }
    }

    return { success: true, data: this.serialize(payload), message: 'Success' };
  }

  private serialize(value: unknown): unknown {
    if (value === null || value === undefined) return value;
    if (value instanceof Prisma.Decimal) return value.toNumber();
    if (value instanceof Date) return value;
    if (Array.isArray(value)) return value.map((item) => this.serialize(item));

    if (typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
        out[key] = this.serialize(item);
      }
      return out;
    }

    return value;
  }
}
