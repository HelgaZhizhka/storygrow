import { test, expect } from '@playwright/test';

test('home page has correct title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/StoryGrow/);
});
