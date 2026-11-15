import { ActionError, actions, getActionPath } from 'astro:actions';
import { parse } from 'devalue';
import { fallbackMessage } from '@/components/form';

const rateLimitMessage = 'Too many Links too fast. Try again in a minute.';

const failed = () =>
  new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: fallbackMessage });

type Input = Parameters<typeof actions.links.create>[0];

/**
 * Calls the links.create Action. Vercel's firewall rate limits it with a bare 429 that
 * isn't an Action response, and `actions.links.create` reports that as a generic 500,
 * so this reads the status itself. The rest mirrors what Astro's client does.
 */
export async function createLink(
  input: Input,
): Promise<
  | { data: { code: string }; error?: never }
  | { data?: never; error: ActionError }
> {
  let response: Response;
  try {
    response = await fetch(getActionPath(actions.links.create), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });
  } catch {
    return { error: failed() };
  }
  if (response.status === 429) {
    return {
      error: new ActionError({
        code: 'TOO_MANY_REQUESTS',
        message: rateLimitMessage,
      }),
    };
  }
  const body = await response.text();
  try {
    if (response.ok) return { data: parse(body) };
    return { error: ActionError.fromJson(JSON.parse(body)) };
  } catch {
    return { error: failed() };
  }
}
