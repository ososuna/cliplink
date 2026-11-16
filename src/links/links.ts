import { and, count, desc, eq, ilike, isNull, like, ne, or } from 'drizzle-orm';
import type { Db } from '@/db';
import { randomCode } from '@/links/code';
import { parseDestination } from '@/links/destination';
import { parseListing, type Listing } from '@/links/listing';
import { nameMaxLength, parseName } from '@/links/name';
import { link } from '@/links/schema';

export type Link = typeof link.$inferSelect;

export type Links = ReturnType<typeof createLinks>;

/** The Listing that was shown, which can differ from the one asked for, and what it holds. */
export type LinkPage = Listing & {
  items: Link[];
  total: number;
  totalPages: number;
};

// With 62^7 Codes, even one collision is rare. Several in a row means the generator is broken.
const codeAttempts = 5;

// Each retry only happens when another write took the Name in between, so a few is plenty.
const nameAttempts = 5;

export class CodeGenerationError extends Error {
  constructor() {
    super('Could not create a Link right now. Please try again.');
    this.name = 'CodeGenerationError';
  }
}

/** A missing Link and another Owner's Link look the same, so nobody can probe for other Owners' Links. */
export class LinkNotFoundError extends Error {
  constructor() {
    super('Link not found.');
    this.name = 'LinkNotFoundError';
  }
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Postgres rejects a malformed uuid with an error, but to the caller it is just a Link that doesn't exist. */
function assertLinkId(linkId: string) {
  if (!uuidPattern.test(linkId)) throw new LinkNotFoundError();
}

/** Makes `text` match only itself inside a LIKE pattern. */
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (special) => `\\${special}`);
}

/** Another write took the Name between `uniqueName` and this one. Drizzle wraps the driver's error. */
function isNameTaken(error: unknown): boolean {
  const { code, constraint } = ((error as { cause?: unknown })?.cause ??
    error) as { code?: string; constraint?: string };
  return code === '23505' && constraint === 'link_owner_name_unique';
}

/** "Name (n)", with the Name cut short when the suffix would push it past the limit. */
function numbered(opts: { name: string; counter: number }): string {
  const suffix = ` (${opts.counter})`;
  return opts.name.slice(0, nameMaxLength - suffix.length) + suffix;
}

/** The part of a Name every numbered form of it starts with, up to "Name (999)". */
function numberedStem(name: string): string {
  return name.slice(0, nameMaxLength - ' (999)'.length);
}

export function createLinks(deps: { db: Db; generateCode?: () => string }) {
  const { db, generateCode = randomCode } = deps;

  /**
   * The Name itself, or the first free "Name (n)" among the Owner's Links that aren't deleted.
   * A Link being renamed doesn't count, so it can keep its own Name.
   */
  async function uniqueName(opts: {
    ownerId: string;
    name: string;
    renaming?: string;
  }) {
    const { ownerId, name, renaming } = opts;
    const taken = await db
      .select({ name: link.name })
      .from(link)
      .where(
        and(
          eq(link.ownerId, ownerId),
          isNull(link.deletedAt),
          renaming ? ne(link.id, renaming) : undefined,
          or(
            eq(link.name, name),
            like(link.name, `${escapeLike(numberedStem(name))}% (%)`),
          ),
        ),
      );
    const takenNames = new Set(taken.map((row) => row.name));
    let candidate = name;
    for (let counter = 2; takenNames.has(candidate); counter++) {
      candidate = numbered({ name, counter });
    }
    return candidate;
  }

  function ownedLiveLink(opts: { ownerId: string; linkId: string }) {
    return and(
      eq(link.id, opts.linkId),
      eq(link.ownerId, opts.ownerId),
      isNull(link.deletedAt),
    );
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
      const baseName = ownerId ? parseName(input.name) : null;
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

    /** Never fails on a bad page or limit: it shows the nearest valid page instead. */
    async listLinks(
      ownerId: string,
      asked: Partial<Listing>,
    ): Promise<LinkPage> {
      const { page: askedPage, limit, search } = parseListing(asked);
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
      const fetchPage = (page: number) =>
        db
          .select()
          .from(link)
          .where(matching)
          .orderBy(desc(link.createdAt), desc(link.id))
          .limit(limit)
          .offset((page - 1) * limit);
      const [askedItems, [counted]] = await Promise.all([
        fetchPage(askedPage),
        db.select({ total: count() }).from(link).where(matching),
      ]);
      const total = counted?.total ?? 0;
      const totalPages = Math.ceil(total / limit);
      // Past the end, as after deleting the last Link on the last page.
      const page = Math.min(askedPage, Math.max(totalPages, 1));
      const items = page === askedPage ? askedItems : await fetchPage(page);
      return { items, page, limit, search, total, totalPages };
    },

    async renameLink(opts: {
      ownerId: string;
      linkId: string;
      name?: string;
    }): Promise<Link> {
      const { ownerId, linkId } = opts;
      assertLinkId(linkId);
      const baseName = parseName(opts.name);
      for (let attempt = 1; ; attempt++) {
        const name = baseName
          ? await uniqueName({ ownerId, name: baseName, renaming: linkId })
          : null;
        try {
          const [renamed] = await db
            .update(link)
            .set({ name })
            .where(ownedLiveLink({ ownerId, linkId }))
            .returning();
          if (!renamed) throw new LinkNotFoundError();
          return renamed;
        } catch (error) {
          if (!isNameTaken(error) || attempt === nameAttempts) throw error;
        }
      }
    },

    async deleteLink(opts: { ownerId: string; linkId: string }) {
      const { ownerId, linkId } = opts;
      assertLinkId(linkId);
      // The row stays, so its Code is never given to a new Link.
      const [deleted] = await db
        .update(link)
        .set({ deletedAt: new Date() })
        .where(ownedLiveLink({ ownerId, linkId }))
        .returning({ id: link.id });
      if (!deleted) throw new LinkNotFoundError();
    },

    /**
     * Makes all of an Owner's Links Deleted Links, for when they delete their User.
     * Run it before the User row goes: removing the User clears `owner_id`, after which
     * nothing tells their Links apart from Anonymous Links.
     */
    async deleteOwnerLinks(ownerId: string) {
      await db
        .update(link)
        .set({ deletedAt: new Date() })
        .where(and(eq(link.ownerId, ownerId), isNull(link.deletedAt)));
    },

    async findDestination(code: string): Promise<string | null> {
      const [found] = await db
        .select({ destination: link.destination })
        .from(link)
        .where(and(eq(link.code, code), isNull(link.deletedAt)));
      return found?.destination ?? null;
    },
  };
}
