import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import * as authSchema from '@/auth/schema';
import type { Db } from '@/db';

export const signInPath = '/auth/login';

type OAuthApp = { clientId: string; clientSecret: string };

export type AuthConfig = {
  db: Db;
  baseURL: string;
  secret: string;
  google: OAuthApp;
  github: OAuthApp;
};

export function createAuth({
  db,
  baseURL,
  secret,
  google,
  github,
}: AuthConfig) {
  return betterAuth({
    baseURL,
    secret,
    database: drizzleAdapter(db, { provider: 'pg', schema: authSchema }),
    socialProviders: {
      google,
      // GitHub's default scopes already include user:email; listing it keeps it if defaults change.
      github: { ...github, scope: ['user:email'] },
    },
    account: {
      // No trustedProviders on purpose: Better Auth links trusted Providers even when the
      // Provider says the email is unverified. Without it, a same-email sign-in links only
      // when the Provider has verified the email (ADR-0003).
      accountLinking: { enabled: true },
    },
    onAPIError: { errorURL: signInPath },
    advanced: {
      // Better Auth's schema check expects account.password, which Cliplink leaves out
      // (ADR-0003). src/auth/auth.test.ts signs in against the migrated schema instead.
      database: { validateSchema: false },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
