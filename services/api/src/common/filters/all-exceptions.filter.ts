import {
  Catch,
  HttpException,
  type ArgumentsHost,
  type ExceptionFilter,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '../../generated/prisma/client.js';
import { redactDeep } from '@correnthian/security';
import { AppError } from '../errors.js';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const { status, code, message, detail } = this.classify(exception);

    if (status >= 500) {
      this.logger.error(
        `${req.method} ${req.url} -> ${status}`,
        redactDeep(exception instanceof Error ? exception.stack : exception),
      );
    }

    res.status(status).json({
      error: { code, message, detail },
      path: req.url,
      timestamp: new Date().toISOString(),
    });
  }

  private classify(exception: unknown): {
    status: number;
    code: string;
    message: string;
    detail?: unknown;
  } {
    if (exception instanceof AppError) {
      return {
        status: exception.status,
        code: exception.code,
        message: exception.message,
        detail: exception.detail,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return {
        status,
        code: status === 404 ? 'not_found' : status === 401 ? 'unauthorized' : 'bad_request',
        message: exception.message,
      };
    }

    // Translate database errors into client-safe codes rather than leaking
    // constraint names and column values.
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return { status: 409, code: 'conflict', message: 'Resource already exists' };
      }
      if (exception.code === 'P2025') {
        return { status: 404, code: 'not_found', message: 'Resource not found' };
      }
      if (exception.code === 'P2003') {
        return {
          status: 422,
          code: 'validation_failed',
          message: 'A referenced record does not exist',
        };
      }
    }

    return {
      status: 500,
      code: 'internal',
      message: 'Internal server error',
    };
  }
}
