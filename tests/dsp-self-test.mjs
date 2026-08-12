import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const script = html.match(/<script>\s*([\s\S]*?)<\/script>/i)?.[1];
if (!script) throw new Error('index.html inline script not found');

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
vm.runInContext(`${script}\nglobalThis.__dsp = { analyzeAudio, truePeak, buildVoiceFx };`, context, { filename: 'index.html' });
const { analyzeAudio, truePeak, buildVoiceFx } = context.__dsp;

function buffer(channels, sampleRate = 48000) {
  return { numberOfChannels: channels.length, length: channels[0]?.length || 0, sampleRate, duration: (channels[0]?.length || 0) / sampleRate, getChannelData: index => channels[index] };
}
function db(amplitude) { return 20 * Math.log10(amplitude); }
function approx(actual, expected, tolerance, message) { assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} not within ${tolerance} of ${expected}`); }

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

// True Peak includes sample peaks even for empty and very short buffers.
assert.equal(truePeak(new Float32Array(0)), -240, 'zero-length true peak');
approx(truePeak(new Float32Array([0.5])), db(0.5), 0.001, 'one-sample true peak');
approx(analyzeAudio(buffer([new Float32Array([0.5]), new Float32Array([0])])).tpDb, db(0.5), 0.001, 'short multi-channel true peak');
assert.doesNotThrow(() => analyzeAudio(buffer([new Float32Array(0)])), 'zero-length analysis remains safe');

// The gain recommendation must cap from the channel-safe true peak.
const gainFx = buildVoiceFx({ ...monoResult, tpDb: -0.2, kwRms: -30, smpPkDb: -0.2, bands: monoResult.bands });
const clipGain = gainFx.find(effect => effect.id === 'clipgain');
assert.ok(clipGain.note.includes('削波保護已啟動'), 'true peak limits Clip Gain');

const surround = analyzeAudio(buffer([mono, mono, mono]));
assert.ok(surround.channelCaveat, 'more than two channels exposes a channel caveat');
console.log(JSON.stringify({ ok: true, fixtures: ['mono', 'identical-stereo', 'left-hot', 'anti-phase', 'short', 'zero', 'near-peak-frame', 'true-peak-gain'] }));
