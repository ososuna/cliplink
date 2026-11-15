import { beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '@/db';
import { createTestDb } from '@/db/testing';
import {
  CodeGenerationError,
  InvalidDestinationError,
  createLinks,
} from '@/links';

let db: Db;

beforeAll(async () => {
  db = await createTestDb();
});

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
