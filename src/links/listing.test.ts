import { describe, expect, it } from 'vitest';
import { listingFromQuery, listingHref } from '@/links/listing';

describe('listingFromQuery', () => {
  it.each([
    { query: '', listing: { page: 1, limit: 9, search: '' } },
    {
      query: 'page=3&limit=20&search=docs',
      listing: { page: 3, limit: 20, search: 'docs' },
    },
    { query: 'page=abc', listing: { page: 1, limit: 9, search: '' } },
    { query: 'page=0', listing: { page: 1, limit: 9, search: '' } },
    { query: 'page=-2', listing: { page: 1, limit: 9, search: '' } },
    { query: 'page=2.5', listing: { page: 1, limit: 9, search: '' } },
    { query: 'page=', listing: { page: 1, limit: 9, search: '' } },
    { query: 'limit=60', listing: { page: 1, limit: 60, search: '' } },
    { query: 'limit=61', listing: { page: 1, limit: 9, search: '' } },
    { query: 'limit=0', listing: { page: 1, limit: 9, search: '' } },
    { query: 'limit=lots', listing: { page: 1, limit: 9, search: '' } },
    {
      query: 'search=%20docs%20',
      listing: { page: 1, limit: 9, search: 'docs' },
    },
  ])('reads "$query" as $listing', ({ query, listing }) => {
    expect(listingFromQuery(new URLSearchParams(query))).toEqual(listing);
  });
});

describe('listingHref', () => {
  it.each([
    { listing: {}, href: '/dashboard' },
    { listing: { page: 1, limit: 9, search: '' }, href: '/dashboard' },
    { listing: { page: 2 }, href: '/dashboard?page=2' },
    { listing: { limit: 20 }, href: '/dashboard?limit=20' },
    { listing: { search: 'a b&c' }, href: '/dashboard?search=a+b%26c' },
    {
      listing: { page: 2, limit: 20, search: 'docs' },
      href: '/dashboard?page=2&limit=20&search=docs',
    },
  ])('links to $href for $listing', ({ listing, href }) => {
    expect(listingHref(listing)).toBe(href);
  });

  it('round-trips through listingFromQuery', () => {
    const listing = { page: 4, limit: 30, search: 'a b&c' };

    const { search } = new URL(listingHref(listing), 'https://cliplink.test');

    expect(listingFromQuery(new URLSearchParams(search))).toEqual(listing);
  });
});
