import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = fs.readFileSync(path.join(root, 'audio-analysis.js'), 'utf8');

class Element {
  constructor() { this.classList = { add() {}, remove() {}, toggle() {}, contains() { return false; } }; this.style = { setProperty() {} }; this.dataset = {}; this.parentElement = { clientWidth: 800 }; this.innerHTML = ''; this.textContent = ''; }
  addEventListener() {}
  querySelectorAll() { return []; }
  getContext() { return { clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, fillRect() {}, scale() {} }; }
}
const elements = new Map();
const document = { documentElement: new Element(), getElementById(id) { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); }, querySelector() { return new Element(); }, querySelectorAll() { return []; } };
const window = { devicePixelRatio: 1, location: { search: '' }, AudioContext: class {}, webkitAudioContext: class {} };
const context = vm.createContext({ console, document, window, navigator: {}, requestAnimationFrame: cb => cb(), setTimeout, clearTimeout, URLSearchParams });
window.window = window;
vm.runInContext(script, context, { filename: 'audio-analysis.js' });
const { analyzeAudio, truePeak, integratedLoudness } = context.window.AudioAnalysis;

function buffer(channels, sampleRate = 48000) {
  return { numberOfChannels: channels.length, length: channels[0]?.length || 0, sampleRate, duration: (channels[0]?.length || 0) / sampleRate, getChannelData: index => channels[index] };
}
function db(amplitude) { return 20 * Math.log10(amplitude); }
function approx(actual, expected, tolerance, message) { assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} not within ${tolerance} of ${expected}`); }
function assertFiniteDeep(value, path = 'result') {
  if (typeof value === 'number') assert.ok(Number.isFinite(value), `${path} must be finite`);
  else if (ArrayBuffer.isView(value) || Array.isArray(value)) Array.from(value).forEach((item, index) => assertFiniteDeep(item, `${path}[${index}]`));
  else if (value && typeof value === 'object') Object.entries(value).forEach(([key, item]) => assertFiniteDeep(item, `${path}.${key}`));
}

// Mono baseline and identical stereo must use equal channel weights (+3.01 dB).
const mono = new Float32Array(48000).fill(0.1);
const monoResult = analyzeAudio(buffer([mono]));
const stereoResult = analyzeAudio(buffer([mono, mono]));
approx(stereoResult.kwRms - monoResult.kwRms, 3.0103, 0.08, 'identical stereo loudness');

// One hot channel must not be hidden by a quiet/empty neighbour; frame count is de-duplicated.
const leftHot = new Float32Array([0.99, 0.99, 0.1, 0]);
const rightHot = new Float32Array([0.99, 0, 0.99, 0]);
const hot = analyzeAudio(buffer([leftHot, rightHot]));
approx(hot.smpPkDb, db(0.99), 0.001, 'left-only sample peak');
assert.equal(hot.nearPeakCount, 3, 'near-peak counts each sample frame once even when both channels are hot');

// Largest signed DC offset wins by absolute magnitude.
const dc = analyzeAudio(buffer([new Float32Array(64).fill(-0.2), new Float32Array(64).fill(0.1)]));
approx(dc.dcOffset, -0.2, 1e-6, 'DC offset preserves largest channel sign');

// Anti-phase downmix cancellation keeps level meters channel-safe and marks phase risk.
const anti = new Float32Array(48000);
for (let i = 0; i < anti.length; i++) anti[i] = Math.sin(i / 20) * 0.5;
const antiResult = analyzeAudio(buffer([anti, Float32Array.from(anti, x => -x)]));
assert.ok(antiResult.stereo.corr < -0.99, 'anti-phase correlation is detected');
assert.ok(antiResult.smpPkDb > -7, 'anti-phase sample peak remains channel-safe');
assert.ok(antiResult.stereo.width > 0.99, 'anti-phase width remains wide');
assert.ok(stereoResult.stereo.width < 0.01, 'identical stereo width remains narrow');

// True Peak includes sample peaks even for empty and very short buffers.
assert.equal(truePeak(new Float32Array(0)), -240, 'zero-length true peak');
approx(truePeak(new Float32Array([0.5])), db(0.5), 0.001, 'one-sample true peak');
approx(analyzeAudio(buffer([new Float32Array([0.5]), new Float32Array([0])])).tpDb, db(0.5), 0.001, 'short multi-channel true peak');
assert.doesNotThrow(() => analyzeAudio(buffer([new Float32Array(0)])), 'zero-length analysis remains safe');
assertFiniteDeep(analyzeAudio(buffer([new Float32Array(0), new Float32Array(0)])), 'zero-length analysis');

// 399.98ms must use the same LUFS calibration as the first 400ms block.
const loud39998 = integratedLoudness([new Float32Array(19199).fill(0.1)], 48000);
const loud400 = integratedLoudness([new Float32Array(19200).fill(0.1)], 48000);
approx(loud39998, loud400, 0.002, '399.98ms/400ms loudness continuity');

// A bin-centred tone validates Hann coherent-gain normalization.
const N = 2048, hop = 512, sampleRate = 48000, toneBin = 256;
const fullTone = new Float32Array(N);
for (let i = 0; i < N; i++) fullTone[i] = 0.5 * Math.sin(2 * Math.PI * toneBin * i / N);
approx(analyzeAudio(buffer([fullTone], sampleRate)).pSib, db(0.5), 0.08, 'P_Sib uses Hann coherent-gain normalization');

// Energy that exists only after the first frame must prove the final complete frame is included.
const tailTone = new Float32Array(N + hop);
for (let i = N; i < tailTone.length; i++) tailTone[i] = 0.5 * Math.sin(2 * Math.PI * toneBin * (i - N) / N);
assert.ok(analyzeAudio(buffer([tailTone], sampleRate)).pSib > -80, 'final complete STFT frame is analysed');
const tailToneResult = analyzeAudio(buffer([tailTone], sampleRate));
assert.equal(tailToneResult.peakToLoudness, tailToneResult.crest, 'peakToLoudness preserves crest compatibility');

const surround = analyzeAudio(buffer([mono, mono, mono]));
assert.ok(surround.channelCaveat, 'more than two channels exposes a channel caveat');
console.log(JSON.stringify({ ok: true, fixtures: ['mono', 'identical-stereo', 'left-hot', 'anti-phase', 'short', 'zero', 'near-peak-frame'] }));
