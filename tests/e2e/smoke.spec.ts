import { expect, test } from '@playwright/test';

test.describe('Thai Invoice Extractor smoke', () => {
  test('login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in with email' })).toBeVisible();
  });

  test('unauthenticated users are redirected from upload', async ({ page }) => {
    await page.goto('/upload');
    await expect(page).toHaveURL(/\/login/);
  });

  test('login page shows email/password form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Option 1 — Email & password')).toBeVisible();
    await expect(page.getByPlaceholder('you@company.com')).toBeVisible();
  });
});
