import { DATABASE_URL } from 'astro:env/server';
import { createDb } from '@/db';
import { createLinks } from '@/links';

// The app's single instances. Modules take their dependencies as arguments, so only this file reads astro:env.
export const db = createDb(DATABASE_URL);
export const links = createLinks({ db });
