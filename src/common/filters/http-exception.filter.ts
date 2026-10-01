import {
  ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

interface ErrorBody {
  success: false;
  data: null;
  statusCode: number;
  message: string;
  errors?: unknown;
}

/**
 * Converts every thrown exception into the consistent API error shape:
 * `{ success: false, data: null, statusCode, message, errors? }`.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message = 'Internal server error';
    let errors: unknown;

    if (exception instanceof HttpException) {
      const body = exception.getResponse();

      if (typeof body === 'string') {
        message = body;
      } else if (Array.isArray(body)) {
        message = 'Validation failed';
        errors = body;
      } else if (typeof body === 'object' && body !== null) {
        const payload = body as { message?: string | string[]; errors?: unknown };
        message = Array.isArray(payload.message)
          ? payload.message.join(', ')
          : (payload.message ?? exception.message);
        errors = payload.errors;
      }

      if (statusCode >= 500) {
        this.logger.error(`HTTP ${statusCode}: ${message}`, exception.stack);
      }
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
    }

    const body: ErrorBody = {
      success: false,
      data: null,
      statusCode,
      message,
      ...(errors !== undefined ? { errors } : {}),
    };

    response.status(statusCode).json(body);
  }
}
