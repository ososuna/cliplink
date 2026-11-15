import { eq } from 'drizzle-orm';
import type { Db } from '@/db';
import { randomCode } from '@/links/code';
import { parseDestination } from '@/links/destination';
import { link } from '@/links/schema';

export type Link = typeof link.$inferSelect;

export type Links = ReturnType<typeof createLinks>;

// With 62^7 Codes, even one collision is rare. Several in a row means the generator is broken.
const codeAttempts = 5;

export class CodeGenerationError extends Error {
  constructor() {
    super('Could not create a Link right now. Please try again.');
    this.name = 'CodeGenerationError';
  }
}

export function createLinks(deps: { db: Db; generateCode?: () => string }) {
  const { db, generateCode = randomCode } = deps;

  return {
    async createLink(input: { destination: string }): Promise<Link> {
      const destination = parseDestination(input.destination);
      for (let attempt = 0; attempt < codeAttempts; attempt++) {
        const [created] = await db
          .insert(link)
          .values({ code: generateCode(), destination })
          .onConflictDoNothing({ target: link.code })
          .returning();
        if (created) return created;
      }
      throw new CodeGenerationError();
    },

    async findDestination(code: string): Promise<string | null> {
      const [found] = await db
        .select({ destination: link.destination })
        .from(link)
        .where(eq(link.code, code));
      return found?.destination ?? null;
    },
  };
}
