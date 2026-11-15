import { readFileSync } from 'node:fs';
import { count, sql } from 'drizzle-orm';
import { integer, pgSchema, pgTable, serial } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { createTestDb } from '@/db/testing';

const journal = JSON.parse(
  readFileSync(
    new URL('../../drizzle/meta/_journal.json', import.meta.url),
    'utf8',
  ),
) as { entries: unknown[] };

const appliedMigrations = pgSchema('drizzle').table('__drizzle_migrations', {
  id: serial('id').primaryKey(),
});

describe('createTestDb', () => {
  it('applies every committed migration to a fresh database', async () => {
    const db = await createTestDb();

    const [applied] = await db
      .select({ total: count() })
      .from(appliedMigrations);

    expect(journal.entries.length).toBeGreaterThan(0);
    expect(applied?.total).toBe(journal.entries.length);
  });

  it('gives each caller its own database', async () => {
    const first = await createTestDb();
    const second = await createTestDb();
    const onlyInFirst = pgTable('only_in_first', { id: integer('id') });

    await first.execute(sql`create table only_in_first (id int)`);

    await expect(first.select().from(onlyInFirst)).resolves.toEqual([]);
    await expect(second.select().from(onlyInFirst)).rejects.toThrow();
  });
});
