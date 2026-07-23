let aCtx = null;
const S = { voice: null, bgm: null };
const TR = { min: -18, max: -14 };

// ===== K-weighted RMS 計算 (ITU-R BS.1770-4) =====
function getKWeightCoeffs(sr) {
  if (sr === 48000) return {
    b1: [1.0, -2.0, 1.0], a1: [1.0, -1.9954457222927063, 0.9954512975022212],
    b2: [1.0, -2.0, 1.0], a2: [1.0, -1.9909494863499124, 0.9909579794518706]
  };
  if (sr === 44100) return {
    b1: [1.0, -2.0, 1.0], a1: [1.0, -1.99543843699025, 0.99544579166295],
    b2: [1.0, -2.0, 1.0], a2: [1.0, -1.98945448143981, 0.98948834325047]
  };
  return {
    b1: [1.0, -2.0, 1.0], a1: [1.0, -1.9954457222927063, 0.9954512975022212],
    b2: [1.0, -2.0, 1.0], a2: [1.0, -1.9909494863499124, 0.9909579794518706]
  };
}

function applyBiquad(sig, b, a) {
  const y = new Float32Array(sig.length);
  let s1 = 0, s2 = 0;
  for (let i = 0; i < sig.length; i++) {
    const x = sig[i];
    const out = b[0] * x + s1;
    s1 = b[1] * x - a[1] * out + s2;
    s2 = b[2] * x - a[2] * out;
    y[i] = out;
  }
  return y;
}

function getKWeightedRms(buf) {
  const cf = getKWeightCoeffs(buf.sampleRate);
  let sig = buf.getChannelData(0);
  sig = applyBiquad(sig, cf.b1, cf.a1);
  sig = applyBiquad(sig, cf.b2, cf.a2);
  let sum = 0;
  for (let i = 0; i < sig.length; i++) sum += sig[i] * sig[i];
  const rms = Math.sqrt(sum / sig.length);
  return 20 * Math.log10(Math.max(rms, 1e-10));
}

// ===== True Peak (4x 插值) =====
function getTruePeak(buf) {
  const sr = buf.sampleRate;
  const ch0 = buf.getChannelData(0);
  const oversample = 4;
  let peak = 0;
  for (let i = 0; i < ch0.length - 3; i++) {
    const y0 = ch0[i], y1 = ch0[i + 1], y2 = ch0[i + 2], y3 = ch0[i + 3];
    for (let j = 0; j < oversample; j++) {
      const t = j / oversample;
      const p0 = 0.5 * t * (3 * (y1 - y2) + y3 - y0),
            p1 = 0.5 * (2 * y2 + y0 - 5 * y1 / 2 + 3 * y1 * t / 2 - y3 * t / 2),
            p2 = 0.5 * (y2 - y0),
            p3 = y1,
            val = p0 * t * t * t + p1 * t * t + p2 * t + p3;
      peak = Math.max(peak, Math.abs(val));
    }
  }
  return peak > 0 ? 20 * Math.log10(peak) : -Infinity;
}

// ===== STFT + 1/3 Octave 頻譜 =====
function getStftSpectrum(buf) {
  const ch0 = buf.getChannelData(0);
  const fftSize = 2048;
  const hop = fftSize / 2;
  const bands = [
    {freq: 25}, {freq: 31.5}, {freq: 40}, {freq: 50}, {freq: 63}, {freq: 80},
    {freq: 100}, {freq: 125}, {freq: 160}, {freq: 200}, {freq: 250}, {freq: 315},
    {freq: 400}, {freq: 500}, {freq: 630}, {freq: 800}, {freq: 1000}, {freq: 1250},
    {freq: 1600}, {freq: 2000}, {freq: 2500}, {freq: 3150}, {freq: 4000}, {freq: 5000},
    {freq: 6300}, {freq: 8000}, {freq: 10000}, {freq: 12500}, {freq: 16000}
  ];
  const energies = new Array(bands.length).fill(0);
  let frameCount = 0;
  for (let i = 0; i + fftSize <= ch0.length; i += hop) {
    const frame = ch0.slice(i, i + fftSize);
    const windowed = frame.map((v, j) => v * (0.5 * (1 - Math.cos(2 * Math.PI * j / (fftSize - 1)))));
    const real = new Array(fftSize).fill(0), imag = new Array(fftSize).fill(0);
    for (let k = 0; k < fftSize; k++) {
      real[k] = windowed[k]; imag[k] = 0;
    }
    let N = fftSize;
    while (N > 1) {
      for (let k = 0; k < N / 2; k++) {
        const w = -2 * Math.PI * k / N;
        for (let m = k; m < fftSize; m += N) {
          const n = m + N / 2;
          const wr = Math.cos(w), wi = Math.sin(w);
          const tr = real[n] * wr - imag[n] * wi, ti = real[n] * wi + imag[n] * wr;
          real[n] = real[m] - tr; imag[n] = imag[m] - ti;
          real[m] += tr; imag[m] += ti;
        }
      }
      N /= 2;
    }
    let bit = 0;
    for (let i = 1; i < fftSize; i++) {
      let b = 0;
      for (let j = 0; j < 11; j++) if ((i & (1 << j)) && (1 << (10 - j)) & fftSize) b |= 1 << (10 - j);
      if (b > bit) [real[i], real[bit], imag[i], imag[bit]] = [real[bit], real[i], imag[bit], imag[i]];
      bit = b;
    }
    for (let k = 0; k < fftSize / 2; k++) {
      const mag = Math.sqrt(real[k] * real[k] + imag[k] * imag[k]);
      const freq = (k * buf.sampleRate) / fftSize;
      for (let b = 0; b < bands.length; b++) {
        const lo = bands[b].freq / Math.pow(2, 0.05), hi = bands[b].freq * Math.pow(2, 0.05);
        if (freq >= lo && freq < hi) {
          energies[b] += mag * mag;
          break;
        }
      }
    }
    frameCount++;
  }
  if (frameCount > 0) for (let b = 0; b < bands.length; b++) energies[b] /= frameCount;
  return bands.map((b, i) => ({ freq: b.freq, db: energies[i] > 0 ? 10 * Math.log10(energies[i] + 1e-10) : -Infinity }));
}

// ===== 核心分析 =====
function analyzeAudio(buf) {
  const ch0 = buf.getChannelData(0);
  const sr = buf.sampleRate;
  const dur = buf.duration;
  const ch = buf.numberOfChannels;
  let smpPk = 0;
  for (let i = 0; i < ch0.length; i++) smpPk = Math.max(smpPk, Math.abs(ch0[i]));
  const kwRms = getKWeightedRms(buf);
  const tpDb = getTruePeak(buf);
  const smpPkDb = 20 * Math.log10(Math.max(smpPk, 1e-10));
  const mean = ch0.reduce((a, v) => a + v) / ch0.length;
  const dcOffset = Math.abs(mean);
  let silentCnt = 0, zcr = 0, sum = 0;
  for (let i = 0; i < ch0.length; i++) {
    const v = Math.abs(ch0[i]);
    if (v < 1e-5) silentCnt++;
    if (i > 0 && ch0[i] * ch0[i - 1] < 0) zcr++;
    sum += v * v;
  }
  const rms = Math.sqrt(sum / ch0.length);
  const noiseFloor = 20 * Math.log10(Math.max(rms / 100, 1e-10));
  const snr = smpPkDb - noiseFloor;
  const silentRatio = silentCnt / ch0.length;
  const crest = smpPkDb - kwRms;
  let lra = 0;
  if (ch0.length > 4800) {
    const blkSize = 4800, blocks = [];
    for (let b = 0; b < ch0.length - blkSize; b += blkSize) {
      let sum = 0;
      for (let i = b; i < b + blkSize; i++) sum += ch0[i] * ch0[i];
      blocks.push(10 * Math.log10(sum / blkSize + 1e-10));
    }
    blocks.sort((a, b) => a - b);
    lra = blocks[Math.ceil(blocks.length * 0.95)] - blocks[Math.floor(blocks.length * 0.05)];
  }
  let stereo = null;
  if (ch > 1) {
    const ch1 = buf.getChannelData(1);
    let num = 0, den0 = 0, den1 = 0;
    for (let i = 0; i < Math.min(ch0.length, ch1.length); i++) {
      num += ch0[i] * ch1[i];
      den0 += ch0[i] * ch0[i];
      den1 += ch1[i] * ch1[i];
    }
    const corr = num / Math.sqrt(den0 * den1 + 1e-10);
    const L = (ch0.reduce((a, v) => a + v * v) / ch0.length) ** 0.5,
          R = (ch1.reduce((a, v) => a + v * v) / ch1.length) ** 0.5;
    const width = (L - R) / (L + R + 1e-10);
    stereo = { corr, width };
  }
  const spec = getStftSpectrum(buf);
  return { sr, dur, ch, smpPkDb, kwRms, tpDb, noiseFloor, snr, crest, lra, dcOffset, silentRatio, zcr: zcr / dur, stereo, spec };
}

// ===== 診斷邏輯 =====
function diagVoice(a) {
  const diags = [];
  if (a.kwRms > TR.max) diags.push({ lvl: 'warn', title: '響度過高', desc: `${a.kwRms.toFixed(1)} dB，超出上限 ${TR.max} dB` });
  if (a.kwRms < TR.min - 3) diags.push({ lvl: 'warn', title: '響度過低', desc: `${a.kwRms.toFixed(1)} dB，低於下限 ${TR.min} dB 超過 3 dB` });
  if (a.tpDb > -3) diags.push({ lvl: 'bad', title: 'True Peak 爆音風險', desc: `${a.tpDb.toFixed(1)} dBTP，建議≤-3 dBTP` });
  if (a.snr < 30) diags.push({ lvl: 'warn', title: 'SNR 偏低', desc: `${a.snr.toFixed(1)} dB，雜訊明顯，建議清潔或重錄` });
  if (a.crest > 15) diags.push({ lvl: 'info', title: 'Crest 偏高', desc: `${a.crest.toFixed(1)} dB，峰值動態大，建議壓縮` });
  if (a.dcOffset > 0.05) diags.push({ lvl: 'warn', title: 'DC Offset 異常', desc: `${a.dcOffset.toFixed(4)}，建議 HP Filter 移除低頻偏移` });
  if (a.silentRatio > 0.2) diags.push({ lvl: 'info', title: '靜音段較多', desc: `${(a.silentRatio*100).toFixed(1)}%，可考慮 Gate 或手動截剪` });
  if (a.stereo && Math.abs(a.stereo.width) > 0.8) diags.push({ lvl: 'info', title: '立體聲寬度異常', desc: `width=${a.stereo.width.toFixed(2)}，人聲宜保持 Mono 或 Narrow` });
  if (a.spec) {
    const mid = a.spec.filter(s => s.freq >= 200 && s.freq <= 4000).sort((a, b) => b.db - a.db)[0];
    if (mid && mid.db > 5) diags.push({ lvl: 'info', title: '中頻堆積', desc: `${mid.freq} Hz 峰值 ${mid.db.toFixed(1)} dB，建議 EQ 減少` });
  }
  return diags.length ? diags : [{ lvl: 'info', title: '正常狀態', desc: '未檢出明顯問題' }];
}

function diagBgm(a) {
  const diags = [];
  if (a.kwRms > TR.max + 3) diags.push({ lvl: 'warn', title: '響度超標', desc: `${a.kwRms.toFixed(1)} dB，配樂宜柔和，建議降低 3–6 dB` });
  if (a.tpDb > -1) diags.push({ lvl: 'bad', title: 'True Peak 爆音', desc: `${a.tpDb.toFixed(1)} dBTP，建議≤-1 dBTP` });
  if (a.crest < 6) diags.push({ lvl: 'info', title: 'Crest 平坦', desc: `${a.crest.toFixed(1)} dB，動態不足，建議提升層次感` });
  if (a.lra < 5) diags.push({ lvl: 'info', title: 'LRA 狹窄', desc: `${a.lra.toFixed(1)} dB，頻譜單調，建議擴展頻寬` });
  if (a.spec) {
    const low = a.spec.filter(s => s.freq < 100).reduce((a, s) => a + s.db, 0) / a.spec.filter(s => s.freq < 100).length;
    if (low > 0) diags.push({ lvl: 'info', title: '低頻過量', desc: `${low.toFixed(1)} dB，建議 HP Filter 或 EQ 減弱` });
  }
  return diags.length ? diags : [{ lvl: 'info', title: '正常狀態', desc: '未檢出明顯問題' }];
}

// ===== 效果器建議 =====
function buildVoiceFx(a) {
  const fx = [];
  const delta = a.kwRms - (TR.min + TR.max) / 2;
  const clipGain = Math.round(Math.max(-delta, 0) * 2) / 2;
  const trackGain = Math.round(delta * 2) / 2;
  fx.push({
    name: '1. Clip Gain',
    params: [[`Gain`, `${clipGain > 0 ? '+' : ''}${clipGain} dB`, '（前置防爆音）']],
    steps: clipGain > 0 ? [`在 Voice 軌前端插入 Clip Gain，設置 ${clipGain} dB 上升限制`] : ['保持預設 0 dB']
  });
  fx.push({
    name: '2. Track Gain',
    params: [[`Gain`, `${trackGain > 0 ? '+' : ''}${trackGain} dB`, '（精校音量）']],
    steps: [`調整 Voice 軌增益至 ${trackGain > 0 ? '+' : ''}${trackGain} dB，令響度達目標 ${((TR.min + TR.max) / 2).toFixed(0)} dB`]
  });
  if (a.snr < 35) {
    fx.push({
      name: '3. DeNoise',
      params: [['Reduction', '3–8 dB', '']],
      steps: ['選擇雜訊印樣 (Noise Print)，設 Reduction 3–8 dB']
    });
  }
  const eqSteps = [];
  if (a.dcOffset > 0.02) eqSteps.push('HP: 20 Hz, -12 dB/oct (移除 DC 和超低頻)');
  if (a.spec) {
    const mid = a.spec.filter(s => s.freq >= 200 && s.freq <= 4000).sort((a, b) => b.db - a.db)[0];
    if (mid && mid.db > 5) eqSteps.push(`Mid Shelf: ${mid.freq} Hz, -3 dB (減少中頻堆積)`);
  }
  if (eqSteps.length) {
    fx.push({
      name: '4. EQ (3-band)',
      params: eqSteps.map((s, i) => [['Band ' + (i + 1), s, '']]),
      steps: eqSteps
    });
  }
  fx.push({
    name: '5. Dynamics',
    params: [['Ratio', '4:1', ''], ['Threshold', `${(a.kwRms + 2).toFixed(0)} dB`, ''], ['Make-up', 'Auto', '']],
    steps: ['Ratio: 4:1, Threshold 置於 RMS 上方 2 dB，啟用 Make-up Gain']
  });
  if (a.zcr > 5000) {
    fx.push({
      name: '6. DeEsser',
      params: [['Freq', '6–8 kHz', ''], ['Depth', '–6 dB', '']],
      steps: ['偵測高頻 S/Sh 音，設 Freq 6–8 kHz，Depth –6 dB']
    });
  }
  fx.push({
    name: '7. Hard Limiter',
    params: [['Ceiling', '-3 dBTP', ''], ['Release', 'Auto', '']],
    steps: ['Ceiling: -3 dBTP (防 Inter-sample 爆音)']
  });
  return fx;
}

function buildBgmFx(a) {
  const fx = [];
  const delta = a.kwRms - (TR.min + TR.max) / 2;
  fx.push({
    name: '1. HP Filter',
    params: [['Freq', '40 Hz', ''], ['Slope', '-12 dB/oct', '']],
    steps: ['移除 40 Hz 以下次低頻，降低混音時的能量衝突']
  });
  if (a.spec && a.spec.filter(s => s.freq < 100).reduce((a, s) => a + s.db, 0) / a.spec.filter(s => s.freq < 100).length > 0) {
    fx.push({
      name: '2. Masking EQ',
      params: [['Band', 'Low-mid', ''], ['Gain', '-3 dB', '']],
      steps: ['Low-mid (100–500 Hz) -3 dB，讓人聲清晰度提升']
    });
  }
  fx.push({
    name: '3. Stereo Expander',
    params: [['Width', '1.1–1.3x', '']],
    steps: ['Stereo Width 1.1–1.3x，增強空間感但勿過度失去相干性']
  });
  fx.push({
    name: '4. Dynamics',
    params: [['Ratio', '2:1', ''], ['Threshold', `${(a.kwRms - 3).toFixed(0)} dB`, ''], ['Make-up', 'Auto', '']],
    steps: ['Ratio 2:1 (溫和壓縮)，控制動態峰值']
  });
  const clipGain = Math.round(Math.max(-delta, 0) * 2) / 2;
  const trackGain = Math.round((delta - 6) * 2) / 2;
  fx.push({
    name: '5. Ducking （兩步驟）',
    params: [
      ['Step 1', `Bed = Voice - 15 dB`, ''],
      ['Step 2', `Ducking -4 dB`, '（額外衰減）']
    ],
    steps: [
      '步驟一：自動避讓 — 以 Voice 軌為觸發源，BGM 自動降 15 dB',
      '步驟二：額外衰減 — 在人聲對白高峰時，BGM 再減 4 dB，避免遮蔽'
    ]
  });
  fx.push({
    name: '6. Limiter',
    params: [['Ceiling', '-1 dBTP', '']],
    steps: ['Ceiling -1 dBTP (BGM 安全天花板，防背景爆音)']
  });
  return fx;
}

function buildMixFx(voiceA, bgmA) {
  return [
    {
      name: 'Essential Sound Panel - Ducking 自動化',
      params: [['Source', 'Voice 軌', ''], ['Target', 'BGM 軌', ''], ['Amount', '-15 dB (底床) + -4 dB (高峰)', '']],
      steps: [
        '在 Premiere 的 Essential Sound Panel 中，選定 BGM 軌',
        '啟用 Ducking，設 Voice 軌為 Trigger Source',
        '底床 (Bed) = -15 dB (常時背景降低)',
        '高峰 (Ducking Amount) = 額外 -4 dB (人聲對白時進一步衰減)'
      ]
    }
  ];
}

// ===== Flags 與狀態管理 =====
function voiceFlags(a) {
  const flags = [];
  if (Math.abs(a.kwRms - ((TR.min + TR.max) / 2)) <= 1) flags.push('Clip Gain');
  if (a.snr < 35) flags.push('DeNoise');
  if (a.crest > 12) flags.push('Dynamics');
  if (a.tpDb > -5) flags.push('Limiter');
  return flags;
}

function bgmFlags(a) {
  const flags = [];
  if (a.kwRms > TR.max) flags.push('HP Filter');
  if (a.crest < 6) flags.push('Stereo Exp');
  if (a.tpDb > -1) flags.push('Limiter');
  return flags;
}

// ===== 渲染函式 =====
function renderMetrics(id, a) {
  const metrics = [
    { label: 'K-RMS', value: a.kwRms.toFixed(1), unit: 'dB', flag: Math.abs(a.kwRms - ((TR.min + TR.max) / 2)) <= 1 ? 'fg' : Math.abs(a.kwRms - ((TR.min + TR.max) / 2)) <= 3 ? 'fw' : 'fb' },
    { label: 'True Peak', value: a.tpDb.toFixed(1), unit: 'dBTP', flag: a.tpDb <= -3 ? 'fg' : a.tpDb <= -1 ? 'fw' : 'fb' },
    { label: 'Sample Peak', value: a.smpPkDb.toFixed(1), unit: 'dBFS', flag: 'fw' },
    { label: 'Noise Floor', value: a.noiseFloor.toFixed(1), unit: 'dBFS', flag: a.snr >= 40 ? 'fg' : a.snr >= 30 ? 'fw' : 'fb' },
    { label: 'SNR', value: a.snr.toFixed(1), unit: 'dB', flag: a.snr >= 40 ? 'fg' : a.snr >= 30 ? 'fw' : 'fb' },
    { label: 'Crest', value: a.crest.toFixed(1), unit: 'dB', flag: 'fw' },
    { label: 'LRA', value: a.lra.toFixed(1), unit: 'dB', flag: 'fw' },
    { label: 'DC Offset', value: a.dcOffset.toFixed(4), unit: '', flag: a.dcOffset > 0.05 ? 'fb' : 'fg' },
    { label: 'Silent %', value: (a.silentRatio * 100).toFixed(1), unit: '%', flag: 'fw' }
  ];
  document.getElementById(id).innerHTML = metrics.map(m =>
    `<div class="mc ${m.flag}"><div class="ml">${m.label}</div><div class="mv">${m.value}</div><div class="mn">${m.unit}</div></div>`
  ).join('');
}

function renderDiags(id, diags) {
  document.getElementById(id).innerHTML = diags.map(d =>
    `<div class="diag"><div class="dhead ${d.lvl === 'bad' ? 'hg' : d.lvl === 'warn' ? 'md' : 'lg'}"><span class="icn">${d.lvl === 'bad' ? '!' : d.lvl === 'warn' ? '⚠' : '✓'}</span> ${d.title}</div><div class="dbody">${d.desc}</div></div>`
  ).join('');
}

function renderFxList(id, fx) {
  document.getElementById(id).innerHTML = fx.map(f =>
    `<div class="fx"><div class="fx-name">${f.name}</div><div class="fx-params">${f.params.map(p => `<div><b>${p[0]}:</b> ${p[1]} ${p[2]}</div>`).join('')}</div><div class="fx-steps">${f.steps.map((s, i) => `<div><strong>${i + 1}.</strong> ${s}</div>`).join('')}</div></div>`
  ).join('');
}

function renderChain(id, flags, trackId) {
  const container = document.getElementById(id);
  if (!container) return;
  container.querySelectorAll('.chain-node').forEach(node => {
    const text = node.textContent.trim();
    node.classList.toggle('active', flags.some(f => text.includes(f)));
  });
}

function renderWaveform(canvasId, buf) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = canvas.offsetWidth * dpr;
  canvas.height = canvas.offsetHeight * dpr;
  ctx.scale(dpr, dpr);
  const w = canvas.offsetWidth, h = canvas.offsetHeight;
  ctx.fillStyle = '#20242c';
  ctx.fillRect(0, 0, w, h);
  const ch0 = buf.getChannelData(0);
  const step = Math.ceil(ch0.length / w);
  ctx.strokeStyle = '#5ec9a3';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < w; i++) {
    let min = 0, max = 0;
    for (let j = 0; j < step && i * step + j < ch0.length; j++) {
      const v = ch0[i * step + j];
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
    const cy = h / 2;
    const y1 = cy - max * (h / 2);
    const y2 = cy - min * (h / 2);
    if (i === 0) ctx.moveTo(i, y1);
    else ctx.lineTo(i, y1);
    ctx.lineTo(i, y2);
  }
  ctx.stroke();
  // 削頂標紅
  ctx.strokeStyle = '#ff5c5c';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < w; i++) {
    for (let j = 0; j < step && i * step + j < ch0.length; j++) {
      if (Math.abs(ch0[i * step + j]) >= 0.9953 / 2) {
        const cy = h / 2;
        const y = cy - ch0[i * step + j] * (h / 2);
        ctx.fillRect(i, y - 1, 1, 2);
      }
    }
  }
}

function renderSpectrum(specId, spec) {
  const container = document.getElementById(specId);
  if (!container) return;
  const normalized = spec.map(s => ({ freq: s.freq, db: Math.max(s.db, -60) }));
  const maxDb = Math.max(...normalized.map(s => s.db));
  container.innerHTML = normalized.map(s =>
    `<div class="sr"><div class="sl">${s.freq} Hz</div><div class="st"><div class="sf" style="width:${Math.max(0, (s.db / maxDb) * 100)}%"></div></div><div class="sp">${s.db.toFixed(0)}</div></div>`
  ).join('');
}

function render(tid, a, filename, buf) {
  S[tid] = { a, filename };
  const tabEl = document.querySelector(`.tab[data-track="${tid}"]`);
  if (!tabEl) return;
  tabEl.classList.add('done');
  renderMetrics('mg-' + tid, a);
  renderDiags('dl-' + tid, tid === 'voice' ? diagVoice(a) : diagBgm(a));
  const fx = tid === 'voice' ? buildVoiceFx(a) : buildBgmFx(a);
  renderFxList('fl-' + tid, fx);
  const flags = tid === 'voice' ? voiceFlags(a) : bgmFlags(a);
  renderChain('chain-' + tid, flags, tid);
  renderWaveform('wf-' + tid, buf);
  renderSpectrum('spec-' + tid, a.spec);
  document.getElementById('res-' + tid).classList.add('show');
  updateMix();
}

function updateMix() {
  if (S.voice && S.bgm) {
    const fx = buildMixFx(S.voice.a, S.bgm.a);
    renderFxList('fl-mix', fx);
    document.getElementById('res-mix').classList.add('show');
  } else {
    document.getElementById('res-mix').classList.remove('show');
  }
}

// ===== 即時重算（目標區間改變時）=====
function rerenderAll() {
  ['voice','bgm'].forEach(trackId => {
    if (!S[trackId]) return;
    const a = S[trackId].a;
    renderMetrics('mg-' + trackId, a);
    renderDiags('dl-' + trackId, trackId==='voice'?diagVoice(a):diagBgm(a));
    const fx = trackId==='voice'?buildVoiceFx(a):buildBgmFx(a);
    renderFxList('fl-' + trackId, fx);
    const flags = trackId==='voice'?voiceFlags(a):bgmFlags(a);
    renderChain('chain-' + trackId, flags, trackId);
  });
  updateMix();
}

// ===== Loading Overlay =====
function showLoad(msg) {
  document.getElementById('ldMsg').textContent = msg;
  document.getElementById('loadingOverlay').classList.add('show');
}
function hideLoad() { document.getElementById('loadingOverlay').classList.remove('show'); }

// ===== 檔案處理 =====
function initTrack(tid) {
  const drop = document.getElementById('drop-' + tid);
  const fi   = document.getElementById('fi-' + tid);
  const accentColor = tid === 'voice' ? '#5ec9a3' : '#7aa2ff';
  drop.style.setProperty('--accent-track', accentColor);
  ['dragenter','dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('drag'); }));
  ['dragleave','drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('drag'); }));
  drop.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) handleFile(tid, f); });
  drop.addEventListener('click', () => fi.click());
  fi.addEventListener('change', e => { if (e.target.files[0]) handleFile(tid, e.target.files[0]); });
}
initTrack('voice');
initTrack('bgm');

document.querySelectorAll('.rl').forEach(btn => {
  btn.addEventListener('click', () => document.getElementById(btn.dataset.t).click());
});

async function handleFile(tid, file) {
  const fb  = document.getElementById('fb-' + tid);
  const stEl = document.getElementById('st-' + tid);
  const res  = document.getElementById('res-' + tid);
  const setSt = msg => { stEl.textContent = msg; stEl.classList.toggle('show', !!msg); };

  fb.classList.add('show');
  document.getElementById('fn-' + tid).textContent = file.name;
  document.getElementById('fm-' + tid).textContent = `(${(file.size/1024/1024).toFixed(2)} MB)`;
  res.classList.remove('show');

  showLoad('智慧調音分析中，請勿關閉網頁…');
  // 雙 rAF：確保 Overlay 渲染完成再開始計算
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

  try {
    aCtx = aCtx || new (window.AudioContext || window.webkitAudioContext)();
    setSt('解碼音訊中…');
    const ab = await file.arrayBuffer();
    const buf = await aCtx.decodeAudioData(ab);
    setSt('');
    const a = analyzeAudio(buf);
    render(tid, a, file.name, buf);
  } catch (err) {
    setSt('解碼失敗：' + err.message + '（請確認瀏覽器支援此格式）');
  } finally {
    hideLoad();
  }
}

// ===== Tabs =====
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('panel-' + tab.dataset.track).classList.add('active');
    document.documentElement.style.setProperty('--accent-track', tab.dataset.track==='voice'?'#5ec9a3':'#7aa2ff');
  });
});

// ===== 目標響度區間 UI =====
function updateRangeUI() {
  const { min, max } = TR;
  document.getElementById('rDisp').textContent = `${min} dB ~ ${max} dB`;
  document.getElementById('mDisp').textContent = `${(min+max)/2} dB`;
  rerenderAll();
}
document.querySelectorAll('.preset:not(#customBtn)').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.preset').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('customRow').classList.remove('show');
    TR.min = parseInt(btn.dataset.min);
    TR.max = parseInt(btn.dataset.max);
    updateRangeUI();
  });
});
document.getElementById('customBtn').addEventListener('click', () => {
  document.querySelectorAll('.preset').forEach(b => b.classList.remove('active'));
  document.getElementById('customBtn').classList.add('active');
  document.getElementById('customRow').classList.add('show');
  TR.min = parseInt(document.getElementById('cMin').value) || -18;
  TR.max = parseInt(document.getElementById('cMax').value) || -14;
  updateRangeUI();
});
document.getElementById('cMin').addEventListener('input', e => { TR.min = parseInt(e.target.value)||TR.min; updateRangeUI(); });
document.getElementById('cMax').addEventListener('input', e => { TR.max = parseInt(e.target.value)||TR.max; updateRangeUI(); });

// ===== 初始化效果鏈（頁面載入時顯示灰色預設）=====
(function initChains() {
  const voiceNodes = ['Clip Gain','DeNoise','EQ','Dynamics','DeEsser','Limiter'];
  const bgmNodes   = ['HP Filter','Masking EQ','Stereo Exp','Dynamics','→ Ducking'];
  function buildChain(nodes, id) {
    document.getElementById(id).innerHTML = nodes.map((n, i) =>
      `<div class="chain-node">${n}</div>` + (i < nodes.length-1 ? '<span class="chain-arr">→</span>' : '')
    ).join('');
  }
  buildChain(voiceNodes, 'chain-voice');
  buildChain(bgmNodes, 'chain-bgm');
})();

// ===== 複製報告 =====
function buildReport() {
  const { min, max } = TR;
  let t = `PR/AU 音訊診斷報告\n目標響度區間：${min} dB ~ ${max} dB（中值 ${(min+max)/2} dB）\n${'='.repeat(44)}\n\n`;
  ['voice','bgm'].forEach(tid => {
    const s = S[tid], lbl = tid==='voice'?'人聲 Voice':'BGM 配樂';
    if (!s) { t += `[${lbl}]\n（尚未上傳分析）\n\n`; return; }
    const a = s.a;
    t += `[${lbl}] ${s.filename}\n${'-'.repeat(36)}\n`;
    t += `取樣率/聲道: ${a.sr}Hz/${a.ch}ch　時長: ${a.dur.toFixed(1)}s\n`;
    t += `K-weighted RMS: ${a.kwRms.toFixed(1)} dB　目標: [${min}~${max}]\n`;
    t += `Sample Peak: ${a.smpPkDb.toFixed(1)} dBFS　True Peak: ${a.tpDb.toFixed(1)} dBTP\n`;
    t += `Noise Floor: ${a.noiseFloor.toFixed(1)} dBFS　SNR: ${a.snr.toFixed(1)} dB\n`;
    t += `Crest: ${a.crest.toFixed(1)} dB　LRA: ${a.lra.toFixed(1)} dB\n`;
    t += `DC Offset: ${a.dcOffset.toFixed(4)}　Silent Ratio: ${(a.silentRatio*100).toFixed(1)}%　ZCR: ${Math.round(a.zcr)}/s\n`;
    if (a.stereo) t += `Stereo: corr=${a.stereo.corr.toFixed(2)} width=${a.stereo.width.toFixed(2)}\n`;
    const diags = tid==='voice'?diagVoice(a):diagBgm(a);
    t += `\n診斷:\n` + diags.map(d => `- [${d.lvl.toUpperCase()}] ${d.title}: ${d.desc.replace(/<[^>]+>/g,'')}`).join('\n') + '\n\n';
    const fx = tid==='voice'?buildVoiceFx(a):buildBgmFx(a);
    t += `PR/AU 效果器建議:\n`;
    fx.forEach(f => {
      t += `■ ${f.name}\n`;
      f.params.forEach(p => t += `  ${p[0]}: ${p[1]}　${p[2]}\n`);
      f.steps.forEach((s, i) => t += `  ${i+1}. ${s.replace(/<[^>]+>/g,'')}\n`);
      t += '\n';
    });
  });
  if (S.voice && S.bgm) {
    t += `[人聲 × BGM 混音建議]\n${'-'.repeat(36)}\n`;
    buildMixFx(S.voice.a, S.bgm.a).forEach(f => {
      t += `■ ${f.name}\n`;
      f.params.forEach(p => t += `  ${p[0]}: ${p[1]}　${p[2]}\n`);
      f.steps.forEach((s, i) => t += `  ${i+1}. ${s.replace(/<[^>]+>/g,'')}\n`);
    });
  }
  return t;
}
document.getElementById('copyBtn').addEventListener('click', () => {
  navigator.clipboard.writeText(buildReport()).then(() => {
    const btn = document.getElementById('copyBtn');
    const orig = btn.innerHTML;
    btn.textContent = '已複製';
    setTimeout(() => btn.innerHTML = orig, 1500);
  });
});

// 初始設定 accent-track（預設人聲 tab 啟動）
document.documentElement.style.setProperty('--accent-track', '#5ec9a3');
