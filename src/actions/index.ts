import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import { links } from '@/app';
import {
  CodeGenerationError,
  destinationSchema,
  InvalidDestinationError,
} from '@/links';

export const server = {
  links: {
    create: defineAction({
      input: z.object({ destination: destinationSchema }),
      handler: async ({ destination }) => {
        try {
          const link = await links.createLink({ destination });
          return { code: link.code };
        } catch (error) {
          if (error instanceof InvalidDestinationError) {
            throw new ActionError({
              code: 'BAD_REQUEST',
              message: error.message,
            });
          }
          if (error instanceof CodeGenerationError) {
            throw new ActionError({
              code: 'SERVICE_UNAVAILABLE',
              message: error.message,
            });
          }
          throw error;
        }
      },
    }),
  },
};
