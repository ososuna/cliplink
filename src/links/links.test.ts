import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { schema, type Db } from '@/db';
import { createTestDb } from '@/db/testing';
import {
  CodeGenerationError,
  InvalidDestinationError,
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
      [1, 2, 3, 4].map((page) => links.listLinks(owner, { page, limit: 2 })),
    );

    expect(
      pages.map((listed) => listed.items.map((item) => item.code)),
    ).toEqual([[fifth, fourth], [third, second], [first], []]);
    expect(pages[0]).toMatchObject({
      page: 1,
      limit: 2,
      total: 5,
      totalPages: 3,
    });
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
