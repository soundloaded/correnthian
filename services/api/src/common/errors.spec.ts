import { describe, expect, it } from 'vitest';
import { AppError, ValidationError } from './errors.js';

describe('error taxonomy', () => {
  it('maps each code to the right HTTP status', () => {
    expect(AppError.badRequest('x').status).toBe(400);
    expect(AppError.unauthorized().status).toBe(401);
    expect(AppError.forbidden().status).toBe(403);
    expect(AppError.notFound().status).toBe(404);
    expect(AppError.conflict('x').status).toBe(409);
    expect(AppError.rateLimited().status).toBe(429);
    expect(AppError.jurisdictionBlocked('x').status).toBe(451);
    expect(AppError.providerUnavailable().status).toBe(503);
  });

  it('carries validation issues as safe client detail', () => {
    const err = new ValidationError([{ path: 'email', message: 'required' }]);
    expect(err.status).toBe(422);
    expect(err.detail).toEqual([{ path: 'email', message: 'required' }]);
  });
});
