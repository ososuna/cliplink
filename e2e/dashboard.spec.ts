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
    page.getByText("You haven't created any Links yet"),
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

  const search = page.getByPlaceholder('Search Links...');
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
  await expect(page.getByText('No Links found matching')).toBeVisible();
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
    page.getByText("You haven't created any Links yet"),
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

test('an Owner renames and deletes a Link, and its Code then shows the 404 page', async ({
  page,
  context,
}) => {
  const owner = await signIn(context);
  const run = randomUUID();
  await links.createLink({
    destination: `https://example.com/kept/${run}`,
    name: 'Docs',
    ownerId: owner.id,
  });
  const link = await links.createLink({
    destination: `https://example.com/renamed/${run}`,
    name: 'Draft',
    ownerId: owner.id,
  });
  await page.goto('/dashboard');
  const card = linkCards(page).filter({ hasText: `/renamed/${run}` });

  await card.getByRole('button', { name: 'Rename' }).click();
  const rename = page.getByRole('dialog', { name: 'Rename Link' });
  // A Destination is fixed at creation, so the dialog only offers the Name.
  await expect(rename.getByRole('textbox')).toHaveCount(1);
  await expect(rename.getByLabel('Name')).toHaveValue('Draft');
  await rename.getByLabel('Name').fill('Docs');
  await rename.getByRole('button', { name: 'Rename' }).click();
  await expect(rename).toBeHidden();
  await expect(card.getByRole('heading')).toHaveText('Docs (2)');
  await expect(card).toContainText(`https://example.com/renamed/${run}`);

  await card.getByRole('button', { name: 'Delete' }).click();
  const confirm = page.getByRole('dialog', {
    name: 'Are you sure you want to delete this Link?',
  });
  await confirm.getByRole('button', { name: 'Delete Link' }).click();
  await expect(confirm).toBeHidden();
  await expect(card).toHaveCount(0);
  await expect(linkCards(page).getByRole('heading')).toHaveText(['Docs']);

  const response = await page.goto(`/${link.code}`);
  expect(response?.status()).toBe(404);
  await expect(page.getByText('Page not found')).toBeVisible();
});

test("renaming or deleting another Owner's Link looks the same as a missing Link", async ({
  context,
}) => {
  const other = await signIn(context);
  const theirs = await links.createLink({
    destination: 'https://example.com/theirs',
    name: 'Theirs',
    ownerId: other.id,
  });
  await context.clearCookies();
  await signIn(context);

  const attempts = [theirs.id, randomUUID()].flatMap((linkId) => [
    context.request.post('/_actions/links.rename', {
      data: { linkId, name: 'Mine now' },
    }),
    context.request.post('/_actions/links.delete', { data: { linkId } }),
  ]);
  const responses = await Promise.all(attempts);

  const results = await Promise.all(
    responses.map(async (response) => [
      response.status(),
      await response.text(),
    ]),
  );
  expect(results.map(([status]) => status)).toEqual([404, 404, 404, 404]);
  // The Links module's message, not Astro's "action not found".
  for (const [, body] of results) expect(body).toContain('Link not found.');
  expect(results[0]).toEqual(results[2]);
  expect(results[1]).toEqual(results[3]);
  await expect(links.findDestination(theirs.code)).resolves.toBe(
    'https://example.com/theirs',
  );
  const listed = await links.listLinks(other.id, { page: 1, limit: 10 });
  expect(listed.items.map((item) => item.name)).toEqual(['Theirs']);
});

test('a Visitor cannot rename or delete Links', async ({ request }) => {
  const responses = await Promise.all([
    request.post('/_actions/links.rename', {
      data: { linkId: randomUUID(), name: 'Nope' },
    }),
    request.post('/_actions/links.delete', {
      data: { linkId: randomUUID() },
    }),
  ]);

  expect(responses.map((response) => response.status())).toEqual([401, 401]);
});
