import { test, expect } from '@playwright/test';

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
