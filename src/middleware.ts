import { defineMiddleware } from 'astro:middleware';
import { auth } from '@/app';
import { dashboardPath, signInPath } from '@/paths';

const privatePaths = [dashboardPath, '/my-account'];

// src/pages/[code].astro: a Redirect needs no User, so it skips the session lookup.
const redirectRoute = '/[code]';

function isUnder(opts: { pathname: string; path: string }) {
  const { pathname, path } = opts;
  return pathname === path || pathname.startsWith(`${path}/`);
}

export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.user = null;
  context.locals.session = null;

  const { pathname } = context.url;
  // Prerendered pages have no request headers, and Better Auth reads its own cookie.
  if (
    context.isPrerendered ||
    context.routePattern === redirectRoute ||
    isUnder({ pathname, path: '/api/auth' })
  ) {
    return next();
  }

  const signedIn = await auth.api.getSession({
    headers: context.request.headers,
  });
  context.locals.user = signedIn?.user ?? null;
  context.locals.session = signedIn?.session ?? null;

  if (!signedIn && privatePaths.some((path) => isUnder({ pathname, path }))) {
    return context.redirect(signInPath);
  }
  if (signedIn && (pathname === '/' || pathname === signInPath)) {
    return context.redirect(dashboardPath);
  }
  return next();
});
