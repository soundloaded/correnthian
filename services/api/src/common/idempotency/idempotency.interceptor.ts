import {
  CallHandler, ExecutionContext, HttpStatus, Inject, Injectable, Logger,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { redactDeep } from '@correnthian/security';
import type { Request, Response } from 'express';
import { Observable, from, lastValueFrom } from 'rxjs';
import { AppError } from '../errors.js';
import { IDEMPOTENCY_METADATA_KEY, type IdempotencyOptions } from './idempotency.decorator.js';
import {
  IDEMPOTENCY_KEY_HEADER, keyFingerprint, keyHash, normaliseKey, requestFingerprint,
} from './idempotency-key.js';
import { IdempotencyStore } from './idempotency.store.js';

/**
 * Make a route idempotent under an `Idempotency-Key`.
 *
 * The shape of the bug this exists for: the user taps Buy, the network is
 * slow, the tap registers as two presses. Without this, two purchases. With
 * it, one purchase and two identical answers.
 *
 * The order is the whole design:
 *
 *   claim -> run the handler -> store status and body
 *
 * The claim comes first and is the only part that is a database
 * compare-and-swap, so it is what actually prevents a second execution — and
 * it happens on *every* request, including one that arrives while the first is
 * still running. That is the case an in-process lock cannot cover, because the
 * second request may be on a different replica.
 */

/** Set on a replay, so a client (and a test) can tell it from a fresh execution. */
export const REPLAYED_HEADER = 'idempotency-replayed';

interface RequestWithActor extends Request {
  user?: { id?: string };
}

interface HandlerTarget {
  handler: (...args: never[]) => unknown;
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(
    @Inject(IdempotencyStore) private readonly store: IdempotencyStore,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const options = this.reflector.getAllAndOverride<IdempotencyOptions>(
      IDEMPOTENCY_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!options) return next.handle();

    const req = context.switchToHttp().getRequest<RequestWithActor>();
    const res = context.switchToHttp().getResponse<Response>();

    let key: string;
    try {
      const supplied = normaliseKey(req.headers[IDEMPOTENCY_KEY_HEADER]);
      if (!supplied) {
        return options.required
          ? from(Promise.reject(this.missingKey()))
          : next.handle();
      }
      key = supplied;
    } catch (error) {
      // `normaliseKey` has already decided not to echo the offending value.
      return from(Promise.reject(error));
    }

    return from(this.run({
      req,
      res,
      key,
      options,
      next,
      status: resolveStatus(context),
    }));
  }

  private async run(args: {
    req: RequestWithActor;
    res: Response;
    key: string;
    options: IdempotencyOptions;
    next: CallHandler;
    status: number;
  }): Promise<unknown> {
    const { req, res, key, options, next, status } = args;

    // Scope the key to the caller. Two accounts generating the same UUID must
    // not collide, or account B's request would replay account A's purchase.
    const scope = req.user?.id ?? `anon:${req.ip ?? 'unknown'}`;

    // `baseUrl + path` is the *routed* path, so it is identical whether the
    // client used the versioned prefix or the transitional unversioned alias.
    // Moving a client onto `/api/v1` must not invalidate keys it already holds.
    const routedPath = `${req.baseUrl}${req.path}`.replace(/\/{2,}/g, '/');
    const fingerprint = requestFingerprint(req.method, routedPath, req.body);
    const hash = keyHash(scope, key);
    const ttlMs = options.ttlMs;
    // Only ever a digest. The key itself stops here.
    const label = keyFingerprint(scope, key);

    let outcome = await this.store.claim({
      keyHash: hash,
      requestHash: fingerprint,
      method: req.method,
      path: routedPath,
      ttlMs,
    });

    if (outcome.kind === 'in_progress' || outcome.kind === 'contended') {
      this.logger.warn(
        redactDeep({
          event: 'idempotency.duplicate',
          keyFingerprint: label,
          method: req.method,
          path: routedPath,
          state: outcome.kind,
        }),
      );
      if (outcome.kind === 'in_progress') {
        outcome = await this.store.awaitCompletion({ keyHash: hash, requestHash: fingerprint, ttlMs });
      }
    }

    switch (outcome.kind) {
      case 'owned':
        return this.execute({ res, hash, label, method: req.method, path: routedPath, status, next });

      case 'replay':
        this.logger.log(
          redactDeep({
            event: 'idempotency.replayed',
            keyFingerprint: label,
            method: req.method,
            path: routedPath,
            status: outcome.status,
          }),
        );
        res.setHeader(REPLAYED_HEADER, 'true');
        // Hand the stored body back to Nest rather than writing the response
        // here. Writing it here would leave Nest to reply to an already-sent
        // response, and that path is not harmless: a client sending an
        // `If-None-Match` that matches takes Express's 304 branch, which calls
        // `removeHeader` after the headers are flushed, and Node throws
        // ERR_HTTP_HEADERS_SENT for that. Returning the body keeps exactly one
        // writer on the response, and the status is still the stored one —
        // `resolveStatus` derives it from the same metadata Nest reads.
        res.status(outcome.status);
        return outcome.body ?? null;

      case 'conflict':
        this.logger.warn(
          redactDeep({
            event: 'idempotency.fingerprint_mismatch',
            keyFingerprint: label,
            method: req.method,
            path: routedPath,
            recordedMethod: outcome.recordedMethod,
            recordedPath: outcome.recordedPath,
          }),
        );
        throw AppError.conflict(
          'This Idempotency-Key was already used for a different request. Reusing a key ' +
            'across two different requests cannot be treated as a retry; send a new key.',
          {
            reason: 'fingerprint_mismatch',
            recorded: { method: outcome.recordedMethod, path: outcome.recordedPath },
            submitted: { method: req.method, path: routedPath },
          },
        );

      case 'in_progress':
        res.setHeader('Retry-After', '1');
        throw AppError.conflict(
          'A request with this Idempotency-Key is still being processed. Retry shortly.',
          { reason: 'in_progress' },
        );

      case 'abandoned':
        throw AppError.conflict(
          'A request with this Idempotency-Key began but did not finish, and its outcome ' +
            'cannot be determined. Check whether the operation took effect before trying ' +
            'again with a new key.',
          { reason: 'outcome_unknown' },
        );

      default:
        res.setHeader('Retry-After', '1');
        throw AppError.conflict(
          'Another request is settling this Idempotency-Key right now. Retry shortly.',
          { reason: 'in_progress' },
        );
    }
  }

  /** Run the handler once, then store exactly what it produced. */
  private async execute(args: {
    res: Response;
    hash: string;
    label: string;
    method: string;
    path: string;
    status: number;
    next: CallHandler;
  }): Promise<unknown> {
    const { res, hash, label, method, path, status, next } = args;

    // Pin the status now rather than reading it back off the response later.
    // Express still holds its default 200 at this point; Nest decides between
    // 200 and 201 further down. Setting it here means the status stored for the
    // replay is the status actually sent, so the two cannot drift.
    res.status(status);

    try {
      const body = await lastValueFrom(next.handle(), { defaultValue: undefined });
      await this.store.complete(hash, status, body);
      return body;
    } catch (error) {
      // Nothing was returned, so there is nothing to replay. Drop the claim so
      // the client's next attempt is a real attempt rather than a permanent
      // replay of a failure that never happened.
      await this.store.release(hash);
      this.logger.warn(
        redactDeep({
          event: 'idempotency.released',
          keyFingerprint: label,
          method,
          path,
          reason: error instanceof Error ? error.name : 'unknown',
        }),
      );
      throw error;
    }
  }

  private missingKey(): AppError {
    return AppError.badRequest(
      `This operation requires an ${IDEMPOTENCY_KEY_HEADER} header. Retrying it without ` +
        'one is how a single request gets executed twice.',
    );
  }
}

/**
 * The status this response will carry.
 *
 * `@HttpCode()` if the route set one, otherwise Nest's own rule: 201 for
 * POST, 200 for everything else. Reading the same metadata Nest reads is what
 * keeps a replay byte-identical to the original rather than merely similar.
 */
function resolveStatus(context: ExecutionContext): number {
  const handler = context.getHandler() as unknown as HandlerTarget['handler'];
  const explicit = Reflect.getMetadata(HTTP_CODE_METADATA, handler) as number | undefined;
  if (typeof explicit === 'number') return explicit;
  return context.switchToHttp().getRequest<Request>().method === 'POST'
    ? HttpStatus.CREATED
    : HttpStatus.OK;
}