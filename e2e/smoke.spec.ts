import { expect, test } from '@playwright/test';

test('a Visitor can open the home page', async ({ page }) => {
  const response = await page.goto('/');

  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/ClipLink/);
  await expect(
    page.getByRole('link', { name: 'Privacy Policy' }),
  ).toBeVisible();
});

test('an unknown path shows the 404 page with a 404 status', async ({
  page,
}) => {
  const response = await page.goto('/this/path/does-not-exist');

  expect(response?.status()).toBe(404);
  await expect(page.getByText('Page not found')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Go Home' })).toHaveAttribute(
    'href',
    '/',
  );
});
