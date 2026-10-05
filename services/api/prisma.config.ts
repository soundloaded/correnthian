import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

/**
 * Prisma 7 moved the connection string out of schema.prisma and into here.
 *
 * `env()` throws if DATABASE_URL is absent, which means every CLI command
 * needs it present — including `generate`, which never touches a database.
 * Pass a syntactically valid placeholder when only generating.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
