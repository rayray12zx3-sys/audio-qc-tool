(function () {
const NEAR_FULL_SCALE_AMP = Math.pow(10, -0.3 / 20);
const T3 = [20,25,31.5,40,50,63,80,100,125,160,200,250,315,400,500,630,800,1000,1250,1600,2000,2500,3150,4000,5000,6300,8000,10000,12500,16000];
// ===== 工具函式 =====
const toDb  = a => 20 * Math.log10(Math.max(a, 1e-12));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const avg   = arr => arr.reduce((s, v) => s + v, 0) / arr.length;
const pctile = (sorted, p) => sorted[Math.max(0, Math.min(sorted.length - 1, Math.floor(sorted.length * p)))];

// ===== K-Weighting 近似濾波器（動態係數，依 sampleRate 計算）=====
// 參考 BS.1770 K-weighting 的兩階 biquad IIR；本工具輸出仍為瀏覽器端估算。
function kwCoeffs(sr) {
  // Stage 1：High-Shelf pre-filter（補償頭部聲學效應，+4dB @ 1682Hz）
  const f0 = 1681.974450955533;
  const G  = 3.999843853973347; // 精確值，非整數 4.0
  const Vh = Math.pow(10, G / 20);
  const Vb = Math.pow(10, G / 40); // ≈ sqrt(Vh)
  const K1 = Math.tan(Math.PI * f0 / sr);
  const D1 = 1 + Math.SQRT2 * K1 + K1 * K1;
  const hs = {
    b0: (Vh + Math.sqrt(2 * Vh) * K1 + K1 * K1) / D1,
    b1:  2 * (K1 * K1 - Vh) / D1,
    b2: (Vh - Math.sqrt(2 * Vh) * K1 + K1 * K1) / D1,
    a1:  2 * (K1 * K1 - 1) / D1,
    a2: (1 - Math.SQRT2 * K1 + K1 * K1) / D1
  };
  // Stage 2：High-Pass RLB filter（移除 100Hz 以下次低頻）
  const f1 = 38.13547087602444;
  const Q  = 0.5003270373238773;
  const K2 = Math.tan(Math.PI * f1 / sr);
  const D2 = 1 + K2 / Q + K2 * K2;
  const hp = {
    b0:  1 / D2, b1: -2 / D2, b2: 1 / D2,
    a1:  2 * (K2 * K2 - 1) / D2,
    a2: (1 - K2 / Q + K2 * K2) / D2
  };
  return { hs, hp };
}

function biquadInPlace(data, c) {
  // 就地（in-place）biquad，節省記憶體
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < data.length; i++) {
    const x0 = data[i];
    const y0 = c.b0 * x0 + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    x2 = x1; x1 = x0; y2 = y1; y1 = y0;
    data[i] = y0;
  }
}

function kWeightedRms(mono, sr) {
  const c = kwCoeffs(sr);
  const f = mono.slice(); // 保留原始 mono
  biquadInPlace(f, c.hs);
  biquadInPlace(f, c.hp);
  let ms = 0;
  for (let i = 0; i < f.length; i++) ms += f[i] * f[i];
  return toDb(Math.sqrt(ms / f.length));
}

// ===== Estimated Integrated Loudness（參考 BS.1770 / EBU R128 gate 概念）=====
// 取代單純全域 K-weighted RMS：靜音段過多的素材（如本工具常見的對白檔案）
// 若用整段平均 RMS 估算，會被靜音段嚴重拉低、偏離人耳實際感知響度。
// 這裡用 400ms 滑動區塊（75% overlap）+ 兩道閘門近似處理；不是合規 loudness meter。
function integratedLoudness(channels, sr) {
  const c = kwCoeffs(sr);
  const filtered = channels.map(channel => {
    const f = channel.slice();
    biquadInPlace(f, c.hs);
    biquadInPlace(f, c.hp);
    return f;
  });
  const len = filtered[0]?.length || 0;

  const blockSize = Math.round(0.4 * sr); // 400ms
  const hopSize   = Math.round(0.1 * sr); // 100ms（75% overlap）

  const LUFS_OFFSET = -0.691; // BS.1770 常用校正常數；此實作仍為近似估算。
  // 素材過短（< 400ms），無法分區塊，退回全域 RMS。保留與區塊路徑相同的 LUFS offset。
  if (len < blockSize) {
    let ms = 0;
    for (const channel of filtered) {
      for (let i = 0; i < len; i++) ms += channel[i] * channel[i];
    }
    return LUFS_OFFSET + 10 * Math.log10(Math.max(ms / Math.max(len, 1), 1e-12));
  }

  const blocks = [];
  for (let start = 0; start + blockSize <= len; start += hopSize) {
    let ms = 0;
    for (const channel of filtered) {
      for (let i = start; i < start + blockSize; i++) ms += channel[i] * channel[i];
    }
    ms /= blockSize;
    blocks.push({ ms, l: LUFS_OFFSET + 10 * Math.log10(Math.max(ms, 1e-12)) });
  }

  // 第一道：絕對閘門，丟棄低於 -70 LUFS 的區塊（真正的靜音／噪音底床）
  const absGated = blocks.filter(b => b.l > -70);
  if (absGated.length === 0) return -70;
  const msAbs = avg(absGated.map(b => b.ms));
  const loudAbs = LUFS_OFFSET + 10 * Math.log10(Math.max(msAbs, 1e-12));

  // 第二道：相對閘門，丟棄低於（絕對閘門平均 − 10 LU）的區塊（安靜但非靜音的過渡段）
  const relGated = absGated.filter(b => b.l > loudAbs - 10);
  if (relGated.length === 0) return loudAbs;
  const msRel = avg(relGated.map(b => b.ms));
  return LUFS_OFFSET + 10 * Math.log10(Math.max(msRel, 1e-12));
}

// ===== True Peak（Catmull-Rom 三次插值，4x 過採樣）=====
function truePeak(channel) {
  const n = channel.length;
  let mx = 0;
  // 先納入所有原始 sample，讓零長度與極短素材也有可預期結果。
  for (let i = 0; i < n; i++) mx = Math.max(mx, Math.abs(channel[i]));
  // 端點採相鄰 sample 延伸，讓第一與最後一個 interval 也納入 Estimated True Peak。
  for (let i = 0; i < n - 1; i++) {
    const p0 = channel[i > 0 ? i - 1 : i];
    const p1 = channel[i], p2 = channel[i + 1];
    const p3 = channel[i + 2 < n ? i + 2 : i + 1];
    // t = 0.25 / 0.5 / 0.75
    for (let k = 1; k <= 3; k++) {
      const t = k * 0.25, t2 = t * t, t3 = t2 * t;
      const v = 0.5 * ((2*p1) + (-p0+p2)*t + (2*p0-5*p1+4*p2-p3)*t2 + (-p0+3*p1-3*p2+p3)*t3);
      const a = Math.abs(v);
      if (a > mx) mx = a;
    }
  }
  return toDb(mx);
}

function downmixToMono(channels, len) {
  const mono = new Float32Array(len);
  if (!channels.length) return mono;
  for (const channel of channels) {
    for (let i = 0; i < len; i++) mono[i] += channel[i] / channels.length;
  }
  return mono;
}

// ===== FFT（iterative Cooley-Tukey radix-2）=====
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i],re[j]]=[re[j],re[i]]; [im[i],im[j]]=[im[j],im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i+k], ui = im[i+k];
        const vr = re[i+k+len/2]*cr - im[i+k+len/2]*ci;
        const vi = re[i+k+len/2]*ci + im[i+k+len/2]*cr;
        re[i+k] = ur+vr; im[i+k] = ui+vi;
        re[i+k+len/2] = ur-vr; im[i+k+len/2] = ui-vi;
        const nr = cr*wr - ci*wi; ci = cr*wi + ci*wr; cr = nr;
      }
    }
  }
}

// ===== STFT + 1/3 Octave 頻譜分析 =====
function stftSpectrum(mono, sr) {
  const N = 2048, hop = 512, maxFr = 1200;
  // 最後一個剛好完整的 frame 也必須被納入。
  const totalFr = mono.length >= N ? Math.floor((mono.length - N) / hop) + 1 : 0;
  const step = Math.max(1, Math.floor(totalFr / maxFr));
  const hann = new Float32Array(N);
  for (let i = 0; i < N; i++) hann[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (N - 1)));
  const ap = new Float64Array(N / 2);
  // P_Sib：5-8kHz 跨幀最大功率（近似瞬態峰值，無需額外 DSP）
  const sibPeak = new Float64Array(N / 2);
  let cnt = 0;
  for (let fr = 0; fr < totalFr; fr += step) {
    const s = fr * hop;
    if (s + N > mono.length) break;
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N; i++) re[i] = mono[s + i] * hann[i];
    fft(re, im);
    for (let k = 0; k < N / 2; k++) {
      const pow = re[k]*re[k] + im[k]*im[k];
      ap[k] += pow;
      if (pow > sibPeak[k]) sibPeak[k] = pow;
    }
    cnt++;
  }
  if (cnt === 0) return { ratio: new Float64Array(T3.length), energy: new Float64Array(T3.length), pSib: -96, sfm8k: 1 };
  for (let k = 0; k < N / 2; k++) ap[k] /= cnt;
  const bHz = sr / N;
  const f2 = Math.pow(2, 1 / 6);
  const energy = T3.map(fc => {
    const lo = Math.max(0, Math.floor(fc / f2 / bHz));
    const hi = Math.min(N / 2 - 1, Math.ceil(fc * f2 / bHz));
    let s = 0;
    for (let k = lo; k <= hi; k++) s += ap[k];
    return s;
  });
  const tot = energy.reduce((s, v) => s + v, 0) || 1e-12;
  const ratio = energy.map(e => e / tot);

  // P_Sib：5-8kHz 最大幀峰值 → 近似 dBFS。
  // Hann coherent gain 以實際窗和校正；bin-centered sine 的單邊 FFT 幅度為 A * sum(hann) / 2。
  const sibLo = Math.floor(5000 / bHz), sibHi = Math.min(N/2-1, Math.ceil(8000 / bHz));
  let sibMaxP = 1e-24;
  for (let k = sibLo; k <= sibHi; k++) if (sibPeak[k] > sibMaxP) sibMaxP = sibPeak[k];
  let hannSum = 0;
  for (let i = 0; i < N; i++) hannSum += hann[i];
  const pSib = 10 * Math.log10(sibMaxP / (hannSum * hannSum / 4 + 1e-24));

  // SFM 8-16kHz：幾何平均 / 算術平均（=1 為純白噪，<0.35 表示有諧波結構）
  const airLo = Math.floor(8000 / bHz), airHi = Math.min(N/2-1, Math.ceil(16000 / bHz));
  let airSum = 0, airLogSum = 0, airCnt = 0;
  for (let k = airLo; k <= airHi; k++) {
    const v = ap[k] + 1e-24;
    airSum += v; airLogSum += Math.log(v); airCnt++;
  }
  const sfm8k = airCnt > 0 ? Math.exp(airLogSum / airCnt) / (airSum / airCnt) : 1;

  return { ratio, energy, pSib, sfm8k };
}

// ===== 主分析函式 =====
function analyzeAudio(buf) {
  const sr = buf.sampleRate, ch = buf.numberOfChannels, len = buf.length;
  const channels = Array.from({ length: ch }, (_, c) => buf.getChannelData(c));
  // Downmix 僅供頻譜、ZCR、noise 與波形相關的單聲道衍生指標。
  const mono = downmixToMono(channels, len);
  // Peak / Clipping / DC Offset：保留逐聲道最壞值，避免聲道互相抵消而漏報。
  let smpPk = 0, nearPeakCount = 0;
  let dcOffset = 0;
  const dcSums = new Float64Array(ch);
  for (let i = 0; i < len; i++) {
    let frameNearPeak = false;
    for (let c = 0; c < ch; c++) {
      const sample = channels[c][i];
      const a = Math.abs(sample);
      if (a > smpPk) smpPk = a;
      if (a >= NEAR_FULL_SCALE_AMP) frameNearPeak = true;
      dcSums[c] += sample;
    }
    if (frameNearPeak) nearPeakCount++;
  }
  const smpPkDb = toDb(smpPk);
  for (let c = 0; c < ch; c++) {
    const offset = dcSums[c] / Math.max(len, 1);
    if (Math.abs(offset) > Math.abs(dcOffset)) dcOffset = offset;
  }
  // True Peak（每聲道 4x Catmull-Rom）
  const tpDb = Math.max(...channels.map(truePeak), toDb(0));
  // K-Weighted loudness：每聲道獨立濾波後，逐區塊等權相加。
  const kwRms = integratedLoudness(channels, sr);
  // 逐幀 RMS（50ms，用於 noiseFloor / LRA / silentRatio）
  const fLen = Math.round(sr * 0.05);
  const fDbs = [];
  for (let i = 0; i < len; i += fLen) {
    const e = Math.min(i + fLen, len);
    let s = 0;
    for (let j = i; j < e; j++) s += mono[j] * mono[j];
    fDbs.push(toDb(Math.sqrt(s / (e - i))));
  }
  // 空 buffer 沒有分析幀；以有限的靜音值維持完整結果 shape。
  if (fDbs.length === 0) fDbs.push(toDb(0));
  const sorted = [...fDbs].sort((a, b) => a - b);
  const noiseFloor = pctile(sorted, 0.10);
  const lra  = pctile(sorted, 0.95) - pctile(sorted, 0.10);
  const actFr = fDbs.filter(d => d > noiseFloor + 10);
  const actRms = actFr.length ? avg(actFr) : avg(fDbs);
  const snr  = actRms - noiseFloor;
  const crest = smpPkDb - kwRms;
  const overallRms = avg(fDbs);
  // 靜音段比例
  const silentRatio = fDbs.filter(d => d < noiseFloor + 10).length / fDbs.length;
  // 零交叉率（25ms 幀平均）
  const zfLen = Math.round(sr * 0.025);
  let zcTot = 0, zcCnt = 0;
  for (let i = 0; i < len - zfLen; i += zfLen) {
    let cx = 0;
    for (let j = i + 1; j < i + zfLen; j++) {
      if ((mono[j] >= 0) !== (mono[j-1] >= 0)) cx++;
    }
    zcTot += cx / zfLen;
    zcCnt++;
  }
  const zcr = zcCnt > 0 ? (zcTot / zcCnt) * sr : 0;
  // 立體聲相位（雙聲道以上）
  let stereo = null;
  if (ch >= 2) {
    const L = buf.getChannelData(0), R = buf.getChannelData(1);
    const step = Math.max(1, Math.floor(len / 200000));
    let sL=0,sR=0,sLL=0,sRR=0,sLR=0,n=0;
    for (let i = 0; i < len; i += step) {
      sL+=L[i];sR+=R[i];sLL+=L[i]*L[i];sRR+=R[i]*R[i];sLR+=L[i]*R[i];n++;
    }
    const mL=sL/Math.max(n, 1), mR=sR/Math.max(n, 1);
    const cov=sLR/Math.max(n, 1)-mL*mR, vL=sLL/Math.max(n, 1)-mL*mL, vR=sRR/Math.max(n, 1)-mR*mR;
    const denom=Math.sqrt(vL*vR);
    const corr = clamp(denom > 1e-9 ? cov/denom : 1, -1, 1);
    // +1 代表相同 mono、-1 代表完整反相；兩者不應同時被視為「窄」。
    stereo = { corr, width: (1 - corr) / 2 };
  }
  // STFT + 1/3 Octave 頻譜
  const { ratio: specRatio, energy: specEnergy, pSib, sfm8k } = stftSpectrum(mono, sr);
  // 從 1/3 Octave 計算診斷用寬帶比例與峰值頻率
  function sumR(lo, hi) {
    return T3.reduce((s, fc, i) => fc >= lo && fc <= hi ? s + specRatio[i] : s, 0);
  }
  function peakFc(lo, hi) {
    let mx = -Infinity, fc0 = (lo + hi) / 2;
    T3.forEach((fc, i) => {
      if (fc >= lo && fc <= hi && specEnergy[i] > mx) { mx = specEnergy[i]; fc0 = fc; }
    });
    return fc0;
  }
  const bands = {
    rumble: sumR(20, 80), bass: sumR(60, 250), lowMid: sumR(200, 400),
    mid: sumR(400, 2000), presence: sumR(2000, 5000),
    sibilance: sumR(5000, 8000), hiss: sumR(8000, 16000), vocalOverlap: sumR(250, 4000),
    pkRumble: peakFc(20, 100), pkMuddy: peakFc(200, 500), pkPresence: peakFc(2000, 5000),
    pkSibilance: peakFc(5000, 8000)
  };
  return {
    sr, ch, dur: buf.duration,
    smpPkDb, tpDb, kwRms, noiseFloor, actRms, overallRms,
    snr, crest, peakToLoudness: crest, lra, nearPeakCount, dcOffset, silentRatio, zcr,
    stereo, bands, specRatio, pSib, sfm8k,
    channelCaveat: ch > 2 ? '超過雙聲道：Estimated Integrated Loudness 採各聲道等權加總；頻譜、噪音與波形仍由平均 mono downmix 衍生。' : undefined
  };
}

window.AudioAnalysis = { analyzeAudio, truePeak, integratedLoudness, downmixToMono, T3, clamp, NEAR_FULL_SCALE_AMP };
})();
