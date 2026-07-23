import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { captureException } from '../sentry';

/**
 * Filtro global de excepciones. Normaliza la respuesta de error y
 * propaga el request-id para trazabilidad.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Error interno del servidor';

    const requestId = (request.headers['x-request-id'] as string) ?? null;

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${status}: ${
          (exception as Error)?.message ?? 'unknown'
        }`,
        (exception as Error)?.stack,
      );
      // Telemetría opcional a Sentry (no-op si SENTRY_DSN no está configurada).
      captureException(exception, {
        method: request.method,
        url: request.url,
        requestId,
      });
    }

    response.status(status).json({
      statusCode: status,
      path: request.url,
      requestId,
      timestamp: new Date().toISOString(),
      message:
        typeof message === 'string'
          ? message
          : (message as Record<string, unknown>).message ?? message,
    });
  }
}
