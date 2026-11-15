import { expect, test } from '@playwright/test';
import { signIn } from './support/session';

for (const privatePage of ['/dashboard', '/my-account']) {
  test(`a Visitor opening ${privatePage} is sent to sign in`, async ({
    page,
  }) => {
    await page.goto(privatePage);

    await expect(page).toHaveURL('/auth/login');
    await expect(
      page.getByRole('heading', { name: 'Log in to your account' }),
    ).toBeVisible();
  });
}

test('a signed-in User opening the home page lands on the dashboard', async ({
  context,
  page,
}) => {
  await signIn(context);

  await page.goto('/');

  await expect(page).toHaveURL('/dashboard');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});

test('My Account shows the name, email, and avatar from the Provider', async ({
  context,
  page,
}) => {
  const user = await signIn(context, {
    name: 'Ada Lovelace',
    image: '/favicon.svg',
  });

  await page.goto('/my-account');

  await expect(page.getByText('Ada Lovelace')).toBeVisible();
  await expect(page.getByText(user.email)).toBeVisible();
  await expect(page.getByRole('img', { name: 'Ada Lovelace' })).toHaveAttribute(
    'src',
    '/favicon.svg',
  );
});

test('signing out ends the session', async ({ context, page }) => {
  await signIn(context, { name: 'Ada Lovelace' });
  await page.goto('/dashboard');
  const sessionCookies = await context.cookies();

  await page.getByRole('button', { name: 'Ada Lovelace' }).click();
  await page.getByRole('menuitem', { name: 'Log out' }).click();

  await expect(page).toHaveURL('/');
  await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();

  // Replaying the old cookie proves the session is gone from the database, not just the browser.
  await context.addCookies(sessionCookies);
  await page.goto('/dashboard');
  await expect(page).toHaveURL('/auth/login');
});

test('each sign-in button starts that Provider sign-in', async ({ page }) => {
  await page.route(
    /^https:\/\/(github\.com|accounts\.google\.com)\//,
    (route) => route.fulfill({ body: 'Provider sign-in page' }),
  );
  await page.goto('/auth/login');

  await page.getByRole('button', { name: 'Continue with GitHub' }).click();
  await expect(page).toHaveURL(
    /^https:\/\/github\.com\/login\/oauth\/authorize/,
  );

  await page.goto('/auth/login');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await expect(page).toHaveURL(/^https:\/\/accounts\.google\.com\//);
});

const providerErrors = [
  { error: 'access_denied', message: 'Sign-in was cancelled.' },
  {
    error: 'account_not_linked',
    message: 'this Provider has not verified it',
  },
  { error: 'state_mismatch', message: 'Sign-in failed.' },
];

for (const { error, message } of providerErrors) {
  test(`a Provider sign-in that fails with ${error} returns to sign in with a message`, async ({
    page,
  }) => {
    await page.goto(`/auth/login?error=${error}`);

    await expect(page.getByRole('alert')).toContainText(message);
  });
}

test('a Provider error reaching the auth endpoint lands on the sign-in page', async ({
  page,
}) => {
  await page.goto('/api/auth/callback/github?error=access_denied');

  await expect(page).toHaveURL(/\/auth\/login\?error=/);
  await expect(page.getByRole('alert')).toBeVisible();
});
