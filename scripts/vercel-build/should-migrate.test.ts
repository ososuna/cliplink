import { describe, expect, it } from 'vitest';
import { shouldMigrate } from './should-migrate.ts';

const productionHost = 'ep-calm-sea-a1b2c3d4.us-east-1.aws.neon.tech';
const productionUrl = `postgres://neondb_owner:pw@${productionHost}/neondb?sslmode=require`;
const branchUrl =
  'postgres://neondb_owner:pw@ep-wild-moon-e5f6g7h8.us-east-1.aws.neon.tech/neondb?sslmode=require';

describe('shouldMigrate', () => {
  it('migrates a production build', () => {
    expect(
      shouldMigrate({
        VERCEL_ENV: 'production',
        DATABASE_URL_UNPOOLED: productionUrl,
      }),
    ).toMatchObject({ migrate: true });
  });

  it('migrates a preview build on its own Neon branch', () => {
    expect(
      shouldMigrate({
        VERCEL_ENV: 'preview',
        DATABASE_URL_UNPOOLED: branchUrl,
        PRODUCTION_DATABASE_HOST: productionHost,
      }),
    ).toMatchObject({ migrate: true });
  });

  it('never migrates a preview build pointed at the production database', () => {
    expect(
      shouldMigrate({
        VERCEL_ENV: 'preview',
        DATABASE_URL_UNPOOLED: productionUrl,
        PRODUCTION_DATABASE_HOST: productionHost,
      }),
    ).toEqual({
      migrate: false,
      reason:
        'Skipping migrations: this preview uses the production database (is Neon preview branching off?)',
    });
  });

  it('treats the pooled production host as production too', () => {
    const pooled = productionUrl.replace('ep-calm-sea-a1b2c3d4', '$&-pooler');
    expect(
      shouldMigrate({
        VERCEL_ENV: 'preview',
        DATABASE_URL: pooled,
        PRODUCTION_DATABASE_HOST: productionHost,
      }),
    ).toMatchObject({ migrate: false });
  });

  it('prefers the unpooled URL, as drizzle-kit does', () => {
    expect(
      shouldMigrate({
        VERCEL_ENV: 'preview',
        DATABASE_URL: branchUrl,
        DATABASE_URL_UNPOOLED: productionUrl,
        PRODUCTION_DATABASE_HOST: productionHost,
      }),
    ).toMatchObject({ migrate: false });
  });

  it('never migrates a preview build when it cannot tell production apart', () => {
    expect(
      shouldMigrate({
        VERCEL_ENV: 'preview',
        DATABASE_URL_UNPOOLED: branchUrl,
      }),
    ).toEqual({
      migrate: false,
      reason:
        'Skipping migrations: PRODUCTION_DATABASE_HOST is not set, so this preview cannot prove it has its own database',
    });
  });

  it('never migrates a preview build without a database', () => {
    expect(
      shouldMigrate({
        VERCEL_ENV: 'preview',
        PRODUCTION_DATABASE_HOST: productionHost,
      }),
    ).toMatchObject({ migrate: false });
  });

  it('never migrates outside a Vercel production or preview build', () => {
    expect(shouldMigrate({ DATABASE_URL_UNPOOLED: productionUrl })).toEqual({
      migrate: false,
      reason:
        'Skipping migrations: VERCEL_ENV is not production or preview (run pnpm db:migrate yourself)',
    });
  });
});
