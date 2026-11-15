import { randomBytes, randomUUID } from 'node:crypto';
import type { BrowserContext } from '@playwright/test';
import { makeSignature } from 'better-auth/crypto';
import { createDb, schema } from '@/db';
import { e2eEnv } from './env';

const db = createDb(e2eEnv.DATABASE_URL);

// Better Auth drops the `__Secure-` prefix when its base URL is plain http, as it is in e2e.
const sessionCookie = 'better-auth.session_token';

type TestUser = {
  name?: string;
  email?: string;
  image?: string | null;
  providers?: ('google' | 'github')[];
};

/**
 * Signs a test in the way a real sign-in would leave it: a User, their Provider links,
 * and a session row in the database, plus the signed session cookie in the browser.
 */
export async function signIn(context: BrowserContext, testUser: TestUser = {}) {
  const userId = randomUUID();
  const user = {
    id: userId,
    name: testUser.name ?? 'Test User',
    email: testUser.email ?? `${userId}@example.test`,
    emailVerified: true,
    image: testUser.image ?? null,
  };
  await db.insert(schema.user).values(user);
  for (const providerId of testUser.providers ?? ['github']) {
    await db.insert(schema.account).values({
      id: randomUUID(),
      accountId: randomUUID(),
      providerId,
      userId,
      updatedAt: new Date(),
    });
  }

  // Better Auth splits the cookie at its last dot, so the token must not contain one.
  const token = randomBytes(24).toString('base64url');
  await db.insert(schema.session).values({
    id: randomUUID(),
    token,
    userId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(),
  });
  const signature = await makeSignature(token, e2eEnv.BETTER_AUTH_SECRET);
  await context.addCookies([
    {
      name: sessionCookie,
      value: encodeURIComponent(`${token}.${signature}`),
      url: e2eEnv.BETTER_AUTH_URL,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);

  return user;
}
