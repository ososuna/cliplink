import { z } from 'astro/zod';

export const nameMaxLength = 80;

export const nameMessage = `Use at most ${nameMaxLength} characters.`;

/** Shared by the Links module, Actions, and forms so every edge accepts the same Names. Blank means no Name. */
export const nameSchema = z
  .string()
  .trim()
  .max(nameMaxLength, nameMessage)
  .optional();

export class InvalidNameError extends Error {
  constructor() {
    super(nameMessage);
    this.name = 'InvalidNameError';
  }
}

export function parseName(name: string | undefined): string | null {
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) throw new InvalidNameError();
  return parsed.data || null;
}
