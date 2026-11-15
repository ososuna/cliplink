import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { createDb } from '@/db';
import { createLinks } from '@/links';
import { e2eEnv } from './support/env';
import { signIn } from './support/session';

const links = createLinks({ db: createDb(e2eEnv.DATABASE_URL) });

async function shorten(
  page: Page,
  link: { destination: string; name?: string },
) {
  await page.getByRole('button', { name: 'Shorten URL' }).click();
  const dialog = page.getByRole('dialog', { name: 'Shorten URL' });
  if (link.name) await dialog.getByLabel('Name (Optional)').fill(link.name);
  await dialog.getByLabel('Long URL').fill(link.destination);
  await dialog.getByRole('button', { name: 'Shorten URL' }).click();
  await expect(dialog).toBeHidden();
}

const linkCards = (page: Page) => page.getByRole('article');

test('an Owner creates Links, finds them, and copies one', async ({
  page,
  context,
  baseURL,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await signIn(context);
  const run = randomUUID();
  await page.goto('/dashboard');
  await expect(
    page.getByText("You haven't shortened any URLs yet"),
  ).toBeVisible();

  await shorten(page, {
    destination: `https://example.com/docs/${run}`,
    name: 'Docs',
  });
  await shorten(page, {
    destination: `https://example.com/more-docs/${run}`,
    name: 'Docs',
  });
  await shorten(page, { destination: `https://example.com/(odd)/${run}` });

  await expect(linkCards(page)).toHaveCount(3);
  const newest = linkCards(page).first();
  await expect(newest).toContainText(`https://example.com/(odd)/${run}`);
  await expect(linkCards(page).getByRole('heading')).toHaveText([
    /^\/[0-9A-Za-z]{7}$/,
    'Docs (2)',
    'Docs',
  ]);

  const search = page.getByPlaceholder('Search URLs...');
  await search.fill('DOCS (2');
  await expect(linkCards(page).getByRole('heading')).toHaveText(['Docs (2)']);

  await search.fill('(odd)');
  const odd = linkCards(page);
  await expect(odd.getByRole('heading')).toHaveText([/^\/[0-9A-Za-z]{7}$/]);
  // An unnamed Link is titled by its path.
  const code = (await odd.getByRole('heading').innerText()).slice(1);

  await odd.getByRole('button', { name: 'Copy' }).click();
  await expect(odd.getByRole('button', { name: 'Copied' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    `${baseURL}/${code}`,
  );

  await search.fill('nothing like this');
  await expect(page.getByText('No URLs found matching')).toBeVisible();
});

test("an Owner never sees another User's Links", async ({ page, context }) => {
  const other = await signIn(context);
  await links.createLink({
    destination: 'https://example.com/someone-else',
    name: 'Not yours',
    ownerId: other.id,
  });
  await context.clearCookies();

  await signIn(context);
  await page.goto('/dashboard');

  await expect(
    page.getByText("You haven't shortened any URLs yet"),
  ).toBeVisible();
  await expect(page.getByText('Not yours')).toBeHidden();
});

test('the dashboard pages through Links, newest first', async ({
  page,
  context,
}) => {
  const owner = await signIn(context);
  for (let n = 1; n <= 11; n++) {
    await links.createLink({
      destination: `https://example.com/page-test/${n}`,
      name: `Link ${n}`,
      ownerId: owner.id,
    });
  }

  await page.goto('/dashboard');
  await expect(linkCards(page)).toHaveCount(9);
  await expect(linkCards(page).first().getByRole('heading')).toHaveText(
    'Link 11',
  );

  await page.getByRole('link', { name: 'Go to next page' }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(linkCards(page).getByRole('heading')).toHaveText([
    'Link 2',
    'Link 1',
  ]);
  // On the last page, Next is no longer a link.
  await expect(page.getByLabel('Go to next page')).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await expect(page.getByRole('link', { name: 'Go to next page' })).toHaveCount(
    0,
  );
});
