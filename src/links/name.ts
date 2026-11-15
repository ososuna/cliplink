import { z } from 'astro/zod';

export const nameMaxLength = 80;

/** Shared by Actions and forms. Blank means no Name. */
export const nameSchema = z
  .string()
  .trim()
  .max(nameMaxLength, `Use at most ${nameMaxLength} characters.`)
  .optional();
