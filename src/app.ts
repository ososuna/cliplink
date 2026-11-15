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
import { createLinks } from '@/links';

// The app's single instances. Modules take their dependencies as arguments, so only this file reads astro:env.
export const db = createDb(DATABASE_URL);
export const links = createLinks({ db });
export const auth = createAuth({
  db,
  baseURL: BETTER_AUTH_URL,
  secret: BETTER_AUTH_SECRET,
  google: { clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET },
  github: { clientId: GITHUB_CLIENT_ID, clientSecret: GITHUB_CLIENT_SECRET },
});
