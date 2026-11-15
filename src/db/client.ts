import { Pool as NeonPool } from '@neondatabase/serverless';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from '@/db/schema';

export type Schema = typeof schema;
export type Db = PgDatabase<PgQueryResultHKT, Schema>;

const localHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

// The Neon driver speaks WebSocket, not TCP, so it can't reach the plain Postgres
// used by `pnpm db:dev` and the CI service container. Those get node-postgres.
export function createDb(url: string): Db {
  if (localHosts.has(new URL(url).hostname)) {
    return drizzlePg({
      client: new pg.Pool({ connectionString: url }),
      schema,
    });
  }
  return drizzleNeon({
    client: new NeonPool({ connectionString: url }),
    schema,
  });
}
