import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const link = pgTable('link', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  destination: text('destination').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
