import { z } from 'astro/zod';

export const destinationMessage = 'Enter a valid http or https URL.';

/** Shared by the Links module, Actions, and forms so every edge rejects the same Destinations. */
export const destinationSchema = z
  .string()
  .trim()
  .pipe(z.url({ protocol: /^https?$/, message: destinationMessage }));

export class InvalidDestinationError extends Error {
  constructor() {
    super(destinationMessage);
    this.name = 'InvalidDestinationError';
  }
}

export function parseDestination(destination: string): string {
  const parsed = destinationSchema.safeParse(destination);
  if (!parsed.success) throw new InvalidDestinationError();
  return parsed.data;
}
