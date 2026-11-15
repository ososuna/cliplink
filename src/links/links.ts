import { and, count, desc, eq, ilike, isNull, like, or } from 'drizzle-orm';
import type { Db } from '@/db';
import { randomCode } from '@/links/code';
import { parseDestination } from '@/links/destination';
import { link } from '@/links/schema';

export type Link = typeof link.$inferSelect;

export type Links = ReturnType<typeof createLinks>;

export type LinkPage = {
  items: Link[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

// With 62^7 Codes, even one collision is rare. Several in a row means the generator is broken.
const codeAttempts = 5;

export class CodeGenerationError extends Error {
  constructor() {
    super('Could not create a Link right now. Please try again.');
    this.name = 'CodeGenerationError';
  }
}

/** Makes `text` match only itself inside a LIKE pattern. */
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (special) => `\\${special}`);
}

function normalizeName(name: string | undefined): string | null {
  const trimmed = name?.trim();
  return trimmed ? trimmed : null;
}

export function createLinks(deps: { db: Db; generateCode?: () => string }) {
  const { db, generateCode = randomCode } = deps;

  /** The Name itself, or the first free "Name (n)" among the Owner's Links that aren't deleted. */
  async function uniqueName(opts: { ownerId: string; name: string }) {
    const { ownerId, name } = opts;
    const taken = await db
      .select({ name: link.name })
      .from(link)
      .where(
        and(
          eq(link.ownerId, ownerId),
          isNull(link.deletedAt),
          or(eq(link.name, name), like(link.name, `${escapeLike(name)} (%)`)),
        ),
      );
    const takenNames = new Set(taken.map((row) => row.name));
    let candidate = name;
    for (let counter = 2; takenNames.has(candidate); counter++) {
      candidate = `${name} (${counter})`;
    }
    return candidate;
  }

  return {
    async createLink(input: {
      destination: string;
      name?: string;
      ownerId?: string;
    }): Promise<Link> {
      const destination = parseDestination(input.destination);
      const ownerId = input.ownerId ?? null;
      // Only Owners name Links, so an Anonymous Link never has a Name.
      const baseName = ownerId ? normalizeName(input.name) : null;
      for (let attempt = 0; attempt < codeAttempts; attempt++) {
        const name =
          ownerId && baseName
            ? await uniqueName({ ownerId, name: baseName })
            : null;
        // No conflict target: a taken Code and a Name claimed by a concurrent create both mean "try again".
        const [created] = await db
          .insert(link)
          .values({ code: generateCode(), destination, name, ownerId })
          .onConflictDoNothing()
          .returning();
        if (created) return created;
      }
      throw new CodeGenerationError();
    },

    async listLinks(
      ownerId: string,
      options: { search?: string; page: number; limit: number },
    ): Promise<LinkPage> {
      const { page, limit } = options;
      const search = options.search?.trim();
      const pattern = search ? `%${escapeLike(search)}%` : null;
      const matching = and(
        eq(link.ownerId, ownerId),
        isNull(link.deletedAt),
        pattern
          ? or(
              ilike(link.name, pattern),
              ilike(link.code, pattern),
              ilike(link.destination, pattern),
            )
          : undefined,
      );
      const [items, [counted]] = await Promise.all([
        db
          .select()
          .from(link)
          .where(matching)
          .orderBy(desc(link.createdAt), desc(link.id))
          .limit(limit)
          .offset((page - 1) * limit),
        db.select({ total: count() }).from(link).where(matching),
      ]);
      const total = counted?.total ?? 0;
      return {
        items,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      };
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
