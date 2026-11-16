import { expect, test } from '@playwright/test';

test('a Visitor can open the home page', async ({ page }) => {
  const response = await page.goto('/');

  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/ClipLink/);
  await expect(
    page.getByRole('link', { name: 'Privacy Policy' }),
  ).toBeVisible();
});

test('a Visitor sees Log in as a ghost button in line with the theme toggle', async ({
  page,
}) => {
  await page.goto('/');
  const logIn = page.getByRole('link', { name: 'Log in' });
  const toggle = page.getByRole('button', { name: 'Toggle theme' });
  await expect(toggle).toBeVisible();

  const [logInBox, toggleBox, iconBox] = await Promise.all([
    logIn.boundingBox(),
    toggle.boundingBox(),
    logIn.locator('svg').boundingBox(),
  ]);
  expect(logInBox?.height).toBe(36);
  expect(iconBox).toMatchObject({ width: 16, height: 16 });
  expect(logInBox!.y + logInBox!.height / 2).toBe(
    toggleBox!.y + toggleBox!.height / 2,
  );
});

test('an unknown path shows the 404 page with a 404 status', async ({
  page,
}) => {
  const response = await page.goto('/this/path/does-not-exist');

  expect(response?.status()).toBe(404);
  await expect(page.getByText('Page not found')).toBeVisible();
  const goHome = page.getByRole('link', { name: 'Go Home' });
  await expect(goHome).toHaveAttribute('href', '/');
  await expect(goHome).toHaveCSS('height', '36px');
  await expect(goHome).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
});

for (const path of ['/privacy-policy', '/terms-of-service']) {
  test(`${path} names the services Cliplink uses and never mentions passwords or email sending`, async ({
    page,
  }) => {
    const response = await page.goto(path);

    expect(response?.status()).toBe(200);
    const text = await page.locator('body').innerText();
    expect(text).toMatch(/Vercel Analytics/);
    expect(text).toMatch(/Speed Insights/);
    expect(text).not.toMatch(/password/i);
    expect(text).not.toMatch(/reset/i);
    expect(text).not.toMatch(/(send|sending|sent)\b[^.]*\bemails?\b/i);
    expect(text).not.toMatch(/\bemails?\b[^.]*\b(send|sending|sent)\b/i);
  });
}
