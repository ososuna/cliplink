import {
  BETTER_AUTH_SECRET,
  BETTER_AUTH_URL,
  DATABASE_URL,
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
} from 'astro:env/server';
import { createAuth } from '@/auth';
import { createDb } from '@/db';

// The app's single instances, built from astro:env. Modules take these as arguments
// instead of importing astro:env, so Vitest, drizzle-kit, and Playwright can load them.
export const db = createDb(DATABASE_URL);

export const auth = createAuth({
  db,
  baseURL: BETTER_AUTH_URL,
  secret: BETTER_AUTH_SECRET,
  google: { clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET },
  github: { clientId: GITHUB_CLIENT_ID, clientSecret: GITHUB_CLIENT_SECRET },
});
