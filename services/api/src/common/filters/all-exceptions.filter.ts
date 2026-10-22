import {
  Catch, HttpException, NotFoundException,
  type ArgumentsHost,
  type ExceptionFilter,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '../../generated/prisma/client.js';
import { redactDeep } from '@correnthian/security';
import { versionNotFoundDetail } from '../../versioning/api-version.middleware.js';
import { AppError, errorEnvelope } from '../errors.js';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const { status, code, message, detail } = this.classify(exception);

    // A maintenance window answers every request with a 503, and logging each
    // one as an error with a stack would bury the real errors in the exact
    // window an operator most needs to read. The refusal is not a fault.
    if (status >= 500 && code !== 'maintenance') {
      this.logger.error(
        `${req.method} ${req.originalUrl} -> ${status}`,
        redactDeep(exception instanceof Error ? exception.stack : exception),
      );
    }

    // `originalUrl`, not `url`: the version middleware rewrites `url` when it
    // serves the transitional unversioned alias, and the path echoed back to
    // a client — and written to an audit line — should be what they actually
    // asked for.
    res.status(status).json(errorEnvelope({ code, message, detail, path: req.originalUrl }));
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

      // Only the router's own not-found. A service that raises
      // `AppError.notFound('Asset not found')` is reporting a missing
      // resource, and attaching "here are the API versions" to that would be
      // noise on the one 404 a caller can actually act on.
      if (exception instanceof NotFoundException) {
        return {
          status,
          code: 'not_found',
          message: exception.message,
          detail: versionNotFoundDetail(),
        };
      }

      return {
        status,
        code: status === 401 ? 'unauthorized' : 'bad_request',
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