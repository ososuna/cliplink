import { z } from 'astro/zod';

export const userNameMaxLength = 60;

/** A User's name, shared by the My Account form and its Action. */
export const userNameSchema = z
  .string()
  .trim()
  .min(1, 'Enter your name.')
  .max(userNameMaxLength, `Use at most ${userNameMaxLength} characters.`);
