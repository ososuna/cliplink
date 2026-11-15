// Pure decision behind scripts/vercel-build/migrate.ts, which vercel.json runs before the build.

type Env = Record<string, string | undefined>;

export type MigrateDecision = { migrate: boolean; reason: string };

const skip = (why: string): MigrateDecision => ({
  migrate: false,
  reason: `Skipping migrations: ${why}`,
});

// Neon's pooled host is the endpoint host with "-pooler" added to its first label.
function endpointHost(host: string) {
  return host.toLowerCase().replace(/^([^.]+)-pooler\./, '$1.');
}

function hostOf(url: string) {
  try {
    return endpointHost(new URL(url).hostname);
  } catch {
    return null;
  }
}

/**
 * Production always migrates. A preview migrates only when its database provably isn't
 * production's: with Neon preview branching off, Vercel hands previews the production URL.
 */
export function shouldMigrate(env: Env): MigrateDecision {
  if (env.VERCEL_ENV === 'production') {
    return { migrate: true, reason: 'Migrating the production database' };
  }
  if (env.VERCEL_ENV !== 'preview') {
    return skip(
      'VERCEL_ENV is not production or preview (run pnpm db:migrate yourself)',
    );
  }
  const production = env.PRODUCTION_DATABASE_HOST;
  if (!production) {
    return skip(
      'PRODUCTION_DATABASE_HOST is not set, so this preview cannot prove it has its own database',
    );
  }
  // The URL drizzle-kit would use (drizzle.config.ts).
  const url = env.DATABASE_URL_UNPOOLED || env.DATABASE_URL;
  const host = url ? hostOf(url) : null;
  if (!host) return skip('this preview has no database URL');
  if (host === endpointHost(production)) {
    return skip(
      'this preview uses the production database (is Neon preview branching off?)',
    );
  }
  return { migrate: true, reason: "Migrating this preview's Neon branch" };
}
