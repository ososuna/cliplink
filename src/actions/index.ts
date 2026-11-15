import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import { links } from '@/app';
import {
  CodeGenerationError,
  destinationSchema,
  InvalidDestinationError,
  nameSchema,
} from '@/links';

export const server = {
  links: {
    create: defineAction({
      input: z.object({ destination: destinationSchema, name: nameSchema }),
      handler: async ({ destination, name }, context) => {
        try {
          // Signed in, the User becomes the Owner. Otherwise this is an Anonymous Link.
          const link = await links.createLink({
            destination,
            name,
            ownerId: context.locals.user?.id,
          });
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
