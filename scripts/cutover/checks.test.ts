import { describe, expect, it } from 'vitest';
import {
  checkEnv,
  checkMigrations,
  checkRateLimit,
  checkRedirect,
} from './checks.ts';

const production = {
  DATABASE_URL: 'postgres://pooled.neon.tech/neondb',
  DATABASE_URL_UNPOOLED: 'postgres://direct.neon.tech/neondb',
  BETTER_AUTH_URL: 'https://cliplink.app',
  BETTER_AUTH_SECRET: 'x'.repeat(44),
  GOOGLE_CLIENT_ID: '123.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'google-secret',
  GITHUB_CLIENT_ID: 'Ov23li',
  GITHUB_CLIENT_SECRET: 'github-secret',
};

const previewOnly = { PRODUCTION_DATABASE_HOST: 'direct.neon.tech' };

function without(env: Record<string, string>, ...keys: string[]) {
  return Object.fromEntries(
    Object.entries(env).filter(([key]) => !keys.includes(key)),
  );
}

describe('checkEnv', () => {
  it('passes a complete production environment', () => {
    expect(checkEnv(production, 'production')).toEqual([]);
  });

  it('reports each missing variable', () => {
    const env = without(
      production,
      'GITHUB_CLIENT_SECRET',
      'DATABASE_URL_UNPOOLED',
    );
    expect(checkEnv(env, 'production')).toEqual([
      'DATABASE_URL_UNPOOLED is missing',
      'GITHUB_CLIENT_SECRET is missing',
    ]);
  });

  it('does not expect the database variables in preview', () => {
    // Neon injects them into each preview deployment, not into the project settings.
    const env = without(production, 'DATABASE_URL', 'DATABASE_URL_UNPOOLED');
    expect(checkEnv({ ...env, ...previewOnly }, 'preview')).toEqual([]);
    expect(checkEnv(env, 'production')).toEqual([
      'DATABASE_URL is missing',
      'DATABASE_URL_UNPOOLED is missing',
    ]);
  });

  it('requires the cliplink.app base URL in production only', () => {
    const env = { ...production, BETTER_AUTH_URL: 'http://localhost:4321' };
    expect(checkEnv(env, 'production')).toEqual([
      'BETTER_AUTH_URL must be https://cliplink.app, not http://localhost:4321',
    ]);
    expect(checkEnv({ ...env, ...previewOnly }, 'preview')).toEqual([]);
  });

  it('expects preview to know the production database host', () => {
    // Without it, a preview build can't tell it would migrate production.
    expect(checkEnv(production, 'preview')).toEqual([
      'PRODUCTION_DATABASE_HOST is missing',
    ]);
  });

  it('rejects a short BETTER_AUTH_SECRET, and skips values Vercel hides', () => {
    expect(
      checkEnv({ ...production, BETTER_AUTH_SECRET: 'short' }, 'production'),
    ).toEqual(['BETTER_AUTH_SECRET must be at least 32 characters']);
    // `vercel env pull` writes Sensitive variables with an empty value.
    expect(
      checkEnv({ ...production, BETTER_AUTH_SECRET: '' }, 'production'),
    ).toEqual([]);
  });

  it('reports the old UI variables still set', () => {
    const env = {
      ...production,
      PUBLIC_API_BASE_URL: 'https://cliplink-rest.onrender.com',
      PUBLIC_APP_NAME: 'ClipLink',
    };
    expect(checkEnv(env, 'production')).toEqual([
      'PUBLIC_API_BASE_URL is from the old UI, remove it',
      'PUBLIC_APP_NAME is from the old UI, remove it',
    ]);
  });
});

describe('checkRedirect', () => {
  const destination = 'https://example.com/a/long/path';

  it('passes a 302 to the Destination', () => {
    expect(
      checkRedirect({ status: 302, location: destination }, destination),
    ).toEqual([]);
  });

  it('reports a wrong status or Location', () => {
    expect(checkRedirect({ status: 404, location: null }, destination)).toEqual(
      [
        'Expected status 302, got 404',
        `Expected Location ${destination}, got none`,
      ],
    );
    expect(
      checkRedirect(
        { status: 302, location: 'https://evil.test' },
        destination,
      ),
    ).toEqual([`Expected Location ${destination}, got https://evil.test`]);
  });
});

describe('checkRateLimit', () => {
  // 31 anonymous requests in one window: the 31st is over the limit of 30.
  const limited = [...Array<number>(30).fill(400), 429];

  it('passes when anonymous creation hits 429 and a session cookie does not', () => {
    expect(checkRateLimit({ anonymous: limited, withSession: 400 })).toEqual(
      [],
    );
  });

  it('reports a rule that never limits', () => {
    expect(
      checkRateLimit({
        anonymous: Array<number>(31).fill(400),
        withSession: 400,
      }),
    ).toEqual(['31 anonymous requests in a minute never got a 429']);
  });

  it('reports a rule that limits signed-in creation too', () => {
    expect(checkRateLimit({ anonymous: limited, withSession: 429 })).toEqual([
      'A request with a session cookie got 429, expected no limit',
    ]);
  });
});

describe('checkMigrations', () => {
  // Shaped like drizzle/meta/_journal.json; drizzle-kit records `when` as created_at.
  const journal = {
    entries: [
      { tag: '0000_baseline', when: 1794766202148 },
      { tag: '0001_links', when: 1794766571099 },
    ],
  };

  it('passes when every migration in the journal is applied', () => {
    expect(checkMigrations(journal, [1794766202148, 1794766571099])).toEqual(
      [],
    );
  });

  it('names the migrations not applied yet', () => {
    expect(checkMigrations(journal, [1794766202148])).toEqual([
      'Migration 0001_links is not applied',
    ]);
    expect(checkMigrations(journal, [])).toEqual([
      'Migration 0000_baseline is not applied',
      'Migration 0001_links is not applied',
    ]);
  });
});
