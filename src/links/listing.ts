import { z } from 'astro/zod';
import { dashboardPath } from '@/paths';

const defaultLimit = 9;
const maxLimit = 60;

// A bad value falls back to its default rather than failing the dashboard.
const listingSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  limit: z.coerce.number().int().min(1).max(maxLimit).catch(defaultLimit),
  search: z.string().trim().catch(''),
});

/** Which of an Owner's Links to show: always a valid page, limit, and search. */
export type Listing = z.infer<typeof listingSchema>;

export function parseListing(asked: {
  page?: unknown;
  limit?: unknown;
  search?: unknown;
}): Listing {
  return listingSchema.parse(asked);
}

export function listingFromQuery(query: URLSearchParams): Listing {
  return parseListing(Object.fromEntries(query));
}

/** Defaults stay out of the URL, so the plain dashboard path is the first page. */
export function listingHref(listing: Partial<Listing>): string {
  const { page, limit, search } = parseListing(listing);
  const query = new URLSearchParams();
  if (page !== 1) query.set('page', String(page));
  if (limit !== defaultLimit) query.set('limit', String(limit));
  if (search) query.set('search', search);
  return query.size ? `${dashboardPath}?${query}` : dashboardPath;
}
