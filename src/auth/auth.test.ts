import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createAuth, type Auth } from '@/auth/auth';
import { createTestDb } from '@/db/testing';

const baseURL = 'http://localhost:4321';

type ProviderProfile = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  avatar: string;
};

function unsignedJwt(claims: Record<string, unknown>) {
  const encode = (part: object) =>
    Buffer.from(JSON.stringify(part)).toString('base64url');
  return `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode(claims)}.signature`;
}

/** Stands in for Google's and GitHub's servers: the only thing faked in these tests. */
function fakeProviders(profiles: {
  google?: ProviderProfile;
  github?: ProviderProfile;
}) {
  const json = (body: unknown) =>
    new Response(JSON.stringify(body), {
      headers: { 'content-type': 'application/json' },
    });
  const realFetch = globalThis.fetch;

  vi.stubGlobal(
    'fetch',
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input);
      const { google, github } = profiles;
      if (url.href === 'https://oauth2.googleapis.com/token' && google) {
        return json({
          access_token: 'google-access',
          token_type: 'Bearer',
          expires_in: 3600,
          id_token: unsignedJwt({
            iss: 'https://accounts.google.com',
            sub: google.id,
            name: google.name,
            email: google.email,
            email_verified: google.emailVerified,
            picture: google.avatar,
          }),
        });
      }
      if (
        url.href === 'https://github.com/login/oauth/access_token' &&
        github
      ) {
        return json({ access_token: 'github-access', token_type: 'bearer' });
      }
      if (url.href === 'https://api.github.com/user' && github) {
        return json({
          id: Number(github.id),
          login: 'octocat',
          name: github.name,
          email: github.email,
          avatar_url: github.avatar,
        });
      }
      if (url.href === 'https://api.github.com/user/emails' && github) {
        return json([
          {
            email: github.email,
            primary: true,
            verified: github.emailVerified,
          },
        ]);
      }
      return realFetch(input, init);
    },
  );
}

function cookieHeader(response: Response) {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
}

async function startSignIn(auth: Auth, provider: 'google' | 'github') {
  const response = await auth.handler(
    new Request(`${baseURL}/api/auth/sign-in/social`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: baseURL },
      body: JSON.stringify({
        provider,
        callbackURL: '/dashboard',
        errorCallbackURL: '/auth/login',
      }),
    }),
  );
  const { url } = (await response.json()) as { url: string };
  return { authorizationURL: new URL(url), cookies: cookieHeader(response) };
}

/** Walks the browser's side of the OAuth round trip: start, then come back from the Provider. */
async function returnFromProvider(
  auth: Auth,
  provider: 'google' | 'github',
  callback: { code: string } | { error: string },
) {
  const { authorizationURL, cookies } = await startSignIn(auth, provider);
  const params = new URLSearchParams({
    ...callback,
    state: authorizationURL.searchParams.get('state') ?? '',
  });
  const response = await auth.handler(
    new Request(`${baseURL}/api/auth/callback/${provider}?${params}`, {
      headers: { cookie: cookies },
    }),
  );
  return {
    location: new URL(response.headers.get('location') ?? '', baseURL),
    cookies: cookieHeader(response),
  };
}

function signInWith(auth: Auth, provider: 'google' | 'github') {
  return returnFromProvider(auth, provider, { code: 'provider-code' });
}

async function signedInUser(auth: Auth, cookies: string) {
  const headers = new Headers({ cookie: cookies });
  const session = await auth.api.getSession({ headers });
  const accounts = session ? await auth.api.listUserAccounts({ headers }) : [];
  return {
    user: session?.user ?? null,
    providers: accounts.map((account) => account.providerId).sort(),
  };
}

const ada = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  avatar: 'https://avatars.example.com/ada.png',
};

describe('sign-in with Google and GitHub', () => {
  let auth: Auth;

  beforeAll(async () => {
    auth = createAuth({
      db: await createTestDb(),
      baseURL,
      secret: 'test-secret-at-least-thirty-two-characters-long',
      google: { clientId: 'google-client', clientSecret: 'google-secret' },
      github: { clientId: 'github-client', clientSecret: 'github-secret' },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('asks GitHub for the email scope', async () => {
    const { authorizationURL } = await startSignIn(auth, 'github');

    expect(authorizationURL.origin).toBe('https://github.com');
    expect(authorizationURL.searchParams.get('scope')?.split(' ')).toContain(
      'user:email',
    );
  });

  it('signs a new User in with GitHub and sends them to the dashboard', async () => {
    fakeProviders({
      github: { id: '1001', emailVerified: true, ...ada },
    });

    const { location, cookies } = await signInWith(auth, 'github');
    const { user, providers } = await signedInUser(auth, cookies);

    expect(location.pathname).toBe('/dashboard');
    expect(user).toMatchObject({
      name: ada.name,
      email: ada.email,
      image: ada.avatar,
    });
    expect(providers).toEqual(['github']);
  });

  it('joins a Google sign-in with the same verified email to the existing User', async () => {
    fakeProviders({
      github: { id: '1001', emailVerified: true, ...ada },
      google: { id: 'google-ada', emailVerified: true, ...ada },
    });
    const viaGitHub = await signInWith(auth, 'github');
    const viaGoogle = await signInWith(auth, 'google');

    const first = await signedInUser(auth, viaGitHub.cookies);
    const second = await signedInUser(auth, viaGoogle.cookies);

    expect(viaGoogle.location.pathname).toBe('/dashboard');
    expect(second.user?.id).toBe(first.user?.id);
    expect(second.providers).toEqual(['github', 'google']);
  });

  it('never links a same-email sign-in whose email the Provider has not verified', async () => {
    const grace = { ...ada, email: 'grace@example.com', name: 'Grace Hopper' };
    fakeProviders({
      google: { id: 'google-grace', emailVerified: true, ...grace },
      github: { id: '2002', emailVerified: false, ...grace },
    });
    const viaGoogle = await signInWith(auth, 'google');

    const viaGitHub = await signInWith(auth, 'github');

    expect(viaGitHub.location.pathname).toBe('/auth/login');
    expect(viaGitHub.location.searchParams.get('error')).toBe(
      'account_not_linked',
    );
    expect(await signedInUser(auth, viaGitHub.cookies)).toEqual({
      user: null,
      providers: [],
    });
    expect((await signedInUser(auth, viaGoogle.cookies)).providers).toEqual([
      'google',
    ]);
  });

  it('sends a Visitor who cancels at the Provider back to sign-in with the reason', async () => {
    const { location } = await returnFromProvider(auth, 'google', {
      error: 'access_denied',
    });

    expect(location.pathname).toBe('/auth/login');
    expect(location.searchParams.get('error')).toBe('access_denied');
  });
});
