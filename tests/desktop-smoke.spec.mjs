import { test, expect } from '@playwright/test';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

test('desktop smoke: core layout, controls, preview states, and static assets', async ({ page }) => {
  const errors = [];
  page.on('console', message => {
    if (['error', 'warning'].includes(message.type())) {
      errors.push(message.text());
    }
  });
  page.on('pageerror', error => errors.push(error.message));

  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/');

    await expect(page.locator('#versionBadge')).toContainText('v0.3.2');
    await expect(page.locator('#drop-voice')).toBeVisible();

    await page.locator('#tab-bgm').click();
    await expect(page.locator('#drop-bgm')).toBeVisible();

    await page.locator('#tab-voice').click();
    await expect(page.locator('#drop-voice')).toBeVisible();

    await expect(page.locator('#platformSel')).toBeVisible();
    await expect(page.locator('#copyBtn')).toBeVisible();

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy();
  }

  await page.goto('/?preview=loading');
  await expect(page.locator('#loadingOverlay')).toHaveClass(/show/);

  await page.goto('/?preview=error-voice');
  await expect(page.locator('#st-voice')).toHaveClass(/show/);
  await expect(page.locator('#st-voice')).toContainText('解碼失敗：Preview 狀態，模擬瀏覽器不支援此格式');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy();

  await page.goto('/?preview=error-bgm');
  await expect(page.locator('#st-bgm')).toHaveClass(/show/);
  await expect(page.locator('#st-bgm')).toContainText('解碼失敗：Preview 狀態，模擬瀏覽器不支援此格式');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy();

  await page.goto('/?preview=both');
  await expect(page.locator('#res-voice')).toHaveClass(/show/);
  await page.locator('#tab-bgm').click();
  await expect(page.locator('#res-bgm')).toHaveClass(/show/);
  await expect(page.locator('#chain-voice .chain-arr')).toHaveCount(5);
  await expect(page.locator('#chain-bgm .chain-arr')).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy();

  expect(errors).toEqual([]);
});

test('desktop smoke: classic static assets load directly via index.html', async ({ page }) => {
  const errors = [];
  page.on('console', message => {
    if (['error', 'warning'].includes(message.type())) {
      errors.push(message.text());
    }
  });
  page.on('pageerror', error => errors.push(error.message));

  await page.goto(pathToFileURL(path.join(process.cwd(), 'index.html')).href);
  await expect(page.locator('#versionBadge')).toContainText('v0.3.2');
  await expect(page.locator('#copyBtn')).toBeDisabled();
  await expect(page.locator('link[href="styles.css"]')).toHaveCount(1);
  expect(await page.evaluate(() => typeof window.AudioAnalysis?.analyzeAudio)).toBe('function');
  expect(errors).toEqual([]);
});
