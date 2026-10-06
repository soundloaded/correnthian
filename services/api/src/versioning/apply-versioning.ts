import { RequestMethod, type INestApplication } from '@nestjs/common';
import { apiVersionHandler } from './api-version.middleware.js';
import { API_PREFIX, UNVERSIONED_PATHS } from './api-versions.js';

/**
 * Put the versioned surface in front of the application.
 *
 * A function rather than a few lines of `main.ts`, on purpose. The wire
 * contract suite boots the API itself — `Test.createTestingModule(...)
 * .createNestApplication()` — and never runs `main.ts`, so anything configured
 * only there is not covered by the tests that exist to prove the wire format.
 * A prefix that no test exercises is a prefix nobody has tested.
 *
 * Call it **before** `app.init()`. `app.use()` writes straight to the
 * underlying Express instance and Nest installs its routes at init, so this
 * ordering is what puts version negotiation in front of the routes rather than
 * behind them.
 *
 * Note what is *not* here: a not-found handler. Nest installs its own during
 * `init()`, scoped to the global prefix, so registering one before init would
 * shadow every route and registering one after would never be reached for the
 * paths that matter. The version-aware 404 for an unknown path therefore lives
 * in two places that are both always in the right place: this module's
 * middleware answers for versions we do not serve, and the exception filter
 * answers for paths that do not exist inside a version we do.
 */
export function applyApiVersioning(app: INestApplication): INestApplication {
  app.setGlobalPrefix(API_PREFIX, {
    // Nest matches these with `path-to-regexp`, which is exact, so excluding
    // `health` covers `/health` and *not* `/health/live` — the two entries per
    // prefix are both required, and leaving out the wildcard is the mistake
    // that would only show up when an orchestrator's probe started 404ing.
    exclude: UNVERSIONED_PATHS.flatMap((path) => [
      { path, method: RequestMethod.ALL },
      { path: `${path}/*path`, method: RequestMethod.ALL },
    ]),
  });

  app.use(apiVersionHandler);

  return app;
}