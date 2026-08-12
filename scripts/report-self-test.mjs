import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = path.join(rootDir, 'index.html');
const packagePath = path.join(rootDir, 'package.json');
const html = fs.readFileSync(indexPath, 'utf8');
const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const match = html.match(/<script>\s*([\s\S]*?)<\/script>/i);

if (!match) {
  console.error('No inline script found in index.html');
  process.exit(1);
}

class ClassListStub {
  constructor() {
    this.values = new Set();
  }

  add(...names) {
    names.forEach(name => this.values.add(name));
  }

  remove(...names) {
    names.forEach(name => this.values.delete(name));
  }

  toggle(name, force) {
    if (force === undefined) {
      if (this.values.has(name)) {
        this.values.delete(name);
        return false;
      }
      this.values.add(name);
      return true;
    }
    if (force) this.values.add(name);
    else this.values.delete(name);
    return !!force;
  }

  contains(name) {
    return this.values.has(name);
  }
}

class ElementStub {
  constructor(id = '') {
    this.id = id;
    this.dataset = {};
    this.style = { setProperty() {} };
    this.classList = new ClassListStub();
    this.parentElement = { clientWidth: 800 };
    this.children = [];
    this.value = '';
    this.disabled = false;
    this.title = '';
    this._innerHTML = '';
    this._textContent = '';
  }

  get innerHTML() { return this._innerHTML; }
  set innerHTML(value) {
    this._innerHTML = String(value);
    this._textContent = '';
  }

  get textContent() { return this._textContent; }
  set textContent(value) {
    this._textContent = String(value);
    this._innerHTML = '';
  }

  addEventListener() {}
  setAttribute() {}
  click() {}
  scrollIntoView() {}

  querySelectorAll() {
    return [];
  }

  querySelector() {
    return new ElementStub();
  }

  getContext() {
    return {
      clearRect() {},
      beginPath() {},
      moveTo() {},
      lineTo() {},
      stroke() {},
      fillRect() {},
      scale() {},
      set strokeStyle(_) {},
      set lineWidth(_) {},
      set fillStyle(_) {}
    };
  }
}

const elements = new Map();
const objectUrls = { created: 0, revoked: 0 };
const getElement = id => {
  if (!elements.has(id)) elements.set(id, new ElementStub(id));
  return elements.get(id);
};

const documentStub = {
  documentElement: new ElementStub('documentElement'),
  getElementById: getElement,
  createElement() {
    return { preload: '', duration: 1, set src(_) { queueMicrotask(() => this.onloadedmetadata?.()); } };
  },
  querySelector(selector) {
    if (selector.startsWith('.tab[data-track="')) {
      const track = selector.match(/"([^"]+)"/)?.[1] || '';
      const el = getElement(`tab-${track}`);
      el.dataset.track = track;
      return el;
    }
    return new ElementStub(selector);
  },
  querySelectorAll(selector) {
    if (selector === '.tab') {
      return ['voice', 'bgm'].map(track => {
        const el = getElement(`tab-${track}`);
        el.dataset.track = track;
        return el;
      });
    }
    if (selector === '.panel') {
      return ['voice', 'bgm'].map(track => getElement(`panel-${track}`));
    }
    return [];
  }
};

const windowStub = {
  devicePixelRatio: 1,
  location: { search: '' },
  AudioContext: class {},
  webkitAudioContext: class {}
};

const context = vm.createContext({
  console,
  document: documentStub,
  window: windowStub,
  navigator: {
    clipboard: {
      writeText: async () => {}
    }
  },
  requestAnimationFrame: callback => callback(),
  setTimeout,
  clearTimeout,
  URL: {
    createObjectURL: () => { objectUrls.created++; return `blob:test-${objectUrls.created}`; },
    revokeObjectURL() { objectUrls.revoked++; }
  },
  URLSearchParams
});

windowStub.window = windowStub;
windowStub.document = documentStub;
windowStub.navigator = context.navigator;
const copyButtonIdleHtml = '<svg aria-hidden="true"></svg><span>複製完整報告</span>';
getElement('copyBtn').innerHTML = copyButtonIdleHtml;

try {
  vm.runInContext(`${match[1]}\nglobalThis.__appTest = { appVersion: APP_VERSION, appUpdatedAt: APP_UPDATED_AT, buildReportData, buildReport, makeTestAnalysis, diagCommon, render, clearTrackState, copyReport, showCopyButtonFeedback, handleFile, inspectAudioFile, beginAnalysisRun, isCurrentAnalysisRun, finishAnalysisRun, setAudioContext: value => { aCtx = value; }, getTrack: trackId => S[trackId] };`, context, { filename: indexPath });
  const result = context.window.runReportSelfTest?.();
  const appTest = context.__appTest;

  if (!result || result.ok !== true) {
    console.error('Report self-test failed');
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }

  const interactionFailures = [];
  const versionLabel = `v${appTest.appVersion} · 更新 ${appTest.appUpdatedAt}`;
  const reportMeta = appTest.buildReportData().meta;
  if (packageData.version !== appTest.appVersion || reportMeta.appVersion !== appTest.appVersion || reportMeta.appUpdatedAt !== appTest.appUpdatedAt) {
    interactionFailures.push('package, app constants, and report metadata versions are inconsistent');
  }
  if (elements.get('versionBadge').textContent !== versionLabel || !appTest.buildReport().includes(`工具版本：${versionLabel}`)) {
    interactionFailures.push('visible badge or copied report is missing the current version label');
  }
  const firstVoiceRun = appTest.beginAnalysisRun('voice');
  const secondVoiceRun = appTest.beginAnalysisRun('voice');
  if (appTest.isCurrentAnalysisRun('voice', firstVoiceRun) || !appTest.isCurrentAnalysisRun('voice', secondVoiceRun)) {
    interactionFailures.push('analysis run token did not mark only the latest same-track run as current');
  }
  appTest.finishAnalysisRun();
  appTest.finishAnalysisRun();

  appTest.beginAnalysisRun('voice');
  appTest.beginAnalysisRun('bgm');
  const loadingOverlay = elements.get('loadingOverlay');
  appTest.finishAnalysisRun();
  if (!loadingOverlay.classList.contains('show')) {
    interactionFailures.push('loading overlay hid before all parallel analysis runs finished');
  }
  appTest.finishAnalysisRun();
  if (loadingOverlay.classList.contains('show')) {
    interactionFailures.push('loading overlay remained visible after all parallel analysis runs finished');
  }

  let oversizedArrayBufferCalls = 0;
  await appTest.handleFile('voice', {
    name: 'oversized.wav',
    size: 128 * 1024 * 1024 + 1,
    arrayBuffer: async () => { oversizedArrayBufferCalls++; return new ArrayBuffer(0); }
  });
  if (oversizedArrayBufferCalls !== 0 || !elements.get('st-voice').textContent.includes('代表片段') || loadingOverlay.classList.contains('show')) {
    interactionFailures.push('oversized preflight decoded the file or left loading/error state incorrect');
  }
  const originalCreateElement = context.document.createElement;
  context.document.createElement = () => ({ preload: '', set src(_) {} });
  const timedOutInspection = await appTest.inspectAudioFile({ name: 'timeout.wav', size: 1024 }, { timeoutMs: 1 });
  context.document.createElement = originalCreateElement;
  if (timedOutInspection.allowed || !timedOutInspection.reason.includes('確認音檔時長')) {
    interactionFailures.push('metadata timeout did not safely reject the file');
  }

  const testAnalysis = appTest.makeTestAnalysis({ smpPkDb: -0.2, tpDb: -0.1, nearPeakCount: 7 });
  const nearPeakDiag = appTest.diagCommon(testAnalysis).find(item => item.title === '接近滿刻度（削波風險）');
  if (!nearPeakDiag || nearPeakDiag.desc.includes('屬不可逆失真') || !nearPeakDiag.desc.includes('接近滿刻度樣本')) {
    interactionFailures.push('near-full-scale warning wording is incorrect');
  }

  const testBuffer = {
    numberOfChannels: 1,
    length: 4096,
    getChannelData() { return new Float32Array(4096); }
  };
  appTest.render('voice', appTest.makeTestAnalysis(), 'previous.wav', testBuffer);
  appTest.clearTrackState('voice');
  if (!elements.get('copyBtn').disabled || elements.get('res-voice').classList.contains('show') || elements.get('tab-voice').classList.contains('done')) {
    interactionFailures.push('failed replacement did not clear stale voice state');
  }

  appTest.render('voice', appTest.makeTestAnalysis(), 'copy-test.wav', testBuffer);
  await appTest.copyReport(() => Promise.reject(new Error('clipboard denied')), 0);
  if (elements.get('copyBtn').textContent !== '複製失敗') {
    interactionFailures.push('clipboard failure did not provide feedback');
  }

  const channelCaveat = '超過雙聲道：測試用多聲道注意事項';
  appTest.render('voice', appTest.makeTestAnalysis({
    stereo: { corr: -0.8, width: 0.2 },
    channelCaveat
  }), 'phase-risk.wav', testBuffer);
  const phaseRiskReport = appTest.buildReport();
  if (!phaseRiskReport.includes(channelCaveat) || !phaseRiskReport.includes('mono-derived 指標的信心降低')) {
    interactionFailures.push('copied report is missing multichannel or negative-correlation caveat');
  }

  const copyBtn = elements.get('copyBtn');
  copyBtn.innerHTML = copyButtonIdleHtml;
  appTest.render('voice', appTest.makeTestAnalysis(), 'copy-feedback-test.wav', testBuffer);
  appTest.showCopyButtonFeedback('已複製', '第一次回饋', 10);
  appTest.showCopyButtonFeedback('複製失敗', '第二次回饋', 10);
  await new Promise(resolve => setTimeout(resolve, 25));
  if (copyBtn.innerHTML !== copyButtonIdleHtml || copyBtn.textContent !== '' || copyBtn.title !== '複製目前分析報告' || copyBtn.disabled) {
    interactionFailures.push('rapid copy feedback did not restore idle SVG, text, title, and enabled state');
  }

  const audioBuffer = {
    numberOfChannels: 1,
    length: 4096,
    duration: 4096 / 48000,
    sampleRate: 48000,
    getChannelData() { return new Float32Array(4096); }
  };
  const deferred = () => {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  };
  const staleResult = deferred();
  const staleError = deferred();
  const fileWithMarker = (name, marker) => ({
    name,
    size: 1024,
    arrayBuffer: async () => new Uint8Array([marker]).buffer
  });
  appTest.setAudioContext({
    decodeAudioData(buffer) {
      const marker = new Uint8Array(buffer)[0];
      if (marker === 1) return staleResult.promise;
      if (marker === 3) return staleError.promise;
      return Promise.resolve(audioBuffer);
    }
  });

  const oldResultRun = appTest.handleFile('voice', fileWithMarker('old-result.wav', 1));
  await new Promise(resolve => setTimeout(resolve, 0));
  const newResultRun = appTest.handleFile('voice', fileWithMarker('new-result.wav', 2));
  await newResultRun;
  staleResult.resolve(audioBuffer);
  await oldResultRun;
  if (appTest.getTrack('voice')?.filename !== 'new-result.wav' || elements.get('st-voice').textContent) {
    interactionFailures.push('stale completed analysis overwrote the newer result or status');
  }

  const oldErrorRun = appTest.handleFile('voice', fileWithMarker('old-error.wav', 3));
  await new Promise(resolve => setTimeout(resolve, 0));
  const newErrorRun = appTest.handleFile('voice', fileWithMarker('new-error.wav', 4));
  await newErrorRun;
  staleError.reject(new Error('old decode failed'));
  await oldErrorRun;
  if (appTest.getTrack('voice')?.filename !== 'new-error.wav' || elements.get('st-voice').textContent) {
    interactionFailures.push('stale analysis error overwrote the newer result or status');
  }
  if (objectUrls.created !== objectUrls.revoked) {
    interactionFailures.push('metadata preflight did not revoke every object URL');
  }

  if (interactionFailures.length) {
    console.error('Interaction self-test failed');
    console.error(JSON.stringify(interactionFailures, null, 2));
    process.exit(1);
  }

  console.log('Report self-test passed');
  console.log(JSON.stringify({ ...result, interaction: 'passed' }));
} catch (error) {
  console.error('Report self-test crashed');
  console.error(error);
  process.exit(1);
}
