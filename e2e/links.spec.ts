import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

test('a Visitor creates an Anonymous Link, copies it, and follows it', async ({
  page,
  context,
  request,
  baseURL,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const destination = `https://example.com/e2e/${randomUUID()}`;

  await page.goto('/');
  await page.getByLabel('Long URL').fill(destination);
  await page.getByRole('button', { name: 'Shorten URL' }).click();

  await expect(page).toHaveURL(/\/short\/[0-9A-Za-z]{7}$/);
  const code = new URL(page.url()).pathname.split('/').at(-1)!;
  const shortUrl = `${baseURL}/${code}`;
  await expect(page.getByLabel('Short URL')).toHaveValue(shortUrl);
  const open = page.getByRole('link', { name: 'Open Short URL' });
  const another = page.getByRole('link', { name: 'Shorten another URL' });
  await expect(open).toHaveAttribute('href', shortUrl);
  await expect(open).toHaveCSS('height', '36px');
  await expect(open).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(another).toHaveCSS('height', '36px');
  await expect(another).toHaveCSS('border-top-width', '1px');

  await page.getByRole('button', { name: 'Copy' }).click();
  await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    shortUrl,
  );

  const redirect = await request.get(`/${code}`, { maxRedirects: 0 });
  expect(redirect.status()).toBe(302);
  expect(redirect.headers().location).toBe(destination);
});

test('the form rejects a Destination that is not http or https', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Long URL').fill('ftp://example.com/file');
  await page.getByRole('button', { name: 'Shorten URL' }).click();

  await expect(
    page.getByText('Enter a valid http or https URL.'),
  ).toBeVisible();
  await expect(page).toHaveURL('/');
});

test('the server rejects a Destination that is not http or https', async ({
  request,
}) => {
  const response = await request.post('/_actions/links.create', {
    data: { destination: 'javascript:alert(1)' },
  });

  expect(response.status()).toBe(400);
  expect(await response.text()).toContain('Enter a valid http or https URL.');
});

test('an unknown Code shows the 404 page with a 404 status', async ({
  page,
}) => {
  const response = await page.goto('/Zz9Zz9Z');

  expect(response?.status()).toBe(404);
  await expect(page.getByText('Page not found')).toBeVisible();
});

test('an unknown Code has no confirmation page', async ({ page }) => {
  const response = await page.goto('/short/Zz9Zz9Z');

  expect(response?.status()).toBe(404);
  await expect(page.getByText('Page not found')).toBeVisible();
});

test('a Visitor creating Links too fast is told to wait a minute', async ({
  page,
}) => {
  // Vercel's firewall answers before the app, so the reply is not an Action response.
  await page.route('**/_actions/links.create**', (route) =>
    route.fulfill({
      status: 429,
      contentType: 'text/plain',
      body: 'Too Many Requests',
    }),
  );
  await page.goto('/');
  await page.getByLabel('Long URL').fill('https://example.com/too/fast');
  await page.getByRole('button', { name: 'Shorten URL' }).click();

  await expect(
    page.getByText('Too many Links too fast. Try again in a minute.'),
  ).toBeVisible();
  await expect(page).toHaveURL('/');
});
