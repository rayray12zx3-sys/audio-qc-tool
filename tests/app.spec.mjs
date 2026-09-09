import { test, expect } from '@playwright/test';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function makeWav() {
  const data = Buffer.alloc(960, 0);
  const out = Buffer.alloc(44 + data.length);
  out.write('RIFF'); out.writeUInt32LE(36 + data.length, 4); out.write('WAVEfmt ', 8);
  out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(1, 22);
  out.writeUInt32LE(48000, 24); out.writeUInt32LE(96000, 28); out.writeUInt16LE(2, 32); out.writeUInt16LE(16, 34);
  out.write('data', 36); out.writeUInt32LE(data.length, 40); data.copy(out, 44);
  return out;
}
const wav = makeWav();

async function chooseVoiceWithKeyboard(page, file) {
  const chooserPromise = page.waitForEvent('filechooser');
  await page.locator('#drop-voice').press('Enter');
  const chooser = await chooserPromise;
  await chooser.setFiles(file);
}

test('desktop empty/loading/preview/copy and keyboard interactions have no console errors', async ({ page }) => {
  const errors = [];
  page.on('console', message => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.locator('#copyBtn')).toBeDisabled();
    await page.locator('#drop-voice').focus();
    await expect(page.locator('#drop-voice')).toBeFocused();
    await page.locator('#tab-voice').press('ArrowRight');
    await expect(page.locator('#tab-bgm')).toHaveAttribute('aria-selected', 'true');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy();
  }
  await page.goto('/?preview=loading');
  await expect(page.locator('#loadingOverlay')).toHaveClass(/show/);
  await page.goto('/?preview=both');
  await expect(page.locator('#res-voice')).toHaveClass(/show/);
  await expect(page.locator('#chain-voice .chain-arr')).toHaveCount(5);
  await expect(page.locator('#chain-bgm .chain-arr')).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy();
  await page.locator('#copyBtn').click();
  await expect(page.locator('#copyBtn')).toContainText(/已複製|複製失敗/);
  expect(errors).toEqual([]);
});

test('upload replacement and large-file rejection are safe', async ({ page }) => {
  await page.goto('/');
  const input = page.locator('#fi-voice');
  const fixture = { name: 'fixture.wav', mimeType: 'audio/wav', buffer: wav };
  await chooseVoiceWithKeyboard(page, fixture);
  await expect(page.locator('#res-voice')).toHaveClass(/show/);
  await chooseVoiceWithKeyboard(page, fixture);
  await expect(page.locator('#res-voice')).toHaveClass(/show/);
  await expect(page.locator('#fn-voice')).toHaveText('fixture.wav');
  await input.setInputFiles({ name: 'invalid.bin', mimeType: 'application/octet-stream', buffer: Buffer.from('not audio') });
  await expect(page.locator('#st-voice')).toContainText('未分析');
  await expect(page.locator('#res-voice')).not.toHaveClass(/show/);
  await chooseVoiceWithKeyboard(page, fixture);
  await expect(page.locator('#res-voice')).toHaveClass(/show/);
  await page.goto('/?preview=large-file');
  await expect(page.locator('#st-voice')).toContainText('代表片段');
  await expect(page.locator('#res-voice')).not.toHaveClass(/show/);
});

test('accessible labels, custom validation, long names, and filename injection remain safe', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('常用響度起始目標')).toBeVisible();
  await expect(page.getByLabel('預期輸出格式')).toBeVisible();
  await expect(page.getByLabel('內容類型')).toBeVisible();
  await expect(page.locator('#res-voice')).toHaveAttribute('aria-label', '人聲分析結果');
  await page.locator('#platformSel').selectOption('custom');
  await page.locator('#cLufs').fill('0');
  await page.locator('#cTp').fill('0');
  await expect(page.locator('#rDisp')).toContainText('0 LUFS');
  await page.locator('#cLufs').fill('');
  await expect(page.locator('#customError')).toBeVisible();
  await expect(page.locator('#cLufs')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#cTp')).toHaveAttribute('aria-invalid', 'false');

  const maliciousLongName = `<img src=x onerror=alert(1)>-${'very-long-name-'.repeat(16)}.wav`;
  await chooseVoiceWithKeyboard(page, { name: maliciousLongName, mimeType: 'audio/wav', buffer: wav });
  await expect(page.locator('#fn-voice')).toHaveText(maliciousLongName);
  await expect(page.locator('#sum-voice img')).toHaveCount(0);
  await expect(page.locator('#st-voice')).toContainText('分析完成');
  await expect(page.locator('#copyBtn')).toBeDisabled();
  await page.locator('#cLufs').fill('-16');
  await expect(page.locator('#customError')).toBeHidden();
  await expect(page.locator('#copyBtn')).toBeEnabled();
  await page.locator('#chain-voice button.chain-node.active').first().press('Enter');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy();
});

test('index.html still opens directly with classic assets', async ({ page }) => {
  const errors = [];
  page.on('console', message => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(path.join(process.cwd(), 'index.html')).href);
  await expect(page.locator('#versionBadge')).toContainText('v0.3.2');
  await expect(page.locator('#copyBtn')).toBeDisabled();
  await expect(page.locator('link[href="styles.css"]')).toHaveCount(1);
  expect(await page.evaluate(() => typeof window.AudioAnalysis?.analyzeAudio)).toBe('function');
  expect(errors).toEqual([]);
});
