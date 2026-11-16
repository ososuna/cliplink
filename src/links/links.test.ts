import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { schema, type Db } from '@/db';
import { createTestDb } from '@/db/testing';
import {
  CodeGenerationError,
  InvalidDestinationError,
  InvalidNameError,
  LinkNotFoundError,
  createLinks,
} from '@/links';

let db: Db;

beforeAll(async () => {
  db = await createTestDb();
});

// PGlite's clock ticks in milliseconds, so Links created within one would tie on created time.
const nextMillisecond = () => new Promise((resolve) => setTimeout(resolve, 2));

/** A User in the database, as sign-in would leave one. Returns their id. */
async function createOwner(): Promise<string> {
  const id = randomUUID();
  await db
    .insert(schema.user)
    .values({ id, name: 'Owner', email: `${id}@example.test` });
  return id;
}

describe('createLink', () => {
  it('creates an Anonymous Link that redirects to its Destination', async () => {
    const links = createLinks({ db });

    const link = await links.createLink({
      destination: 'https://example.com/a/long/path?q=1',
    });

    expect(link.code).toMatch(/^[0-9A-Za-z]{7}$/);
    await expect(links.findDestination(link.code)).resolves.toBe(
      'https://example.com/a/long/path?q=1',
    );
  });

  it.each([
    'javascript:alert(1)',
    'ftp://example.com/file',
    'mailto:someone@example.com',
    'not a url',
    '',
  ])('rejects %j as a Destination', async (destination) => {
    const links = createLinks({ db });

    await expect(links.createLink({ destination })).rejects.toThrow(
      InvalidDestinationError,
    );
  });

  it('accepts http Destinations', async () => {
    const links = createLinks({ db });

    const link = await links.createLink({ destination: 'http://example.com' });

    await expect(links.findDestination(link.code)).resolves.toBe(
      'http://example.com',
    );
  });
});

describe('Code collisions', () => {
  function codes(...sequence: string[]) {
    return () => sequence.shift() ?? sequence.at(-1)!;
  }

  it('retries with a new Code when the generated Code is taken', async () => {
    await createLinks({ db, generateCode: codes('Taken01') }).createLink({
      destination: 'https://example.com/first',
    });
    const links = createLinks({
      db,
      generateCode: codes('Taken01', 'Taken01', 'Fresh01'),
    });

    const link = await links.createLink({
      destination: 'https://example.com/second',
    });

    expect(link.code).toBe('Fresh01');
    await expect(links.findDestination('Taken01')).resolves.toBe(
      'https://example.com/first',
    );
    await expect(links.findDestination('Fresh01')).resolves.toBe(
      'https://example.com/second',
    );
  });

  it('gives up with a clear error when every retry collides', async () => {
    const generateCode = () => 'Taken02';
    const links = createLinks({ db, generateCode });
    await links.createLink({ destination: 'https://example.com/first' });

    await expect(
      links.createLink({ destination: 'https://example.com/second' }),
    ).rejects.toThrow(CodeGenerationError);
  });
});

describe('findDestination', () => {
  it('finds nothing for an unknown Code', async () => {
    const links = createLinks({ db });

    await expect(links.findDestination('Zz9Zz9Z')).resolves.toBeNull();
  });
});

describe('listLinks', () => {
  it("lists only the Owner's own Links", async () => {
    const links = createLinks({ db });
    const owner = await createOwner();
    const otherOwner = await createOwner();
    const mine = await links.createLink({
      destination: 'https://example.com/mine',
      ownerId: owner,
    });
    await links.createLink({
      destination: 'https://example.com/theirs',
      ownerId: otherOwner,
    });
    await links.createLink({ destination: 'https://example.com/anonymous' });

    const listed = await links.listLinks(owner, { page: 1, limit: 10 });

    expect(listed.items.map((item) => item.code)).toEqual([mine.code]);
    expect(listed.total).toBe(1);
  });

  it("pages through the Owner's Links newest first", async () => {
    const links = createLinks({ db });
    const owner = await createOwner();
    const codes: string[] = [];
    for (const n of [1, 2, 3, 4, 5]) {
      await nextMillisecond();
      const created = await links.createLink({
        destination: `https://example.com/${n}`,
        ownerId: owner,
      });
      codes.push(created.code);
    }
    const [first, second, third, fourth, fifth] = codes;

    const pages = await Promise.all(
      [1, 2, 3].map((page) => links.listLinks(owner, { page, limit: 2 })),
    );

    expect(
      pages.map((listed) => listed.items.map((item) => item.code)),
    ).toEqual([[fifth, fourth], [third, second], [first]]);
    expect(pages[0]).toMatchObject({
      page: 1,
      limit: 2,
      total: 5,
      totalPages: 3,
    });
  });

  it('shows the last page when asked for a page past the end', async () => {
    const links = createLinks({ db });
    const owner = await createOwner();
    const codes: string[] = [];
    for (const n of [1, 2, 3]) {
      await nextMillisecond();
      const created = await links.createLink({
        destination: `https://example.com/${n}`,
        ownerId: owner,
      });
      codes.push(created.code);
    }

    const listed = await links.listLinks(owner, { page: 99, limit: 2 });

    expect(listed.items.map((item) => item.code)).toEqual([codes[0]]);
    expect(listed).toMatchObject({ page: 2, total: 3, totalPages: 2 });
  });

  it('shows page 1 with no Links when the Owner has none', async () => {
    const links = createLinks({ db });
    const owner = await createOwner();

    const listed = await links.listLinks(owner, { page: 5, limit: 2 });

    expect(listed).toMatchObject({ items: [], page: 1, total: 0 });
  });

  it.each([
    { asked: { page: 0, limit: 2 }, shown: { page: 1, limit: 2 } },
    { asked: { page: 1, limit: 61 }, shown: { page: 1, limit: 9 } },
    { asked: {}, shown: { page: 1, limit: 9 } },
  ])('lists $shown when asked for $asked', async ({ asked, shown }) => {
    const links = createLinks({ db });
    const owner = await createOwner();

    await expect(links.listLinks(owner, asked)).resolves.toMatchObject(shown);
  });
});

describe('Names', () => {
  it('gives a Link the Name its Owner chose', async () => {
    const links = createLinks({ db });
    const owner = await createOwner();

    const link = await links.createLink({
      destination: 'https://example.com/docs',
      name: '  Docs  ',
      ownerId: owner,
    });

    expect(link.name).toBe('Docs');
  });

  it('adds a numbered suffix when the Owner already has a Link with that Name', async () => {
    const links = createLinks({ db });
    const owner = await createOwner();
    const create = () =>
      links.createLink({
        destination: 'https://example.com/docs',
        name: 'Docs',
        ownerId: owner,
      });

    const names = [];
    for (let n = 0; n < 3; n++) names.push((await create()).name);

    expect(names).toEqual(['Docs', 'Docs (2)', 'Docs (3)']);
  });

  it('lets different Owners use the same Name', async () => {
    const links = createLinks({ db });
    const create = async () =>
      links.createLink({
        destination: 'https://example.com/docs',
        name: 'Shared',
        ownerId: await createOwner(),
      });

    const [first, second] = [await create(), await create()];

    expect([first.name, second.name]).toEqual(['Shared', 'Shared']);
  });

  it('leaves a Link unnamed when the Name is blank', async () => {
    const links = createLinks({ db });
    const owner = await createOwner();

    const unnamed = [
      await links.createLink({
        destination: 'https://example.com/a',
        name: '   ',
        ownerId: owner,
      }),
      await links.createLink({
        destination: 'https://example.com/b',
        ownerId: owner,
      }),
    ];

    expect(unnamed.map((link) => link.name)).toEqual([null, null]);
  });
});

describe('Name length', () => {
  it('accepts a Name of 80 characters', async () => {
    const links = createLinks({ db });
    const owner = await createOwner();

    const link = await links.createLink({
      destination: 'https://example.com',
      name: 'n'.repeat(80),
      ownerId: owner,
    });

    expect(link.name).toHaveLength(80);
  });

  it('rejects a longer Name for a new Link', async () => {
    const links = createLinks({ db });
    const owner = await createOwner();

    await expect(
      links.createLink({
        destination: 'https://example.com',
        name: 'n'.repeat(81),
        ownerId: owner,
      }),
    ).rejects.toThrow(InvalidNameError);
  });

  it('shortens a taken 80-character Name so its numbered suffix still fits', async () => {
    const links = createLinks({ db });
    const owner = await createOwner();
    const named = () =>
      links.createLink({
        destination: 'https://example.com',
        name: 'n'.repeat(80),
        ownerId: owner,
      });
    await named();

    const second = await named();
    const third = await named();

    expect(second.name).toBe(`${'n'.repeat(76)} (2)`);
    expect(third.name).toBe(`${'n'.repeat(76)} (3)`);
  });

  it('rejects a longer Name when renaming, and keeps the old Name', async () => {
    const links = createLinks({ db });
    const owner = await createOwner();
    const link = await links.createLink({
      destination: 'https://example.com',
      name: 'Short',
      ownerId: owner,
    });

    await expect(
      links.renameLink({
        ownerId: owner,
        linkId: link.id,
        name: 'n'.repeat(81),
      }),
    ).rejects.toThrow(InvalidNameError);

    const listed = await links.listLinks(owner, { page: 1, limit: 10 });
    expect(listed.items.map((item) => item.name)).toEqual(['Short']);
  });
});

describe('Anonymous Links', () => {
  it('have no Name, since only Owners name Links', async () => {
    const links = createLinks({ db });

    const link = await links.createLink({
      destination: 'https://example.com/anonymous',
      name: 'Docs',
    });

    expect(link.name).toBeNull();
  });
});

describe('searching with listLinks', () => {
  async function ownerWithLinks(
    ...created: { destination: string; name?: string }[]
  ) {
    const links = createLinks({ db });
    const owner = await createOwner();
    const made = [];
    for (const input of created) {
      made.push(await links.createLink({ ...input, ownerId: owner }));
    }
    const search = async (search: string) => {
      const listed = await links.listLinks(owner, {
        search,
        page: 1,
        limit: 10,
      });
      return listed.items.map((item) => item.destination).sort();
    };
    return { made, search };
  }

  it('matches Name, Code, and Destination, ignoring case', async () => {
    const { made, search } = await ownerWithLinks(
      { destination: 'https://example.com/recipes', name: 'Grandma Pasta' },
      { destination: 'https://docs.example.com/GUIDE' },
      { destination: 'https://example.com/other' },
    );
    const otherCode = made[2]!.code;

    await expect(search('grandma')).resolves.toEqual([
      'https://example.com/recipes',
    ]);
    await expect(search('guide')).resolves.toEqual([
      'https://docs.example.com/GUIDE',
    ]);
    await expect(search(otherCode.toLowerCase())).resolves.toEqual(
      expect.arrayContaining(['https://example.com/other']),
    );
    await expect(search('')).resolves.toHaveLength(3);
  });

  it.each(['(', '*', '.*', '%', '_', '\\'])(
    'treats %j as plain text',
    async (special) => {
      const { search } = await ownerWithLinks(
        { destination: 'https://example.com/plain' },
        {
          destination: `https://example.com/odd?q=a${encodeURI(special)}b`,
          name: `odd ${special} one`,
        },
      );

      await expect(search(special)).resolves.toEqual([
        `https://example.com/odd?q=a${encodeURI(special)}b`,
      ]);
    },
  );

  it("never finds another Owner's Links", async () => {
    const theirs = await ownerWithLinks({
      destination: 'https://example.com/secret',
      name: 'Secret',
    });
    const mine = await ownerWithLinks({
      destination: 'https://example.com/mine',
    });

    await expect(mine.search('secret')).resolves.toEqual([]);
    await expect(theirs.search('secret')).resolves.toHaveLength(1);
  });
});

describe('deleteLink', () => {
  // Regression: the old API kept redirecting Deleted Links.
  it('makes the Code lead nowhere', async () => {
    const links = createLinks({ db });
    const owner = await createOwner();
    const link = await links.createLink({
      destination: 'https://example.com/gone',
      ownerId: owner,
    });

    await links.deleteLink({ ownerId: owner, linkId: link.id });

    await expect(links.findDestination(link.code)).resolves.toBeNull();
  });

  // Regression: the old API let any signed-in User delete anyone's Link.
  it("refuses another Owner's Link the same way as a missing one", async () => {
    const links = createLinks({ db });
    const owner = await createOwner();
    const intruder = await createOwner();
    const link = await links.createLink({
      destination: 'https://example.com/not-yours',
      ownerId: owner,
    });

    await expect(
      links.deleteLink({ ownerId: intruder, linkId: link.id }),
    ).rejects.toThrow(LinkNotFoundError);
    await expect(
      links.deleteLink({ ownerId: intruder, linkId: randomUUID() }),
    ).rejects.toThrow(LinkNotFoundError);
    await expect(links.findDestination(link.code)).resolves.toBe(
      'https://example.com/not-yours',
    );
  });

  it.each(['not-a-uuid', ''])('finds no Link for the id %j', async (linkId) => {
    const links = createLinks({ db });

    await expect(
      links.deleteLink({ ownerId: await createOwner(), linkId }),
    ).rejects.toThrow(LinkNotFoundError);
  });

  it('cannot touch an Anonymous Link', async () => {
    const links = createLinks({ db });
    const link = await links.createLink({
      destination: 'https://example.com/anonymous',
    });

    await expect(
      links.deleteLink({ ownerId: await createOwner(), linkId: link.id }),
    ).rejects.toThrow(LinkNotFoundError);
  });

  it('treats an already Deleted Link as missing', async () => {
    const links = createLinks({ db });
    const owner = await createOwner();
    const link = await links.createLink({
      destination: 'https://example.com/twice',
      ownerId: owner,
    });
    await links.deleteLink({ ownerId: owner, linkId: link.id });

    await expect(
      links.deleteLink({ ownerId: owner, linkId: link.id }),
    ).rejects.toThrow(LinkNotFoundError);
  });

  it("removes the Link from the Owner's list", async () => {
    const links = createLinks({ db });
    const owner = await createOwner();
    const kept = await links.createLink({
      destination: 'https://example.com/kept',
      ownerId: owner,
    });
    const gone = await links.createLink({
      destination: 'https://example.com/gone',
      ownerId: owner,
    });

    await links.deleteLink({ ownerId: owner, linkId: gone.id });

    const listed = await links.listLinks(owner, { page: 1, limit: 10 });
    expect(listed.items.map((item) => item.code)).toEqual([kept.code]);
    expect(listed.total).toBe(1);
  });

  it('never gives its Code to a new Link', async () => {
    const owner = await createOwner();
    const deleted = await createLinks({
      db,
      generateCode: () => 'Reused1',
    }).createLink({ destination: 'https://example.com/old', ownerId: owner });
    await createLinks({ db }).deleteLink({
      ownerId: owner,
      linkId: deleted.id,
    });
    const codes = ['Reused1', 'Brand01'];
    const links = createLinks({ db, generateCode: () => codes.shift()! });

    const created = await links.createLink({
      destination: 'https://example.com/new',
    });

    expect(created.code).toBe('Brand01');
    await expect(links.findDestination('Reused1')).resolves.toBeNull();
  });
});

describe('deleteOwnerLinks', () => {
  it("makes every one of the Owner's Links lead nowhere", async () => {
    const links = createLinks({ db });
    const owner = await createOwner();
    const first = await links.createLink({
      destination: 'https://example.com/first',
      name: 'First',
      ownerId: owner,
    });
    const second = await links.createLink({
      destination: 'https://example.com/second',
      ownerId: owner,
    });

    await links.deleteOwnerLinks(owner);

    await expect(links.findDestination(first.code)).resolves.toBeNull();
    await expect(links.findDestination(second.code)).resolves.toBeNull();
    const listed = await links.listLinks(owner, { page: 1, limit: 10 });
    expect(listed.total).toBe(0);
  });

  it("leaves other Owners' Links and Anonymous Links alone", async () => {
    const links = createLinks({ db });
    const owner = await createOwner();
    const other = await createOwner();
    const theirs = await links.createLink({
      destination: 'https://example.com/theirs',
      ownerId: other,
    });
    const anonymous = await links.createLink({
      destination: 'https://example.com/anonymous',
    });
    await links.createLink({
      destination: 'https://example.com/mine',
      ownerId: owner,
    });

    await links.deleteOwnerLinks(owner);

    await expect(links.findDestination(theirs.code)).resolves.toBe(
      'https://example.com/theirs',
    );
    await expect(links.findDestination(anonymous.code)).resolves.toBe(
      'https://example.com/anonymous',
    );
  });

  it('keeps the Codes leading nowhere after the User is removed', async () => {
    const owner = await createOwner();
    const link = await createLinks({
      db,
      generateCode: () => 'Gone001',
    }).createLink({ destination: 'https://example.com/old', ownerId: owner });
    const codes = ['Gone001', 'Spare01'];
    const links = createLinks({ db, generateCode: () => codes.shift()! });

    await links.deleteOwnerLinks(owner);
    // What Better Auth does next when a User deletes their User.
    await db.delete(schema.user).where(eq(schema.user.id, owner));

    await expect(links.findDestination(link.code)).resolves.toBeNull();
    const created = await links.createLink({
      destination: 'https://example.com/new',
    });
    expect(created.code).toBe('Spare01');
  });
});

describe('renameLink', () => {
  it('gives the Link its new Name and keeps its Destination', async () => {
    const links = createLinks({ db });
    const owner = await createOwner();
    const link = await links.createLink({
      destination: 'https://example.com/fixed',
      name: 'Old',
      ownerId: owner,
    });

    const renamed = await links.renameLink({
      ownerId: owner,
      linkId: link.id,
      name: '  New  ',
    });

    expect(renamed).toMatchObject({
      code: link.code,
      name: 'New',
      destination: 'https://example.com/fixed',
    });
    await expect(links.findDestination(link.code)).resolves.toBe(
      'https://example.com/fixed',
    );
  });

  it("adds a numbered suffix when another of the Owner's Links has that Name", async () => {
    const links = createLinks({ db });
    const owner = await createOwner();
    const create = (name: string) =>
      links.createLink({
        destination: 'https://example.com/docs',
        name,
        ownerId: owner,
      });
    await create('Docs');
    await create('Docs (2)');
    const notes = await create('Notes');

    const renamed = await links.renameLink({
      ownerId: owner,
      linkId: notes.id,
      name: 'Docs',
    });

    expect(renamed.name).toBe('Docs (3)');
  });

  it('gives two Links renamed to the same Name at once different Names', async () => {
    const links = createLinks({ db });
    const owner = await createOwner();
    const create = (name: string) =>
      links.createLink({
        destination: 'https://example.com/docs',
        name,
        ownerId: owner,
      });
    const [first, second] = [await create('A'), await create('B')];

    const renamed = await Promise.all(
      [first, second].map((link) =>
        links.renameLink({ ownerId: owner, linkId: link.id, name: 'Docs' }),
      ),
    );

    expect(renamed.map((link) => link.name).sort()).toEqual([
      'Docs',
      'Docs (2)',
    ]);
  });

  it('keeps the Name when it is renamed to its own Name', async () => {
    const links = createLinks({ db });
    const owner = await createOwner();
    const create = () =>
      links.createLink({
        destination: 'https://example.com/docs',
        name: 'Docs',
        ownerId: owner,
      });
    await create();
    const second = await create();

    const renamed = await links.renameLink({
      ownerId: owner,
      linkId: second.id,
      name: 'Docs (2)',
    });

    expect(renamed.name).toBe('Docs (2)');
  });

  it('reuses the Name of a Deleted Link', async () => {
    const links = createLinks({ db });
    const owner = await createOwner();
    const deleted = await links.createLink({
      destination: 'https://example.com/old',
      name: 'Docs',
      ownerId: owner,
    });
    await links.deleteLink({ ownerId: owner, linkId: deleted.id });
    const link = await links.createLink({
      destination: 'https://example.com/new',
      ownerId: owner,
    });

    const renamed = await links.renameLink({
      ownerId: owner,
      linkId: link.id,
      name: 'Docs',
    });

    expect(renamed.name).toBe('Docs');
  });

  it('leaves the Link unnamed when the Name is blank', async () => {
    const links = createLinks({ db });
    const owner = await createOwner();
    const link = await links.createLink({
      destination: 'https://example.com/named',
      name: 'Named',
      ownerId: owner,
    });

    const renamed = await links.renameLink({
      ownerId: owner,
      linkId: link.id,
      name: '   ',
    });

    expect(renamed.name).toBeNull();
  });

  // Regression: the old API let any signed-in User rename anyone's Link.
  it("refuses another Owner's Link the same way as a missing one", async () => {
    const links = createLinks({ db });
    const owner = await createOwner();
    const intruder = await createOwner();
    const link = await links.createLink({
      destination: 'https://example.com/not-yours',
      name: 'Mine',
      ownerId: owner,
    });

    await expect(
      links.renameLink({ ownerId: intruder, linkId: link.id, name: 'Taken' }),
    ).rejects.toThrow(LinkNotFoundError);
    await expect(
      links.renameLink({
        ownerId: intruder,
        linkId: randomUUID(),
        name: 'Taken',
      }),
    ).rejects.toThrow(LinkNotFoundError);
    const listed = await links.listLinks(owner, { page: 1, limit: 10 });
    expect(listed.items.map((item) => item.name)).toEqual(['Mine']);
  });

  it('cannot rename an Anonymous Link, a Deleted Link, or a malformed id', async () => {
    const links = createLinks({ db });
    const owner = await createOwner();
    const anonymous = await links.createLink({
      destination: 'https://example.com/anonymous',
    });
    const deleted = await links.createLink({
      destination: 'https://example.com/deleted',
      ownerId: owner,
    });
    await links.deleteLink({ ownerId: owner, linkId: deleted.id });

    for (const linkId of [anonymous.id, deleted.id, 'not-a-uuid']) {
      await expect(
        links.renameLink({ ownerId: owner, linkId, name: 'New' }),
      ).rejects.toThrow(LinkNotFoundError);
    }
  });
});
