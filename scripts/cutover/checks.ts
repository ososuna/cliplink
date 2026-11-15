// Pure checks behind the cutover wizard (scripts/cutover.sh). verify.ts does the I/O.

type Env = Record<string, string | undefined>;

// The variables the app needs at build time and at runtime (astro.config.mjs), plus
// DATABASE_URL_UNPOOLED for `pnpm db:migrate` in the Vercel build (vercel.json).
// Neon sets the database ones; in preview it injects them per deployment instead.
const database = ['DATABASE_URL', 'DATABASE_URL_UNPOOLED'];
// Lets a preview build refuse to migrate production (scripts/vercel-build/should-migrate.ts).
const previewOnly = ['PRODUCTION_DATABASE_HOST'];
const auth = [
  'BETTER_AUTH_URL',
  'BETTER_AUTH_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
];

// The old Astro UI's variables (docs/adr/old-ui.md). Nothing reads them any more.
const legacy = [
  'PUBLIC_API_BASE_URL',
  'PUBLIC_API_DOMAIN',
  'PUBLIC_APP_DOMAIN',
  'PUBLIC_APP_NAME',
];

export const productionUrl = 'https://cliplink.app';

// Problems with one Vercel environment, read from `vercel env pull`. Sensitive variables
// come back empty, so only their presence is checked.
export function checkEnv(env: Env, target: 'production' | 'preview') {
  const url = env.BETTER_AUTH_URL;
  const secret = env.BETTER_AUTH_SECRET;
  return [
    ...[...(target === 'production' ? database : previewOnly), ...auth]
      .filter((name) => env[name] === undefined)
      .map((name) => `${name} is missing`),
    ...(target === 'production' && url && url !== productionUrl
      ? [`BETTER_AUTH_URL must be ${productionUrl}, not ${url}`]
      : []),
    ...(secret && secret.length < 32
      ? ['BETTER_AUTH_SECRET must be at least 32 characters']
      : []),
    ...legacy
      .filter((name) => env[name] !== undefined)
      .map((name) => `${name} is from the old UI, remove it`),
  ];
}

// A Redirect answers 302 with the Destination as Location.
export function checkRedirect(
  response: { status: number; location: string | null },
  destination: string,
) {
  return [
    ...(response.status === 302
      ? []
      : [`Expected status 302, got ${response.status}`]),
    ...(response.location === destination
      ? []
      : [
          `Expected Location ${destination}, got ${response.location ?? 'none'}`,
        ]),
  ];
}

// Which requests the WAF rule limits: only those without a session cookie, or every create.
export type RateLimitScope = 'anonymous' | 'every-create';

// Statuses from a burst of create requests sent within one window, then one request
// carrying a session cookie (sent while the burst's IP is already over the limit).
export function checkRateLimit(
  probe: { anonymous: number[]; withSession: number },
  scope: RateLimitScope,
) {
  const problems: string[] = [];
  if (!probe.anonymous.includes(429)) {
    problems.push(
      `${probe.anonymous.length} anonymous requests in a minute never got a 429`,
    );
  }
  if (scope === 'every-create' && probe.withSession !== 429) {
    problems.push(
      `A request with a session cookie got ${probe.withSession}, expected 429`,
    );
  }
  if (scope === 'anonymous' && probe.withSession === 429) {
    problems.push('A request with a session cookie got 429, expected no limit');
  }
  return problems;
}

// drizzle-kit stores each applied migration's journal `when` as created_at in
// drizzle.__drizzle_migrations.
export function checkMigrations(
  journal: { entries: { tag: string; when: number }[] },
  appliedCreatedAt: number[],
) {
  return journal.entries
    .filter((entry) => !appliedCreatedAt.includes(entry.when))
    .map((entry) => `Migration ${entry.tag} is not applied`);
}
