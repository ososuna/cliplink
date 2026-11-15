// Checks the cutover wizard runs after a step. Run with Node 24 (it strips the types):
//   node scripts/cutover/verify.ts env <production|preview> <file from `vercel env pull`>
//   node scripts/cutover/verify.ts migrations          (reads DATABASE_URL_UNPOOLED)
//   node scripts/cutover/verify.ts live <origin>
//   node scripts/cutover/verify.ts redirect <short URL> <Destination>
//   node scripts/cutover/verify.ts rate-limit <origin> <anonymous|every-create>
// Prints what it checked and exits 1 on any problem.
import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import pg from 'pg';
import {
  checkEnv,
  checkMigrations,
  checkRateLimit,
  checkRedirect,
} from './checks.ts';

// Better Auth's cookie name when BETTER_AUTH_URL is https.
const sessionCookie = '__Secure-better-auth.session_token';
const createActionPath = '/_actions/links.create';

async function env(target: string, file: string) {
  if (target !== 'production' && target !== 'preview') {
    throw new Error(`Unknown environment ${target}`);
  }
  return checkEnv(parse(readFileSync(file)), target);
}

async function migrations() {
  const url = process.env.DATABASE_URL_UNPOOLED;
  if (!url) return ['Set DATABASE_URL_UNPOOLED first'];
  const journal = JSON.parse(
    readFileSync(
      new URL('../../drizzle/meta/_journal.json', import.meta.url),
      'utf8',
    ),
  );
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query<{ created_at: string }>(
      'select created_at from drizzle.__drizzle_migrations',
    );
    return checkMigrations(
      journal,
      rows.map((row) => Number(row.created_at)),
    );
  } catch (error) {
    // 42P01: the migrations table doesn't exist, so nothing is applied yet.
    if ((error as { code?: string }).code === '42P01') {
      return checkMigrations(journal, []);
    }
    throw error;
  } finally {
    await client.end();
  }
}

// The new app is live: Better Auth answers, and an old 8-character Code is a 404 (ADR-0004).
async function live(origin: string) {
  const problems: string[] = [];
  const ok = await fetch(new URL('/api/auth/ok', origin));
  const body = ok.ok ? await ok.text() : '';
  if (!body.includes('"ok":true')) {
    problems.push(
      `GET /api/auth/ok gave ${ok.status}, so the new app is not serving yet`,
    );
  }
  const oldCode = await fetch(new URL('/0123abcd', origin), {
    redirect: 'manual',
  });
  if (oldCode.status !== 404) {
    problems.push(`An old Code gave ${oldCode.status}, expected 404`);
  }
  return problems;
}

async function redirect(shortUrl: string, destination: string) {
  const response = await fetch(shortUrl, { redirect: 'manual' });
  return checkRedirect(
    { status: response.status, location: response.headers.get('location') },
    destination,
  );
}

// An invalid Destination makes every request a 400, so the probe creates no Links.
function postCreate(origin: string, headers: Record<string, string> = {}) {
  return fetch(new URL(createActionPath, origin), {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ destination: 'not a url' }),
  }).then((response) => response.status);
}

async function rateLimit(origin: string, scope: string) {
  if (scope !== 'anonymous' && scope !== 'every-create') {
    throw new Error(`Unknown scope ${scope}`);
  }
  const anonymous: number[] = [];
  for (let i = 0; i < 31; i++) anonymous.push(await postCreate(origin));
  const withSession = await postCreate(origin, {
    cookie: `${sessionCookie}=rate-limit-probe.not-signed`,
  });
  console.log(`anonymous: ${anonymous.join(' ')}`);
  console.log(`with a session cookie: ${withSession}`);
  return checkRateLimit({ anonymous, withSession }, scope);
}

const commands: Record<string, (...args: string[]) => Promise<string[]>> = {
  env,
  migrations,
  live,
  redirect,
  'rate-limit': rateLimit,
};

const [name, ...args] = process.argv.slice(2);
const command = name ? commands[name] : undefined;
if (!command) {
  console.error(`Usage: verify.ts <${Object.keys(commands).join('|')}> ...`);
  process.exit(2);
}
const problems = await command(...args);
for (const problem of problems) console.error(`  x ${problem}`);
if (problems.length) process.exit(1);
console.log(`  ok: ${name} passed`);
