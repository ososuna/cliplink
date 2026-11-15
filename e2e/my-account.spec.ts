import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { createDb, schema } from '@/db';
import { createLinks } from '@/links';
import { e2eEnv } from './support/env';
import { signIn } from './support/session';

const db = createDb(e2eEnv.DATABASE_URL);
const links = createLinks({ db });

test('My Account lists the connected Providers and shows the email read-only', async ({
  context,
  page,
}) => {
  const user = await signIn(context, { providers: ['github', 'google'] });

  await page.goto('/my-account');

  const providers = page.getByRole('list', { name: 'Connected Providers' });
  await expect(providers.getByRole('listitem')).toHaveText([
    'GitHub',
    'Google',
  ]);
  const email = page.getByLabel('Email');
  await expect(email).toHaveValue(user.email);
  await expect(email).not.toBeEditable();
});

test('a User renames their User, then deletes it, and their Links show the 404 page', async ({
  context,
  page,
}) => {
  const user = await signIn(context, { name: 'Ada Lovelace' });
  const run = randomUUID();
  const owned = await Promise.all(
    ['first', 'second'].map((path) =>
      links.createLink({
        destination: `https://example.com/${path}/${run}`,
        ownerId: user.id,
      }),
    ),
  );
  await page.goto('/my-account');

  await page.getByLabel('Name').fill('Ada King');
  await page.getByRole('button', { name: 'Update Profile' }).click();
  // The page reloads, so the navbar shows the new name too.
  await expect(page.getByRole('button', { name: 'Ada King' })).toBeVisible();
  await expect(page.getByLabel('Name')).toHaveValue('Ada King');

  const sessionCookies = await context.cookies();
  await page.getByRole('button', { name: 'Delete Account' }).click();
  const confirm = page.getByRole('dialog', {
    name: 'Are you absolutely sure?',
  });
  const deleteButton = confirm.getByRole('button', { name: 'Delete Account' });
  await expect(deleteButton).toBeDisabled();
  await confirm
    .getByLabel('Type "Delete my account" to confirm')
    .fill('delete');
  await expect(deleteButton).toBeDisabled();
  await confirm
    .getByLabel('Type "Delete my account" to confirm')
    .fill('Delete my account');
  await deleteButton.click();

  await expect(page).toHaveURL('/');
  await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
  // Replaying the old cookie proves the session is gone from the database, not just the browser.
  await context.addCookies(sessionCookies);
  await page.goto('/my-account');
  await expect(page).toHaveURL('/auth/login');

  for (const link of owned) {
    const response = await page.goto(`/${link.code}`);
    expect(response?.status()).toBe(404);
    await expect(page.getByText('Page not found')).toBeVisible();
  }
  // Nothing in the app can look a User up, so check the rows themselves.
  const leftovers = await Promise.all([
    db.select().from(schema.user).where(eq(schema.user.id, user.id)),
    db.select().from(schema.account).where(eq(schema.account.userId, user.id)),
  ]);
  expect(leftovers).toEqual([[], []]);
});

test("no auth route lists Users or shows another User's data", async ({
  context,
}) => {
  const other = await signIn(context, { providers: ['google'] });
  await context.clearCookies();
  const me = await signIn(context, { providers: ['github'] });

  const session = await context.request.get('/api/auth/get-session');
  expect((await session.json()).user.id).toBe(me.id);
  const accounts = await context.request.get(
    `/api/auth/list-accounts?userId=${other.id}`,
  );
  expect(
    (await accounts.json()).map(
      (account: { providerId: string }) => account.providerId,
    ),
  ).toEqual(['github']);

  // The admin plugin's endpoints, and Better Auth's unvalidated profile update, stay off.
  const missing = await Promise.all([
    context.request.get('/api/auth/admin/list-users'),
    context.request.get(`/api/auth/admin/get-user?id=${other.id}`),
    context.request.post('/api/auth/update-user', {
      data: { name: 'Unchecked' },
      headers: { origin: e2eEnv.BETTER_AUTH_URL },
    }),
  ]);
  expect(missing.map((response) => response.status())).toEqual([404, 404, 404]);
});
