import { defineMiddleware } from 'astro:middleware';
import { auth } from '@/app';
import { signInPath } from '@/auth';

const privatePaths = ['/dashboard', '/my-account'];

function isUnder(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(`${path}/`);
}

export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.user = null;
  context.locals.session = null;

  // Prerendered pages have no request headers, and Better Auth reads its own cookie.
  if (context.isPrerendered || isUnder(context.url.pathname, '/api/auth')) {
    return next();
  }

  const signedIn = await auth.api.getSession({
    headers: context.request.headers,
  });
  context.locals.user = signedIn?.user ?? null;
  context.locals.session = signedIn?.session ?? null;

  const { pathname } = context.url;
  if (!signedIn && privatePaths.some((path) => isUnder(pathname, path))) {
    return context.redirect(signInPath);
  }
  if (signedIn && (pathname === '/' || pathname === signInPath)) {
    return context.redirect('/dashboard');
  }
  return next();
});
