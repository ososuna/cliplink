import { sql } from 'drizzle-orm';
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
// Relative, because drizzle-kit loads this file without the `@/` alias.
import { user } from '../auth/schema';

export const link = pgTable(
  'link',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull().unique(),
    destination: text('destination').notNull(),
    name: text('name'),
    // `set null`, not `cascade`: the row stays so its Code is never reused after the Owner deletes their User.
    ownerId: text('owner_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // A Deleted Link's Name is free again.
    uniqueIndex('link_owner_name_unique')
      .on(table.ownerId, table.name)
      .where(sql`${table.deletedAt} is null`),
    index('link_owner_created_idx').on(table.ownerId, table.createdAt),
  ],
);
