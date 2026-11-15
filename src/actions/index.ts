import {
  ActionError,
  defineAction,
  type ActionAPIContext,
} from 'astro:actions';
import { z } from 'astro/zod';
import { links } from '@/app';
import {
  CodeGenerationError,
  destinationSchema,
  InvalidDestinationError,
  LinkNotFoundError,
  nameSchema,
} from '@/links';

function signedInUser(context: ActionAPIContext) {
  const { user } = context.locals;
  if (!user) {
    throw new ActionError({
      code: 'UNAUTHORIZED',
      message: 'Sign in to manage your Links.',
    });
  }
  return user;
}

function rethrowNotFound(error: unknown): never {
  if (error instanceof LinkNotFoundError) {
    throw new ActionError({ code: 'NOT_FOUND', message: error.message });
  }
  throw error;
}

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
    rename: defineAction({
      input: z.object({ linkId: z.string(), name: nameSchema }),
      handler: async ({ linkId, name }, context) => {
        const owner = signedInUser(context);
        try {
          const link = await links.renameLink({
            ownerId: owner.id,
            linkId,
            name: name ?? '',
          });
          return { name: link.name };
        } catch (error) {
          rethrowNotFound(error);
        }
      },
    }),
    delete: defineAction({
      input: z.object({ linkId: z.string() }),
      handler: async ({ linkId }, context) => {
        const owner = signedInUser(context);
        try {
          await links.deleteLink({ ownerId: owner.id, linkId });
        } catch (error) {
          rethrowNotFound(error);
        }
      },
    }),
  },
};
