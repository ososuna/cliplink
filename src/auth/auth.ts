import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import * as authSchema from '@/auth/schema';
import type { Db } from '@/db';
import type { Links } from '@/links';
import { signInPath } from '@/paths';

type ProviderCredentials = { clientId: string; clientSecret: string };

export type AuthConfig = {
  db: Db;
  links: Pick<Links, 'deleteOwnerLinks'>;
  baseURL: string;
  secret: string;
  google: ProviderCredentials;
  github: ProviderCredentials;
};

export function createAuth({
  db,
  links,
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
    user: {
      deleteUser: {
        enabled: true,
        // Before the User row goes, because removing it clears their Links' Owner.
        beforeDelete: (user) => links.deleteOwnerLinks(user.id),
      },
    },
    // Renaming goes through the user.rename Action, which validates the name.
    // This endpoint would take any name, and an image URL too.
    disabledPaths: ['/update-user'],
    onAPIError: { errorURL: signInPath },
    advanced: {
      // Better Auth's schema check expects account.password, which Cliplink leaves out
      // (ADR-0003). src/auth/auth.test.ts signs in against the migrated schema instead.
      database: { validateSchema: false },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
