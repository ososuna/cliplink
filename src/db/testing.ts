import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { Db } from '@/db/client';
import * as schema from '@/db/schema';

const migrationsFolder = fileURLToPath(
  new URL('../../drizzle', import.meta.url),
);

/** A fresh in-memory Postgres with every committed migration applied. Call once per test file. */
export async function createTestDb(): Promise<Db> {
  const db = drizzle({ client: new PGlite(), schema });
  await migrate(db, { migrationsFolder });
  return db;
}
