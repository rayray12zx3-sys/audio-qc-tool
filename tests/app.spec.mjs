import { test, expect } from '@playwright/test';

test('empty, loading and preview states stay usable without console errors', async ({ page }) => {
  const errors = [];
  page.on('console', message => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));

  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.locator('#copyBtn')).toBeDisabled();
    await expect(page.locator('#versionBadge')).toContainText('v0.2.1');

    await page.goto('/?preview=loading');
    await expect(page.locator('#loadingOverlay')).toHaveClass(/show/);

    await page.goto('/?preview=both');
    await expect(page.locator('#res-voice')).toHaveClass(/show/);
    await expect(page.locator('#res-bgm')).toHaveClass(/show/);
    await expect(page.locator('#copyBtn')).toBeEnabled();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    await page.locator('#copyBtn').click();
    await expect(page.locator('#copyBtn')).toContainText(/已複製|複製失敗/);
  }
  expect(errors).toEqual([]);
});
