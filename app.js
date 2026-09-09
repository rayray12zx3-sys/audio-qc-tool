// ===== 常數 =====
const APP_VERSION = '0.3.2';
const APP_UPDATED_AT = '2026-09-09';
const NOISE_BASE  = -60;
const PEAK_SAFETY_MARGIN_DB = 1;
const BGM_MASK_TH = 0.32;
const P_SIB_AIR_THRESHOLD_DBFS = -9.0;

// ===== 常用響度起始目標 Presets（數據包 1）=====
const PLATFORM_PRESETS = {
  youtube:   { label: 'Online / Streaming',        targetLufs: -14, targetTp: -1.0, social: false },
  podcast:   { label: 'Spoken / Podcast',          targetLufs: -16, targetTp: -1.0, social: false },
  social:    { label: 'Short-form',                targetLufs: -11, targetTp: -1.0, social: true  },
  broadcast: { label: 'Broadcast-style reference', targetLufs: -23, targetTp: -2.0, social: false },
  custom:    { label: 'Custom',                    targetLufs: -16, targetTp: -1.0, social: false  }
};

// ===== BGM Ducking 內容類型矩陣（數據包 3）=====
const DUCK_MATRIX = {
  vlog:    { label: 'Vlog / 輕鬆內容', attMin: -20, attMax: -15, atkMin: 10,  atkMax: 30,  relMin: 250, relMax: 400 },
  podcast: { label: 'Podcast / 訪談',  attMin: -18, attMax: -14, atkMin: 20,  atkMax: 50,  relMin: 400, relMax: 600 }
};

// 1/3 Octave 中心頻率（ISO 266，30 個 band，index 0-29）

let aCtx;
let PLATFORM  = PLATFORM_PRESETS.youtube;
let OUT_FMT   = 'wav';   // 'wav' | 'lossy'
let DUCK_TYPE = 'vlog';  // 'vlog' | 'podcast'
const S = { voice: null, bgm: null };
const analysisRuns = { voice: 0, bgm: 0 };
let activeAnalysisCount = 0;

const { analyzeAudio, downmixToMono, T3, clamp, NEAR_FULL_SCALE_AMP } = window.AudioAnalysis;
const monoDerivedReliable = a => !a.stereo || a.stereo.corr >= 0;
const peakToLoudness = a => a.peakToLoudness ?? a.crest;
// ===== 診斷：共用 =====
function diagCommon(a) {
  const d = [];
  if (a.smpPkDb >= -0.3) {
    d.push({ title:'接近滿刻度（削波風險）', lvl:'mid',
      desc:`Sample Peak <code>${a.smpPkDb.toFixed(1)} dBFS</code> / Estimated True Peak <code>${a.tpDb.toFixed(1)} dBTP</code>，偵測到 <code>${a.nearPeakCount}</code> 個接近滿刻度樣本。這是瀏覽器端近似的削波風險指標，不能單獨證明已發生不可逆失真；請以波形、耳聽與專業 meter 複核。` });
  } else if (a.tpDb > -1.0) {
    d.push({ title:'Estimated True Peak 過高（Inter-sample 爆音風險）', lvl:'mid',
      desc:`Estimated True Peak <code>${a.tpDb.toFixed(1)} dBTP</code> 超過 −1.0 dBTP 參考線，轉檔或播放時可能有爆音風險，建議 Hard Limiter 限幅並用專業 meter 複核。` });
  }
  if (Math.abs(a.dcOffset) > 0.02) {
    d.push({ title:'DC Offset 直流偏移', lvl: Math.abs(a.dcOffset)>0.05?'mid':'light',
      desc:`DC Offset 值 <code>${a.dcOffset.toFixed(4)}</code>，可能造成剪輯點爆音或動態損失，建議 AU 執行 <code>Favorites → DC Offset Correction</code>。` });
  }
  if (a.stereo) {
    if (a.stereo.corr < 0) {
      d.push({ title:'立體聲相位反相', lvl: a.stereo.corr<-0.3?'severe':'mid',
        desc:`相關係數 <code>${a.stereo.corr.toFixed(2)}</code> 為負值，混為單聲道時可能出現能量抵消（Phase Cancellation），建議檢查是否誤用了反相（Phase Invert）處理。` });
    } else if (a.stereo.corr > 0.98 && a.stereo.width < 0.15) {
      d.push({ title:'立體聲場極窄（近似單聲道）', lvl:'light',
        desc:`相關係數 <code>${a.stereo.corr.toFixed(2)}</code>，左右聲道幾乎完全重疊，若需要空間感可考慮 Stereo Expander。` });
    }
  }
  return d;
}

// ===== 診斷：人聲 =====
function diagVoice(a) {
  const d = diagCommon(a);
  const tgt = PLATFORM.targetLufs;
  if (a.kwRms < tgt - 1) {
    const diff = tgt - a.kwRms;
    d.push({ title:'人聲音量不足', lvl: diff>8?'severe':'mid',
      desc:`Integrated Loudness <code>${a.kwRms.toFixed(1)} LUFS</code>，低於平台目標 <code>${tgt} LUFS</code>，差距 <code>${diff.toFixed(1)} dB</code>（${PLATFORM.label}）。` });
  } else if (a.kwRms > tgt + 1) {
    d.push({ title:'人聲音量過高', lvl: a.kwRms>tgt+6?'severe':'mid',
      desc:`Integrated Loudness <code>${a.kwRms.toFixed(1)} LUFS</code>，高於平台目標 <code>${tgt} LUFS</code>。` });
  }
  if (monoDerivedReliable(a) && a.noiseFloor > NOISE_BASE) {
    const ov = a.noiseFloor - NOISE_BASE;
    d.push({ title:'背景雜音顯著', lvl: ov>20?'severe':ov>10?'mid':'light',
      desc:`Estimated noise-floor proxy <code>${a.noiseFloor.toFixed(1)} dBFS</code>，高於基準 <code>${NOISE_BASE} dBFS</code>，SNR ≈ <code>${a.snr.toFixed(1)} dB</code>。` });
  }
  if (peakToLoudness(a) > 18) {
    d.push({ title:'Peak-to-Loudness difference 偏大（PLR-like）', lvl: peakToLoudness(a)>26?'severe':'mid',
      desc:`Peak-to-Loudness difference（PLR-like）<code>${peakToLoudness(a).toFixed(1)} dB</code>，音量可能忽大忽小，建議以耳聽確認後再壓縮。` });
  }
  {
    const rawGain = PLATFORM.targetLufs - a.kwRms;
    const effTp = getEffectiveTp();
    const safeGain = Math.round((effTp - a.tpDb - PEAK_SAFETY_MARGIN_DB) * 10) / 10;
    if (rawGain > safeGain + 0.1) {
      d.push({ title:'Clip Gain 削波風險', lvl:'severe',
        desc:`欲達 ${PLATFORM.label} 目標需增益 <code>+${rawGain.toFixed(1)} dB</code>，但 Estimated True Peak 為 <code>${a.tpDb.toFixed(1)} dBTP</code>，全額套用將超過 ${effTp} dBTP 參考上限。已依 <code>${PEAK_SAFETY_MARGIN_DB} dB</code> 保守餘裕限制 Clip Gain 於建議值 <code>${safeGain>=0?'+':''}${safeGain.toFixed(1)} dB</code>，剩餘 <code>+${(rawGain-safeGain).toFixed(1)} dB</code> 改由 Compressor MakeUp 承擔。` });
    }
  }
  if (monoDerivedReliable(a) && a.lra > 22) {
    d.push({ title:'RMS Range 過大（LRA-like）', lvl:'mid',
      desc:`各句電平落差約 <code>${a.lra.toFixed(1)} dB</code>，句子間忽大忽小，建議加大壓縮比或使用 Speech Volume Leveler。` });
  }
  if (monoDerivedReliable(a) && a.bands.rumble > 0.06) {
    d.push({ title:'低頻隆隆聲（Rumble）', lvl: a.bands.rumble>0.12?'mid':'light',
      desc:`20–80Hz 能量佔比 <code>${(a.bands.rumble*100).toFixed(1)}%</code>，STFT 峰值頻率 <code>${a.bands.pkRumble} Hz</code>，多為風切、桌面震動或空調噪音。` });
  }
  if (monoDerivedReliable(a) && a.bands.lowMid > 0.18) {
    d.push({ title:'中低頻濁厚（Muddiness）', lvl:'light',
      desc:`200–400Hz 能量佔比 <code>${(a.bands.lowMid*100).toFixed(1)}%</code>，STFT 峰值頻率 <code>${a.bands.pkMuddy} Hz</code>，建議針對此頻率做 EQ 削減。` });
  }
  if (monoDerivedReliable(a) && a.bands.presence < 0.03) {
    d.push({ title:'聲音悶、缺乏臨場感', lvl:'light',
      desc:`2–5kHz 臨場頻段能量佔比僅 <code>${(a.bands.presence*100).toFixed(1)}%</code>，STFT 顯示 <code>${a.bands.pkPresence} Hz</code> 能量偏低，建議在此提升。` });
  }
  if (monoDerivedReliable(a) && a.bands.hiss > 0.05) {
    d.push({ title:'高頻噪音／嘶聲', lvl: a.bands.hiss>0.10?'mid':'light',
      desc:`8kHz 以上能量佔比 <code>${(a.bands.hiss*100).toFixed(1)}%</code>，可能來自麥克風底噪或壓縮雜訊。` });
  }
  if (monoDerivedReliable(a) && a.bands.sibilance > 0.06) {
    d.push({ title:'齒音過重（Sibilance）', lvl: a.bands.sibilance>0.12?'mid':'light',
      desc:`5–8kHz 齒音頻段能量佔比 <code>${(a.bands.sibilance*100).toFixed(1)}%</code>，STFT 峰值頻率 <code>${a.bands.pkSibilance} Hz</code>，發 S/Sh/Z 等摩擦音時偏刺耳，建議加 DeEsser。` });
  }
  if (monoDerivedReliable(a) && a.zcr > 12000) {
    d.push({ title:'零交叉率偏高', lvl:'light',
      desc:`每秒零交叉次數 <code>${Math.round(a.zcr).toLocaleString()}</code>，高於常見語音參考範圍（3000–8000/s），可能含有明顯高頻雜訊或電磁干擾。` });
  }
  if (d.length === 0) d.push({ title:'目前未見明顯風險', lvl:'light', desc:'這份瀏覽器端估算目前未見明顯異常，可依效果鏈做基本收尾，最終仍建議以耳聽與 meter 複核。' });
  return d;
}

// ===== 診斷：BGM =====
function diagBgm(a) {
  const d = diagCommon(a);
  if (monoDerivedReliable(a) && a.bands.vocalOverlap > BGM_MASK_TH) {
    d.push({ title:'BGM 語音頻帶能量偏高（可能遮蔽）', lvl:'light',
      desc:`BGM 的 250–4000Hz 語音頻帶能量偏高（<code>${(a.bands.vocalOverlap*100).toFixed(1)}%</code>），可能遮蔽對白；此為 BGM-only heuristic，未跨軌比較，信心低。` });
  }
  if (monoDerivedReliable(a) && a.bands.rumble > 0.08) {
    d.push({ title:'BGM 低頻堆積', lvl: a.bands.rumble>0.15?'mid':'light',
      desc:`20–80Hz 能量佔比 <code>${(a.bands.rumble*100).toFixed(1)}%</code>，與人聲混音時容易混濁，建議 High-Pass 收斂。` });
  }
  if (monoDerivedReliable(a) && a.lra > 16) {
    d.push({ title:'BGM 動態起伏過大', lvl:'light',
      desc:`響度變化範圍約 <code>${a.lra.toFixed(1)} dB</code>，段落間音量落差明顯，建議先壓縮穩定電平再設 Ducking。` });
  }
  if (a.stereo && a.stereo.corr >= 0 && a.stereo.width < 0.15) {
    d.push({ title:'BGM 聲場偏窄', lvl:'light',
      desc:`聲像寬度指標 <code>${a.stereo.width.toFixed(2)}</code>（0=單聲道 1=極寬），作為背景配樂可考慮 Stereo Expander 讓出中央聲像。` });
  }
  if (d.length === 0) d.push({ title:'BGM 目前未見明顯風險', lvl:'light', desc:'這份瀏覽器端估算目前未見明顯異常，可先依混音建議設定電平與頻段避讓，最終仍建議以耳聽複核。' });
  return d;
}

// ===== 效果鏈 Flags =====
function voiceFlags(a) {
  const monoSafe = monoDerivedReliable(a);
  const delta = PLATFORM.targetLufs - a.kwRms;
  const rumble = monoSafe && a.bands.rumble > 0.06;
  const muddy  = monoSafe && a.bands.lowMid > 0.18;
  const dull   = monoSafe && a.bands.presence < 0.03;
  const hiss   = monoSafe && a.bands.hiss > 0.05;
  const sibilance = monoSafe && a.bands.sibilance > 0.06;
  const denoiseAmt = monoSafe ? clamp(Math.round((a.noiseFloor - NOISE_BASE) / 30 * 80), 0, 80) : 0;
  const needsComp  = peakToLoudness(a) > 18 || (monoSafe && a.lra > 22) || Math.abs(delta) >= 1.5 || a.kwRms > PLATFORM.targetLufs;

  // ===== 空氣感三重防禦閘門（數據包 4）=====
  const airC1 = monoSafe && a.noiseFloor <= NOISE_BASE && a.snr > 12.0;           // 噪底 & SNR
  const airC2 = monoSafe && (a.sfm8k ?? 1) <= 0.35;                                // 8-16kHz 頻譜平坦度
  // P_Sib 改為正規化尺度後，-9 dBFS 對應原 -15 的決策邊界；非聆聽調參。
  const airC3 = monoSafe && a.bands.sibilance <= 0.06 && (a.pSib ?? 0) <= P_SIB_AIR_THRESHOLD_DBFS;
  const airShelf = monoSafe && airC1 && airC2 && airC3;
  let airBlock = '';
  if (!monoSafe) airBlock = '左右聲道負相關，mono downmix 指標信心低，已停用 Noise／EQ／齒音衍生建議';
  else if (!airC1) airBlock = '檢測到高頻噪底過高，已阻斷空氣感提升以防底噪放大';
  else if (!airC2) airBlock = '8–16kHz 頻譜平坦度偏高（疑似雜訊而非諧波），已阻斷空氣感提升';
  else if (!airC3) airBlock = '高頻齒音過重，請先使用 De-Esser 修復後再評估空氣感提升';

  return { clipGain:true, denoise:denoiseAmt>5, eq:rumble||muddy||dull||airShelf,
           dynamics:needsComp, deEsser:sibilance, limiter:true,
           rumble, muddy, dull, hiss, sibilance, denoiseAmt, needsComp, delta,
           airShelf, airBlock };
}
function bgmFlags(a) {
  const monoSafe = monoDerivedReliable(a);
  // BGM-only 頻帶 heuristic；未與人聲頻譜做跨軌比較。
  const mudSer   = monoSafe && a.bands.lowMid  > 0.35;  // 200-400Hz 頻段能量比 > 35%
  const midSer   = monoSafe && a.bands.mid    > 0.25;   // 400-2000Hz 頻段能量比 > 25%
  return {
    hp: monoSafe && a.bands.rumble > 0.08,
    maskLowMid: mudSer,   // 200-500Hz 低中頻泥濘
    maskMid: midSer,      // 1k-3kHz 人聲核心遮蔽
    maskEq: monoSafe && (mudSer || midSer || a.bands.vocalOverlap > BGM_MASK_TH),
    stereo: a.stereo && a.stereo.corr >= 0 && a.stereo.width < 0.15,
    dynamics: monoSafe && a.lra > 16,
    ducking: true
  };
}

// ===== 效果器輔助：Adobe 滑桿數學對映（數據包 2）=====
// Dynamics 滑桿 S(0-10)： T(S) = -10.0 - 2.0*S ,  R(S) = 1.0 + 0.4*S
function dynamicsSliderFromThreshold(thrDb) {
  const S = (-10.0 - thrDb) / 2.0;
  return clamp(Math.round(S * 10) / 10, 0, 10);
}
function dynamicsRatioFromSlider(S) { return (1.0 + 0.4 * S).toFixed(1); }
// DeEss 滑桿 D(0-10)：三點校準 (4,-6.5) (6,-11.0) (8,-16.0)，分段線性插值/外插
function deEssSliderFromAttenuation(targetDb) {
  const pts = [[0,0],[4,-6.5],[6,-11.0],[8,-16.0],[10,-20.5]]; // 10 用 6-8 斜率外插
  for (let i = 0; i < pts.length - 1; i++) {
    const [d0, v0] = pts[i], [d1, v1] = pts[i+1];
    if (targetDb <= v0 && targetDb >= v1) {
      const ratio = (targetDb - v0) / (v1 - v0);
      return clamp(Math.round((d0 + ratio * (d1 - d0)) * 10) / 10, 0, 10);
    }
  }
  return targetDb < -20.5 ? 10 : 0;
}
// 有損壓縮覆寫：空氣感增益上限 1.5→1.0dB；True Peak 進一步壓低至 -1.0（若原設定更嚴則維持）
function getEffectiveTp() {
  return OUT_FMT === 'lossy' ? Math.min(PLATFORM.targetTp, -1.0) : PLATFORM.targetTp;
}
function getAirGainMax() { return OUT_FMT === 'lossy' ? 1.0 : 1.5; }

// ===== PR/AU 效果器建議：人聲（Step 0-4 建議線性流程，數據包 6）=====
function buildVoiceFx(a) {
  const tgt = PLATFORM.targetLufs;
  const effTp = getEffectiveTp();
  const delta = tgt - a.kwRms;
  const inRange = Math.abs(a.kwRms - tgt) <= 1;

  // --- 保守增益上限：Estimated True Peak 僅供估算，匯出後仍須 meter 複核。 ---
  const maxSafeGain = Math.round((effTp - a.tpDb - PEAK_SAFETY_MARGIN_DB) * 10) / 10;
  const cgValRaw = Math.round(delta * 10) / 10;
  const cgVal = cgValRaw > maxSafeGain ? maxSafeGain : cgValRaw;
  const gainCapped = cgValRaw > maxSafeGain + 0.05;
  const residual = Math.round((cgValRaw - cgVal) * 10) / 10;

  const flags = voiceFlags(a);
  if (Math.abs(residual) > 0.1) flags.needsComp = true;
  const fx = [];

  // ===== Step 0：Gain Staging 響度先行 =====
  fx.push({
    id:'clipgain', pathLabel:`Step 0 · Gain Staging（響度先行 / 目標平台：${PLATFORM.label}）`,
    name:'Clip Gain（建議增益前置）',
    why: gainCapped
      ? `原始 Delta = ${cgValRaw>=0?'+':''}${cgValRaw} dB，但套用後 Estimated True Peak 將超過 ${effTp} dBTP 參考上限（${OUT_FMT==='lossy'?'已依有損壓縮規則收斂':'依平台規範'}）。已限制於建議增益 = ${cgVal>=0?'+':''}${cgVal} dB`
      : `Delta = Target(${tgt} LUFS) − Integrated(${a.kwRms.toFixed(1)} LUFS) = ${cgVal>=0?'+':''}${cgVal} dB`,
    params:[
        ['Set Gain To', `${cgVal>=0?'+':''}${cgVal} dB`, gainCapped ? '⚠️ 已達估算上限，剩餘增益轉由 Compressor 承擔；匯出後仍須 meter 複核' : '拉至目標響度，後續效果器 Gain 均設 0'],
      ['Normalize All Peaks To','不使用','以增益值（非峰值正規化）控制，保留動態比例']
    ],
    steps:[
      '選取人聲 Clip → 右鍵 → <b>Audio Gain</b>（快捷鍵 G）',
      `<b>Set Gain To</b> 輸入 <b>${cgVal>=0?'+':''}${cgVal} dB</b>`,
      gainCapped
        ? `⚠️ 此素材 Peak-to-Loudness difference（PLR-like）偏大（${peakToLoudness(a).toFixed(1)} dB），全額增益可能使 Estimated True Peak 超過 ${effTp} dBTP 參考線。剩餘 <b>${residual>=0?'+':''}${residual} dB</b> 已轉由 <b>Compressor MakeUp</b> 於壓縮後補足`
        : '確認後進入效果鏈，Compressor MakeUp 與 Limiter Input Boost 均設 0（避免雙重疊加；匯出後仍須 meter 複核）'
    ],
    note: (gainCapped
      ? `⚠️ <b>Estimated True Peak 保守上限</b>：Clip Gain 上限 = (${effTp}dBTP − Estimated True Peak ${a.tpDb.toFixed(1)}dBTP − 餘裕${PEAK_SAFETY_MARGIN_DB}dB) = <b>${cgVal>=0?'+':''}${cgVal} dB</b>。剩餘 <b>${residual>=0?'+':''}${residual} dB</b> 已改由 <b>Compressor MakeUp</b> 承擔；不保證避免削波，匯出後請 meter 複核。`
      : `採用此步驟後，以下 Dynamics 的 <b>MakeUp 設 0 dB</b>、Limiter 的 <b>Input Boost 設 0 dB</b>，防止雙重增益爆音。`)
      + ` ⚠️ 請勿另外執行 PR/AU 的「Auto-Match（自動匹配）響度」——該功能目標值由 Adobe 內部演算法決定、與本工具計算基準不同，疊加會使最終響度偏離 ${tgt} LUFS 目標。此 Clip Gain 數值是建議設定，匯出前仍需複核。`
  });

  // ===== Step 1：Repair 修復（DeNoise）=====
  if (flags.denoiseAmt > 5) {
    const focus = flags.rumble && flags.hiss ? 'Highest and Lowest Frequencies'
                : flags.rumble ? 'Lower Frequencies'
                : flags.hiss  ? 'Higher Frequencies'
                : 'All Frequencies';
    const gc = clamp(Math.round(flags.denoiseAmt * 0.04), 0, 3);
    fx.push({
      id:'denoise', pathLabel:'Step 1 · Repair（修復與還原）',
      name:'DeNoise',
      why:`Estimated noise-floor proxy ${a.noiseFloor.toFixed(1)} dBFS → 降噪量 ${flags.denoiseAmt}%`,
      params:[
        ['Processing Focus', focus, '依頻譜集中位置鎖定噪音頻段'],
        ['Amount', `${flags.denoiseAmt}%`, '過高導致人聲金屬感（Metal Sound），以耳聽確認'],
        ['Output Noise Only','False','僅供試聽噪音樣貌，正式套用需關閉'],
        ['Gain', `+${gc} dB`, '補償降噪後的音量損失']
      ],
      steps:[
        '效果面板搜尋 <b>DeNoise</b>，拖曳至音軌',
        `<b>Processing Focus</b> 選 <b>${focus}</b>，<b>Amount</b> 設為 <b>${flags.denoiseAmt}%</b>`,
        '暫時勾選 <b>Output Noise Only</b> 試聽被濾除的內容，確認未誤切人聲後關閉'
      ]
    });
  }

  // ===== Step 1：Repair（DeEsser）=====
  let deThr = null, deSliderD = null;
  if (flags.sibilance) {
    deThr = Math.round(a.kwRms - 6);
    const targetAtten = clamp(-6 - (a.bands.sibilance - 0.06) * 100, -20.5, -3);
    deSliderD = deEssSliderFromAttenuation(targetAtten);
    fx.push({
      id:'deesser', pathLabel:'Step 1 · Repair（修復與還原）',
      name:'DeEsser',
      why:`5–8kHz 齒音頻段能量 ${(a.bands.sibilance*100).toFixed(1)}%，STFT 峰值 ${a.bands.pkSibilance}Hz，P_Sib(STFT峰值近似) ${(a.pSib||0).toFixed(1)} dBFS`,
      params:[
        ['Mode',             'Broadband（多頻段）', '整體頻段偵測，適合一般對白'],
        ['Threshold',        `${deThr} dB`, '觸發衰減的電平門檻'],
        ['CenterFrequency',  `${a.bands.pkSibilance} Hz`,   'STFT 偵測到的齒音峰值頻率（進階模式）'],
        ['Bandwidth',        '2000 Hz',   '影響範圍寬度'],
        ['Output Sibilance Only','False', '僅供試聽，正式套用需關閉'],
        ['── 簡易模式（Essential Sound 面板）',''  ,''],
        ['「消除齒音」滑桿 D', `${deSliderD}`, `中心頻率鎖定 6000Hz，對映最大衰減約 ${(deSliderD<=4?(-6.5/4*deSliderD):(deSliderD<=6?(-6.5-4.5/2*(deSliderD-4)):(-11-5/2*(deSliderD-6)))).toFixed(1)} dB`]
      ],
      steps:[
        '效果面板搜尋 <b>DeEsser</b>，拖曳至音軌（DeNoise 之後）',
        '進階模式：依上表設定 Mode / Threshold / CenterFrequency',
        `或使用 Essential Sound 面板簡易模式：<b>「消除齒音」滑桿設為 ${deSliderD}</b>`,
        '暫時勾選 <b>Output Sibilance Only</b> 確認鎖定的是齒音，確認後取消'
      ]
    });
  }

  // ===== Step 2：Dynamics 動態壓縮 =====
  let thr1 = null, sliderS = null;
  if (flags.needsComp) {
    thr1 = Math.round((a.kwRms + cgVal) - 3);
    const thr2 = Math.round(a.kwRms - 3);
    sliderS = dynamicsSliderFromThreshold(thr1);
    const sliderRatio = dynamicsRatioFromSlider(sliderS);
    const ratio = peakToLoudness(a) > 26 ? '4:1' : '3:1';
    const mkP1 = Math.abs(residual) > 0.1 ? residual : 0;
    const mkP2 = clamp(Math.round(delta * 0.65), -24, 24);
    const dp = [];
    const allowAutoGate = monoDerivedReliable(a) && a.noiseFloor > -40;
    if (allowAutoGate) {
      dp.push(['AutoGate · Threshold', `${Math.round(a.noiseFloor+6)} dB`, '低於此電平視為靜音段並衰減']);
      dp.push(['AutoGate · Attack',    '5 ms',   '訊號出現即開啟']);
      dp.push(['AutoGate · Release',   '100 ms', '避免語句尾音被切斷']);
      dp.push(['AutoGate · Hold',      '50 ms',  '最小保持時間']);
    }
    dp.push(['Compressor · Threshold（方案一）', `${thr1} dB`, `訊號已被 Clip Gain ${cgVal>=0?'+':''}${cgVal} dB 拉高，Threshold 同步平移`]);
    dp.push(['Compressor · Threshold（方案二）', `${thr2} dB`, '基於原始 Integrated Loudness 計算的壓縮入口']);
    dp.push(['Compressor · Ratio',  ratio,  'Peak-to-Loudness difference 越大比例越高']);
    dp.push(['Compressor · Attack', '10 ms','保留起始子音清晰度']);
    dp.push(['Compressor · Release','150 ms','避免抽吸感（Pumping）']);
    dp.push(['Compressor · MakeUp（方案一）', `${mkP1>=0?'+':''}${mkP1} dB`, mkP1!==0 ? `Clip Gain 已達削波上限，此處補足殘餘 ${mkP1>=0?'+':''}${mkP1} dB` : 'Clip Gain 前置時設 0，不雙重補償']);
    dp.push(['Compressor · MakeUp（方案二）', `${mkP2>=0?'+':''}${mkP2} dB`, `不採用 Clip Gain 時補 Delta 的 65%（${inRange?'合格勿補':'偏離目標'}）`]);
    dp.push(['── 簡易模式（Essential Sound 面板）','','']);
    dp.push(['「動態」滑桿 S', `${sliderS}`, `對映 Threshold(方案一) ${thr1}dB、Ratio ${sliderRatio}:1（T(S)=-10-2S, R(S)=1+0.4S）`]);
    fx.push({
      id:'dynamics', pathLabel:'Step 2 · Dynamics（動態壓縮）',
      name:'Dynamics',
      why:`Peak-to-Loudness difference（PLR-like）${peakToLoudness(a).toFixed(1)} dB，${monoDerivedReliable(a) ? `RMS Range ${a.lra.toFixed(1)} dB` : 'RMS Range 因負相關而停用'}，Delta ${delta>=0?'+':''}${delta.toFixed(1)} dB`,
      params: dp,
      steps:[
        '效果面板搜尋 <b>Dynamics</b>，拖曳至音軌（Repair 之後）',
        allowAutoGate ? '勾選啟用 <b>AutoGate</b> 模組，依上表設定' : null,
        '進階模式：勾選啟用 <b>Compressor</b> 模組，依方案設定 MakeUp',
        `或使用 Essential Sound 面板簡易模式：<b>「動態」滑桿設為 ${sliderS}</b>`
      ].filter(Boolean)
    });
  }

  // ===== Step 3：EQ（頻段修飾 + 空氣感）=====
  if (flags.rumble || flags.muddy || flags.dull || flags.airShelf) {
    // 結構化 Band 定義：統一欄位（Type / Frequency / Gain / Q / Slope），依觸發順序自動編號
    const bandDefs = [];
    if (flags.rumble) {
      const hpF = Math.min(100, a.bands.pkRumble + 20);
      bandDefs.push({
        type: 'High-Pass Filter', freq: hpF, gain: null, q: null,
        slope: '−24 dB/Octave',
        reason: `STFT 偵測峰值 ${a.bands.pkRumble}Hz + 20Hz 安全餘量，濾除環境低頻噪音，不影響人聲基頻（85Hz 以上）`
      });
    }
    if (flags.muddy) {
      bandDefs.push({
        type: 'Bell（Cut）', freq: a.bands.pkMuddy, gain: -3, q: 1.4, slope: null,
        reason: `STFT 偵測到中低頻堆積峰值，收斂濁厚感；以耳聽確認後可微調 ±1 dB`
      });
    }
    if (flags.dull) {
      bandDefs.push({
        type: 'Bell（Boost）', freq: a.bands.pkPresence, gain: 3.5, q: 1.0, slope: null,
        reason: `STFT 偵測到臨場能量中心，提升清晰度；以耳聽確認後可微調`
      });
    }
    if (flags.airShelf) {
      bandDefs.push({
        type: 'High Shelf', freq: 12000, gain: getAirGainMax(), q: null,
        slope: 'Shelf 預設斜率',
        reason: `噪底${a.noiseFloor.toFixed(1)}dBFS/SNR${a.snr.toFixed(1)}dB/SFM${(a.sfm8k||0).toFixed(2)}/P_Sib${(a.pSib||0).toFixed(1)}dBFS 三重防禦皆通過` + (OUT_FMT==='lossy' ? '，已依有損壓縮規則從 +1.5dB 收斂至 +1.0dB' : '，可保守提升明亮度')
      });
    }

    const eb = [];
    if (bandDefs.length > 0) {
      eb.push(['── 總覽', `共 ${bandDefs.length} 個 Band`, `依序對映 Audition/PR Parametric EQ 的 Band 1 ~ Band ${bandDefs.length}，同軌其餘 Band 保持 Off`]);
    }
    bandDefs.forEach((b, i) => {
      const n = i + 1;
      eb.push([`Band ${n} · Filter Type`, b.type, b.reason]);
      eb.push([`Band ${n} · Frequency`, `${b.freq} Hz`, '']);
      if (b.gain !== null) eb.push([`Band ${n} · Gain`, `${b.gain>=0?'+':''}${b.gain.toFixed(1)} dB`, '']);
      if (b.q !== null) eb.push([`Band ${n} · Q`, `${b.q}`, 'Q 值越低頻段越寬，越高越窄']);
      if (b.slope) eb.push([`Band ${n} · Slope`, b.slope, '']);
      eb.push([`Band ${n} · Toggle`, 'On', `啟用此 Band（面板第 ${n} 格）`]);
    });
    if (flags.airBlock && !flags.airShelf) {
      eb.push(['Air Shelf（12kHz）', '已阻斷 · 不建立 Band', flags.airBlock]);
    }

    fx.push({
      id:'eq', pathLabel:'Step 3 · EQ（等化器 / 空氣感）',
      name:'Parametric Equalizer',
      why:`STFT 1/3 Octave 定位：HP@${a.bands.pkRumble}Hz / 濁厚@${a.bands.pkMuddy}Hz / 臨場@${a.bands.pkPresence}Hz` + (flags.airShelf ? ' / 空氣感 12kHz 已通過防禦閘門' : flags.airBlock ? ` / ${flags.airBlock}` : ''),
      params:[['Main Gain', '0 dB', '維持輸出電平，由 Compressor/Limiter 處理音量'], ...eb],
      steps:[
        '效果面板搜尋 <b>Parametric Equalizer</b>，拖曳至音軌（Dynamics 之後）',
        `依上表「總覽」列的 Band 數量，依序點開面板 Band 1 ~ Band ${bandDefs.length || 0}，逐格設定 Filter Type / Frequency / Gain / Q`,
        '調整後以 <b>Bypass 切換 A/B</b> 比對，確認頻段變化自然不突兀'
      ]
    });
  }

  // ===== Step 4：Hard Limiter（永遠附加）=====
  const lbP1 = 0;
  const lbP2 = clamp(Math.round(delta * 0.35), -30, 30);
  fx.push({
    id:'limiter', pathLabel:'Step 4 · Hard Limiter（硬壓限 / 估算保守起點）',
    name:'Hard Limiter',
    why:`以 Estimated True Peak 設定的保守起點 ${effTp} dBTP（不保證限制所有 inter-sample peak，${PLATFORM.label}${OUT_FMT==='lossy'?' + 有損壓縮餘裕':''}）`,
    params:[
        ['Peak Mode',               'True Peak',             '嘗試偵測 Inter-sample 峰值；匯出後仍需 meter 複核'],
      ['Input Boost（方案一）',    '0 dB',                  'Clip Gain 已完成增益，Limiter 僅作保守防線'],
      ['Input Boost（方案二）',    `${lbP2>=0?'+':''}${lbP2} dB`, `承接 Compressor 剩餘的 35% 增益 / ${inRange?'合格勿補':'補足差距'}`],
      ['Maximum Amplitude',       `${effTp} dBTP`,      'Estimated True Peak 的保守起點；匯出後以 meter 複核'],
      ['Look-Ahead Time',         '5 ms',                  '預讀時間，攔截快速瞬態'],
      ['Release Time',            '50 ms',                 '避免明顯抽吸感'],
      ['Link Channels',           a.ch>1?'True':'False',   a.ch>1?'左右聲道連動，維持立體聲像':'單聲道無需連動']
    ],
    steps:[
      '效果面板搜尋 <b>Hard Limiter</b>，拖曳至效果鏈<b>最末端</b>',
      '<b>Peak Mode</b> 選 <b>True Peak</b>，依選用方案設定 Input Boost',
      `<b>Maximum Amplitude</b> 設為 <b>${effTp} dBTP</b> 作為起點（非硬性保證）`,
      `匯出後以電平表複核人聲是否接近目標響度 <b>${tgt} LUFS</b>（${PLATFORM.label}）與峰值`
    ]
  });
  return fx;
}

// ===== PR/AU 效果器建議：BGM =====
function buildBgmFx(a) {
  const fx = [];
  const fl = bgmFlags(a);
  if (fl.hp) {
    const hpF = Math.max(40, a.bands.pkRumble);
    fx.push({
      id:'hp', pathLabel:null, name:'Parametric Equalizer（HP 低頻收斂）',
      why:`20–80Hz 能量 ${(a.bands.rumble*100).toFixed(1)}%，收斂低頻避免混音時相衝`,
      params:[
        ['HP · Frequency', `${hpF} Hz`, '保留低音樂器基音，收斂次低頻'],
        ['HP · Slope',    '−12 dB/Octave','平緩斜率保留貝斯/大鼓力度'],
        ['HP · Band Toggle','On','啟用 High-Pass']
      ],
      steps:[
        '效果面板搜尋 <b>Parametric Equalizer</b>，拖曳至 BGM 音軌',
        `啟用 HP Band，設 <b>Frequency ${hpF}Hz / Slope −12 dB/Oct</b>`
      ]
    });
  }
  if (fl.maskEq) {
    const bandDefs = [];
    if (fl.maskLowMid) {
      const cutLM = a.bands.lowMid > 0.45 ? -6 : -3;
      bandDefs.push({
        type: 'Bell（Cut）', freq: '300–400', gain: cutLM, q: '0.7–1.2', slope: null,
        reason: `BGM-only heuristic：200–400Hz 能量 ${(a.bands.lowMid*100).toFixed(1)}% > 35% 門檻，可能造成低中頻泥濘`
      });
    }
    if (fl.maskMid) {
      const cutMid = a.bands.mid > 0.4 ? -18 : a.bands.mid > 0.3 ? -9 : -3;
      bandDefs.push({
        type: 'Bell（Cut）', freq: '1250–2500', gain: cutMid, q: '1.2', slope: null,
        reason: `BGM-only heuristic：400–2000Hz 能量 ${(a.bands.mid*100).toFixed(1)}% > 25% 門檻，可能遮蔽對白可懂度`
      });
    }
    if (!fl.maskLowMid && !fl.maskMid && a.bands.vocalOverlap > BGM_MASK_TH) {
      const cut = a.bands.vocalOverlap > 0.45 ? -6 : -3.5;
      bandDefs.push({
        type: 'Bell（Cut）', freq: '1500', gain: cut, q: '1.2', slope: null,
        reason: `BGM-only heuristic：250–4000Hz 能量 ${(a.bands.vocalOverlap*100).toFixed(1)}% 偏高，可能遮蔽對白`
      });
    }
    const eb = [];
    if (bandDefs.length > 0) {
      eb.push(['── 總覽', `共 ${bandDefs.length} 個 Band`, `依序對映 Parametric EQ 的 Band 1 ~ Band ${bandDefs.length}，同軌其餘 Band 保持 Off`]);
    }
    bandDefs.forEach((b, i) => {
      const n = i + 1;
      eb.push([`Band ${n} · Filter Type`, b.type, b.reason]);
      eb.push([`Band ${n} · Frequency`, `${b.freq} Hz`, '']);
      eb.push([`Band ${n} · Gain`, `${b.gain>=0?'+':''}${b.gain} dB`, '']);
      eb.push([`Band ${n} · Q`, `${b.q}`, 'Q 值越低頻段越寬，越高越窄']);
      eb.push([`Band ${n} · Toggle`, 'On', `啟用此 Band（面板第 ${n} 格）`]);
    });
    eb.push(['建議','僅對白段落套用','可用 Clip-based EQ 或關鍵影格自動化 Band Gain']);
    fx.push({
      id:'maskeq', pathLabel:null, name:'Parametric Equalizer（BGM 語音頻帶避讓 · heuristic）', confidence:'低',
      why:`僅分析 BGM：200–400Hz ${(a.bands.lowMid*100).toFixed(1)}% / 400–2000Hz ${(a.bands.mid*100).toFixed(1)}% / 250–4000Hz ${(a.bands.vocalOverlap*100).toFixed(1)}%；未跨軌比較`,
      params: eb,
      steps:[
        '效果面板搜尋 <b>Parametric Equalizer</b>，拖曳至 BGM 音軌',
        `依上表「總覽」列的 Band 數量，依序點開面板 Band 1 ~ Band ${bandDefs.length}，逐格設定 Filter Type / Frequency / Gain / Q`,
        '若僅部分段落有對白，改用 <b>Clip 層級 EQ</b> 避免全曲都被挖空'
      ]
    });
  }
  if (fl.stereo) {
    fx.push({
      id:'stereoexp', pathLabel:null, name:'Stereo Expander',
      why:`聲像寬度指標 ${a.stereo.width.toFixed(2)}，加寬讓出中央聲像給人聲`,
      params:[
        ['Width','130%','適度加寬，避免相位問題'],
        ['Bass Mono Below','150 Hz','低頻維持單聲道，防止加寬後低頻抵消'],
        ['Center Image','Preserved','確保中央聲像仍可辨識']
      ],
      steps:[
        '效果面板搜尋 <b>Stereo Expander</b>，拖曳至 BGM 音軌',
        '設 Width 130%，啟用 Bass Mono Below 150Hz',
        '以耳機及喇叭分別試聽，確認單聲道兼容性（Mono Compatibility）'
      ]
    });
  }
  if (fl.dynamics) {
    const thr = Math.round(a.actRms - 4);
    fx.push({
      id:'bgmdyn', pathLabel:null, name:'Dynamics（電平穩定）',
      why:`BGM 響度變化 ${a.lra.toFixed(1)} dB，先穩定自身動態再進行 Ducking`,
      params:[
        ['Compressor · Threshold',`${thr} dB`,'壓縮明顯高於平均值的段落'],
        ['Compressor · Ratio',    '2.5:1',    '溫和壓縮，保留音樂張力'],
        ['Compressor · Attack',   '20 ms',    '保留樂器起音的衝擊感'],
        ['Compressor · Release',  '200 ms',   '配合音樂節奏，避免抽吸感'],
        ['Compressor · MakeUp',   '0 dB',     '電平由混音階段的 Duck Amount 統一調整']
      ],
      steps:[
        '效果面板搜尋 <b>Dynamics</b>，拖曳至 BGM 音軌',
        '啟用 Compressor 模組，依上表設定，先讓 BGM 自身電平穩定'
      ]
    });
  }
  if (fx.length === 0) {
    const phaseLimited = !monoDerivedReliable(a);
    fx.push({
      id:'pass', pathLabel:null, name:phaseLimited ? '（先處理相位問題）' : '（無須額外處理）',
      why:phaseLimited ? '左右聲道負相關，已停用 mono-derived BGM 處理建議' : 'BGM 頻譜與動態目前未見明顯異常',
      params:[['狀態',phaseLimited ? '低信心 · 暫停建議' : 'Pass',phaseLimited ? '先修正相位並重新分析，再評估 EQ、Dynamics 或 Stereo Expander' : '這份瀏覽器端估算目前未見明顯風險，可直接銜接混音設定']],
      steps:[phaseLimited ? '先檢查 Phase Invert、聲道路由與 mono compatibility，再重新分析。' : '可直接進入下方「人聲 × BGM 混音建議」設定 Ducking 電平即可']
    });
  }
  return fx;
}

// ===== 混音效果器建議（Ducking 內容類型矩陣，數據包 3）=====
function buildMixFx(va, ba) {
  const dm = DUCK_MATRIX[DUCK_TYPE] || DUCK_MATRIX.vlog;
  const attMid = Math.round((dm.attMin + dm.attMax) / 2);
  const atkMid = Math.round((dm.atkMin + dm.atkMax) / 2);
  const relMid = Math.round((dm.relMin + dm.relMax) / 2);
  const targetBgm = va.kwRms;
  const bgmGain   = targetBgm - ba.kwRms;
  const duckedBgm = targetBgm + attMid;
  return [{
    id:'duck', pathLabel:null, name:`Essential Sound · Duck Audio（Premiere Pro / ${dm.label}）`,
    why:`無對白 BGM 對齊人聲 Estimated Loudness ${targetBgm.toFixed(1)} LUFS；對白段落一次 Duck ${attMid} dB 至 ${duckedBgm.toFixed(1)} LUFS（內容類型：${dm.label}）`,
    params:[
      ['── 步驟一','基礎底床電平（Clip/Track Gain）',''],
      ['BGM Gain 調整量', `${bgmGain>=0?'+':''}${bgmGain.toFixed(1)} dB`, `BGM Estimated Loudness ${ba.kwRms.toFixed(1)} LUFS → 無對白目標 ${targetBgm.toFixed(1)} LUFS`],
      ['說明','無對白段落的 BGM 基準電平','先對齊人聲 Estimated Loudness；實際 Gain 一律以 dB 表示'],
      ['── 步驟二','自動避讓量（Essential Sound · Duck Amount）',''],
      ['Tag Clip As',  'Music',     'BGM Clip 先在 Essential Sound 面板標記為 Music'],
      ['Duck Against', 'Dialogue',  '以人聲對白軌作為觸發來源'],
      ['Duck Amount',  `${dm.attMin} ~ ${dm.attMax} dB（建議 ${attMid} dB）`, `${dm.label}參數矩陣：對白段落 BGM 約 ${duckedBgm.toFixed(1)} LUFS；差值為 ${attMid} dB，僅套用一次`],
      ['Attack',       `${dm.atkMin} ~ ${dm.atkMax} ms（建議 ${atkMid} ms）`, '對白出現到 BGM 開始衰減的反應時間'],
      ['Release',      `${dm.relMin} ~ ${dm.relMax} ms（建議 ${relMid} ms）`, 'BGM 恢復到原音量的時間，避免跳動感'],
      ['Sensitivity',  '50',        '對白偵測靈敏度，依實際素材微調 30–70'],
      ['Fade',         '500 ms',    '降低/恢復音量的淡入淡出，避免跳動感']
    ],
    steps:[
      `<b>步驟一：</b>選取 BGM Track Gain 或 Clip Gain，調整 <b>${bgmGain>=0?'+':''}${bgmGain.toFixed(1)} dB</b>，使無對白段落對齊 <b>${targetBgm.toFixed(1)} LUFS</b>`,
      '選取 BGM Clip → <b>Essential Sound</b> 面板 → 標記為 <b>Music</b>',
      `<b>步驟二：</b>勾選 <b>Duck Audio</b> → <b>Duck Against: Dialogue</b> → <b>Amount: ${attMid} dB / Attack: ${atkMid}ms / Release: ${relMid}ms</b>，對白段落約至 <b>${duckedBgm.toFixed(1)} LUFS</b>（只套用這一次衰減）`,
      '播放全片確認對白出現時 BGM 平滑降低，結束後自然回升（整體不應有明顯跳動感）'
    ]
  }];
}

// ===== 報告資料結構：UI 與複製文字共用 =====
function stripHtml(s) {
  return String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}
function valOf(f, keys, fallback = 'N/A') {
  const list = Array.isArray(keys) ? keys : [keys];
  const hit = (f.params || []).find(p => {
    const name = Array.isArray(p) ? p[0] : p.name;
    return list.some(k => String(name || '').includes(k));
  });
  return hit ? (Array.isArray(hit) ? hit[1] : hit.value) : fallback;
}
function noteOf(f, keys, fallback = '') {
  const list = Array.isArray(keys) ? keys : [keys];
  const hit = (f.params || []).find(p => {
    const name = Array.isArray(p) ? p[0] : p.name;
    return list.some(k => String(name || '').includes(k));
  });
  return hit ? (Array.isArray(hit) ? hit[2] : hit.note) : fallback;
}
function param(name, value, note, kind = 'Suggested Setting') {
  return { name, value, note: note || '', kind };
}
function disabledEffect(id, name, purpose) {
  return {
    id, name, enabled:false, status:'不需要', mode:'Keep Default', confidence:'中',
    purpose, why: purpose, params:[param('Effect Enabled', 'Off', '目前分析未觸發此效果器，保持關閉即可', 'Suggested Setting')],
    steps:['目前不需要套用此效果器，保持預設即可。']
  };
}
function normalizeFx(trackId, f, a) {
  const out = {
    ...f,
    effectName: f.name,
    enabled: f.enabled !== false && f.id !== 'pass',
    status: f.status || (f.id === 'pass' ? '不需要' : '建議'),
    mode: f.mode || 'Premiere Pro / Audition',
    confidence: f.confidence || (f.id === 'clipgain' || f.id === 'limiter' ? '中高' : '中'),
    purpose: stripHtml(f.why || ''),
    params: []
  };
  const chLinked = a && a.ch > 1 ? 'True' : 'False';
  const raw = (f.params || []).map(p => Array.isArray(p) ? param(p[0], p[1], p[2]) : p);

  if (f.id === 'clipgain') {
    out.params = [
      param('Set Gain To', valOf(f, 'Set Gain To', 'Keep'), noteOf(f, 'Set Gain To')),
      param('Normalize All Peaks To', valOf(f, 'Normalize All Peaks To', '不使用'), noteOf(f, 'Normalize All Peaks To')),
      param('Safety Cap', f.note ? '依 Estimated True Peak 設定保守上限' : '未觸發', '近似估算，匯出後以 meter 複核'),
      param('Residual Gain Handling', f.note && f.note.includes('Compressor MakeUp') ? '轉由 Compressor MakeUp' : 'N/A', 'Clip Gain 被安全上限限制時才需要')
    ];
  } else if (f.id === 'denoise') {
    out.params = [
      param('Processing Focus', valOf(f, 'Processing Focus', 'All Frequencies'), noteOf(f, 'Processing Focus')),
      param('Amount', valOf(f, 'Amount', '0%'), noteOf(f, 'Amount')),
      param('Output Noise Only', valOf(f, 'Output Noise Only', 'False'), noteOf(f, 'Output Noise Only')),
      param('Gain', valOf(f, 'Gain', '0 dB'), noteOf(f, 'Gain'))
    ];
  } else if (f.id === 'deesser') {
    out.params = [
      param('Mode', valOf(f, 'Mode', 'Broadband'), noteOf(f, 'Mode')),
      param('Threshold', valOf(f, 'Threshold', 'N/A'), noteOf(f, 'Threshold')),
      param('Center Frequency', valOf(f, 'CenterFrequency', '6000 Hz'), noteOf(f, 'CenterFrequency')),
      param('Bandwidth', valOf(f, 'Bandwidth', '2000 Hz'), noteOf(f, 'Bandwidth')),
      param('Output Sibilance Only', valOf(f, 'Output Sibilance Only', 'False'), noteOf(f, 'Output Sibilance Only')),
      param('Essential Sound DeEss Slider', valOf(f, '消除齒音', 'N/A'), noteOf(f, '消除齒音'))
    ];
  } else if (f.id === 'dynamics' || f.id === 'bgmdyn') {
    out.params = [
      param('AutoGate Enabled', !out.enabled || valOf(f, 'AutoGate · Threshold', 'Off') === 'Off' ? 'Off' : 'On', '背景噪音很高時才啟用'),
      param('AutoGate Threshold', valOf(f, 'AutoGate · Threshold', 'N/A'), noteOf(f, 'AutoGate · Threshold')),
      param('AutoGate Attack', valOf(f, 'AutoGate · Attack', 'N/A'), noteOf(f, 'AutoGate · Attack')),
      param('AutoGate Release', valOf(f, 'AutoGate · Release', 'N/A'), noteOf(f, 'AutoGate · Release')),
      param('AutoGate Hold', valOf(f, 'AutoGate · Hold', 'N/A'), noteOf(f, 'AutoGate · Hold')),
      param('Compressor Enabled', out.enabled ? 'On' : 'Off', '此效果器被建議時才啟用 Compressor'),
      param('Compressor Threshold', valOf(f, ['Compressor · Threshold（方案一）','Compressor · Threshold'], 'N/A'), noteOf(f, ['Compressor · Threshold（方案一）','Compressor · Threshold'])),
      param('Ratio', valOf(f, 'Compressor · Ratio', 'N/A'), noteOf(f, 'Compressor · Ratio')),
      param('Attack', valOf(f, 'Compressor · Attack', 'N/A'), noteOf(f, 'Compressor · Attack')),
      param('Release', valOf(f, 'Compressor · Release', 'N/A'), noteOf(f, 'Compressor · Release')),
      param('MakeUp Gain', valOf(f, 'Compressor · MakeUp（方案一）', valOf(f, 'Compressor · MakeUp', '0 dB')), noteOf(f, ['Compressor · MakeUp（方案一）','Compressor · MakeUp'])),
      param('Essential Sound Dynamics Slider', valOf(f, '動態', 'N/A'), noteOf(f, '動態'))
    ];
  } else if (f.id === 'eq' || f.id === 'hp' || f.id === 'maskeq') {
    out.params = raw.length ? raw : [param('Main Gain', '0 dB', '保持輸出電平')];
    if (!out.params.some(p => p.name.includes('Main Gain'))) out.params.unshift(param('Main Gain', '0 dB', '維持輸出電平'));
    out.params.push(
      param('Band Enabled', out.enabled ? '依上方 Band Toggle' : 'Off', '有列出的 Band 才開啟，其餘保持 Off'),
      param('Filter Type', out.enabled ? '依上方各 Band' : 'N/A', 'High-Pass / Bell / Shelf 依建議設定'),
      param('Frequency', out.enabled ? '依上方各 Band' : 'N/A', '逐 Band 輸入'),
      param('Gain', out.enabled ? '依上方各 Band' : 'N/A', 'High-Pass 無 Gain 時填 N/A'),
      param('Q', out.enabled ? '依上方各 Band' : 'N/A', '沒有 Q 欄位時保持預設'),
      param('Slope', out.enabled ? '依上方各 Band' : 'N/A', '非濾波器斜率欄位時填 N/A')
    );
  } else if (f.id === 'limiter') {
    out.params = [
      param('Peak Mode', valOf(f, 'Peak Mode', 'True Peak'), noteOf(f, 'Peak Mode')),
      param('Input Boost', valOf(f, 'Input Boost（方案一）', '0 dB'), noteOf(f, 'Input Boost（方案一）')),
      param('Maximum Amplitude', valOf(f, 'Maximum Amplitude', `${getEffectiveTp()} dBTP`), noteOf(f, 'Maximum Amplitude')),
      param('Look-Ahead Time', valOf(f, 'Look-Ahead Time', '5 ms'), noteOf(f, 'Look-Ahead Time')),
      param('Release Time', valOf(f, 'Release Time', '50 ms'), noteOf(f, 'Release Time')),
      param('Link Channels', valOf(f, 'Link Channels', chLinked), noteOf(f, 'Link Channels'))
    ];
  } else if (f.id === 'duck') {
    out.params = [
      param('Tag Clip As', valOf(f, 'Tag Clip As', 'Music'), noteOf(f, 'Tag Clip As')),
      param('Duck Against', valOf(f, 'Duck Against', 'Dialogue'), noteOf(f, 'Duck Against')),
      param('Duck Amount', valOf(f, 'Duck Amount', 'N/A'), noteOf(f, 'Duck Amount')),
      param('Sensitivity', valOf(f, 'Sensitivity', '50'), noteOf(f, 'Sensitivity')),
      param('Fade', valOf(f, 'Fade', '500 ms'), noteOf(f, 'Fade')),
      param('Attack', valOf(f, 'Attack', 'N/A'), noteOf(f, 'Attack')),
      param('Release', valOf(f, 'Release', 'N/A'), noteOf(f, 'Release')),
      param('BGM Base Gain', valOf(f, 'BGM Gain 調整量', 'N/A'), noteOf(f, 'BGM Gain 調整量'))
    ];
  } else {
    out.params = raw;
  }
  return out;
}
function normalizeFxList(trackId, fx, a) {
  const list = fx.map(f => normalizeFx(trackId, f, a));
  const has = id => list.some(f => f.id === id);
  const off = (id, name, purpose) => normalizeFx(trackId, disabledEffect(id, name, purpose), a);
  const phaseLimited = !monoDerivedReliable(a);
  if (trackId === 'voice') {
    if (!has('denoise')) list.splice(1, 0, off('denoise', 'DeNoise', phaseLimited ? '負相關使 mono-derived noise 指標低信心，已停用' : 'Estimated noise-floor proxy 未達降噪門檻'));
    if (!has('deesser')) list.splice(2, 0, off('deesser', 'DeEsser', phaseLimited ? '負相關使 mono-derived 齒音指標低信心，已停用' : '齒音未達處理門檻'));
    if (!has('dynamics')) list.splice(3, 0, off('dynamics', 'Dynamics', '動態與目標差距目前未觸發明顯風險'));
    if (!has('eq')) list.splice(4, 0, off('eq', 'Parametric Equalizer', phaseLimited ? '負相關使 mono-derived 頻譜指標低信心，已停用' : '頻段未達明顯修正門檻'));
  }
  if (trackId === 'bgm') {
    if (!has('hp')) list.unshift(off('hp', 'Parametric Equalizer（HP 低頻收斂）', phaseLimited ? '負相關使 mono-derived 低頻指標低信心，已停用' : '低頻未達收斂門檻'));
    if (!has('maskeq')) list.push(off('maskeq', 'Parametric Equalizer（BGM 語音頻帶避讓）', phaseLimited ? '負相關使 mono-derived 頻譜指標低信心，已停用' : 'BGM 語音頻帶能量未達 heuristic 門檻'));
    if (!has('stereoexp')) list.push(off('stereoexp', 'Stereo Expander', phaseLimited ? '偵測到負相關，禁止再加寬' : '聲場寬度目前未觸發明顯風險'));
    if (!has('bgmdyn')) list.push(off('bgmdyn', 'Dynamics（電平穩定）', phaseLimited ? '負相關使 mono-derived RMS Range 低信心，已停用' : 'BGM 動態起伏目前未觸發明顯風險'));
  }
  return list;
}
function trackStatus(diags) {
  if (diags.some(d => d.lvl === 'severe')) return '有風險';
  if (diags.some(d => d.lvl === 'mid')) return '可改善';
  return '未見明顯風險';
}
function buildTrackReport(trackId) {
  const s = S[trackId];
  const label = trackId === 'voice' ? '人聲 Voice' : 'BGM 配樂';
  if (!s) return { trackId, label, ready:false, measurements:[], issues:['尚未上傳分析'], effects:[] };
  const a = s.a;
  const diags = trackId === 'voice' ? diagVoice(a) : diagBgm(a);
  const rawFx = trackId === 'voice' ? buildVoiceFx(a) : buildBgmFx(a);
  return {
    trackId, label, ready:true, filename:s.filename, status:trackStatus(diags),
    ...(a.channelCaveat ? { channelCaveat: a.channelCaveat } : {}),
    priority: trackId === 'voice'
      ? 'Clip Gain → DeNoise → DeEsser → Dynamics → EQ → Hard Limiter'
      : 'HP Filter → Masking EQ → Stereo Expander → Dynamics → Ducking',
    measurements:[
      { kind:'Estimated', name:'Integrated Loudness', value:`${a.kwRms.toFixed(1)} LUFS` },
      { kind:'Estimated', name:'Estimated True Peak', value:`${a.tpDb.toFixed(1)} dBTP` },
      { kind:'Estimated', name:'RMS Range', value:`${a.lra.toFixed(1)} dB` },
      { kind:'Reference Target', name:'Target Loudness', value:`${PLATFORM.targetLufs} LUFS` },
      { kind:'Reference Target', name:'Target Peak Ceiling', value:`${getEffectiveTp()} dBTP` }
    ],
    issues: diags.map(d => `[${d.lvl}] ${d.title}`),
    effects: normalizeFxList(trackId, rawFx, a)
  };
}
function buildReportData() {
  const tracks = ['voice','bgm'].map(buildTrackReport);
  const ready = tracks.filter(t => t.ready);
  const allIssues = ready.flatMap(t => t.issues).filter(Boolean);
  const worst = ready.some(t => t.status === '有風險') ? '有風險'
             : ready.some(t => t.status === '可改善') ? '可改善'
             : ready.length ? '未見明顯風險' : '尚未分析';
  const report = {
    meta:{
      title:'PR/AU 新手調音建議報告',
      appVersion:APP_VERSION,
      appUpdatedAt:APP_UPDATED_AT,
      generatedAt:new Date().toLocaleString('zh-TW'),
      platform:PLATFORM.label,
      targetLufs:`${PLATFORM.targetLufs} LUFS`,
      peakCeiling:`${getEffectiveTp()} dBTP`,
      outputFormat:OUT_FMT === 'lossy' ? '有損壓縮 MP3/AAC' : '無損 PCM/WAV'
    },
    summary:{
      status:worst,
      mainIssues:allIssues.slice(0, 3),
      priority:ready.map(t => `${t.label}: ${t.priority}`).join(' / ') || '請先上傳音訊'
    },
    tracks
  };
  if (S.voice && S.bgm) {
    report.mix = { ready:true, effects: normalizeFxList('mix', buildMixFx(S.voice.a, S.bgm.a), S.bgm.a) };
  } else {
    report.mix = { ready:false, note:'人聲與 BGM 都完成分析後才產生 Ducking 建議' };
  }
  return report;
}
function renderTrackSummary(trackId) {
  const r = buildTrackReport(trackId);
  const el = document.getElementById('sum-' + trackId);
  if (!el || !r.ready) return;
  el.innerHTML = `
    <b>${r.status}</b> · ${escapeHtml(r.filename)}<br>
    主要問題：${r.issues.slice(0,3).join('、') || '未發現明顯問題'}<br>
    優先處理順序：${r.priority}
    ${r.channelCaveat ? `<br><span class="note">注意：${r.channelCaveat}</span>` : ''}
    <div class="summary-grid">
      ${r.measurements.map(m => `<div><div class="summary-k">${m.kind}</div><div class="summary-v">${m.name}: ${m.value}</div></div>`).join('')}
    </div>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
}

// ===== 渲染：量測卡片 =====
function kwFlag(v) {
  const tgt = PLATFORM.targetLufs;
  const diff = Math.abs(v - tgt);
  return diff <= 1 ? 'fg' : diff > 8 ? 'fb' : 'fw';
}
function kwNote(v) {
  const tgt = PLATFORM.targetLufs;
  if (Math.abs(v - tgt) <= 1) return `✓ 接近 ${PLATFORM.label} 目標範圍（${tgt} LUFS）`;
  if (v < tgt) return `↓ 低於目標 ${(tgt-v).toFixed(1)} dB`;
  return `↑ 高於目標 ${(v-tgt).toFixed(1)} dB`;
}
function mc(lbl, val, note, flag) {
  return `<div class="mc ${flag||''}"><div class="ml">${lbl}</div><div class="mv">${val}</div>${note?`<div class="mn">${note}</div>`:''}</div>`;
}
function renderMetrics(id, a) {
  const el = document.getElementById(id);
  const effTp = getEffectiveTp();
  const monoSafe = monoDerivedReliable(a);
  const pf = a.smpPkDb >= -0.3 ? 'fb' : a.tpDb > effTp ? 'fw' : 'fg';
  el.innerHTML = [
    mc('取樣率 / 聲道', `${a.sr}Hz / ${a.ch}ch`, `時長 ${a.dur.toFixed(1)}s`),
    mc('Estimated Integrated Loudness', `${a.kwRms.toFixed(1)} LUFS`, kwNote(a.kwRms), kwFlag(a.kwRms)),
    mc('Sample Peak', `${a.smpPkDb.toFixed(1)} dBFS`, `接近滿刻度樣本 ${a.nearPeakCount}`, pf),
    mc('Estimated True Peak（4x 插值）', `${a.tpDb.toFixed(1)} dBTP`, a.tpDb > effTp ? `⚠ 超過 ${effTp} dBTP；匯出後複核` : '估算值，匯出後請 meter 複核', pf),
    mc('Estimated noise-floor proxy', `${a.noiseFloor.toFixed(1)} dBFS`, monoSafe ? `基準 ${NOISE_BASE} dBFS` : '負相關時低信心，不產生 Noise 建議', monoSafe ? '' : 'fw'),
    mc('SNR 訊噪比', `${a.snr.toFixed(1)} dB`, monoSafe ? (a.snr < 20 ? '偏低，建議降噪' : '目前未見明顯風險') : '負相關時低信心，不產生降噪建議', monoSafe ? (a.snr<20?'fw':'fg') : 'fw'),
    mc('Peak-to-Loudness difference（PLR-like）', `${peakToLoudness(a).toFixed(1)} dB`, peakToLoudness(a)>18?'偏大，建議以耳聽確認壓縮':'未觸發壓縮風險', peakToLoudness(a)>18?'fw':'fg'),
    mc('RMS Range（LRA-like）', `${a.lra.toFixed(1)} dB`, monoSafe ? '50ms RMS 95th–10th percentile 差值' : '負相關時低信心，不產生 Dynamics 建議', monoSafe ? '' : 'fw'),
    mc('DC Offset', a.dcOffset.toFixed(4), Math.abs(a.dcOffset)>0.02?'建議校正':'目前未見異常', Math.abs(a.dcOffset)>0.02?'fw':'fg'),
    mc('靜音段比例', `${(a.silentRatio*100).toFixed(1)}%`, monoSafe ? '靜音幀 / 總幀數' : '負相關時低信心', monoSafe ? '' : 'fw'),
    mc('零交叉率（ZCR）', `${Math.round(a.zcr).toLocaleString()}/s`, monoSafe ? (a.zcr>12000?'偏高，留意雜訊':'目前未見異常') : '負相關時低信心', monoSafe ? (a.zcr>12000?'fw':'fg') : 'fw'),
    mc('頻譜平坦度 SFM(8-16k)', (a.sfm8k??0).toFixed(2), monoSafe ? (a.sfm8k<=0.35?'諧波結構，空氣感候選':'偏白噪，阻斷空氣感') : '負相關時低信心，不產生 EQ 建議', monoSafe ? (a.sfm8k<=0.35?'fg':'fw') : 'fw'),
    mc('齒音瞬態峰值 P_Sib', `${(a.pSib??0).toFixed(1)} dBFS`, monoSafe ? (a.pSib<=P_SIB_AIR_THRESHOLD_DBFS?'供調音起點參考':'⚠ 過高，阻斷空氣感') : '負相關時低信心，不產生齒音建議', monoSafe ? (a.pSib<=P_SIB_AIR_THRESHOLD_DBFS?'fg':'fw') : 'fw'),
  ].join('') + (a.stereo ? [
    mc('立體聲相關係數', a.stereo.corr.toFixed(2), a.stereo.corr<0?'⚠ 相位可能抵消':'未觸發相位風險', a.stereo.corr<0?'fb':'fg'),
    mc('聲像寬度指標', a.stereo.width.toFixed(2), a.stereo.corr < 0 ? '高值來自負相關，屬相位風險而非建議加寬' : '0=重疊 1=極寬'),
    ...(a.stereo.corr < 0 ? [mc('Mono-derived 指標信心', '降低', '頻譜、ZCR 與噪音指標來自 mono downmix，反相時可能被抵消', 'fw')] : [])
  ].join('') : '') + (a.channelCaveat ? mc('多聲道量測注意', '等權加總', a.channelCaveat, 'fw') : '');
}

// ===== 渲染：Canvas 波形（降取樣 + 接近滿刻度標橙）=====
function renderWaveform(canvasId, buf) {
  const ch = buf.numberOfChannels, len = buf.length;
  const mono = downmixToMono(Array.from({ length: ch }, (_, c) => buf.getChannelData(c)), len);
  const canvas = document.getElementById(canvasId);
  const dpr = window.devicePixelRatio || 1;
  const w   = canvas.parentElement.clientWidth - 24;
  canvas.width  = w * dpr;
  canvas.height = 64 * dpr;
  canvas.style.width  = w + 'px';
  canvas.style.height = '64px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, 64);
  const spp = Math.ceil(len / w); // samples per pixel
  const mid = 32;
  for (let px = 0; px < w; px++) {
    const s0 = px * spp, s1 = Math.min(s0 + spp, len);
    let minS = 0, maxS = 0, nearPeak = false;
    for (let i = s0; i < s1; i++) {
      const v = mono[i];
      if (v < minS) minS = v;
      if (v > maxS) maxS = v;
      if (Math.abs(v) >= NEAR_FULL_SCALE_AMP) nearPeak = true;
    }
    ctx.fillStyle = nearPeak ? 'rgba(255,178,56,.9)' : 'rgba(94,201,163,.65)';
    const yT = mid - maxS * mid, yB = mid - minS * mid;
    ctx.fillRect(px, yT, 1, Math.max(1, yB - yT));
  }
  ctx.strokeStyle = 'rgba(255,255,255,.07)';
  ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(w, mid); ctx.stroke();
}

// ===== 渲染：1/3 Octave 頻譜（8 個代表性 band）=====
const DBANDS = [
  {label:'極低頻 63Hz',  i:5,  c:'#7aa2ff'},
  {label:'低頻 125Hz',   i:8,  c:'#5ec9a3'},
  {label:'中低頻 315Hz', i:12, c:'#ffb238'},
  {label:'中頻 800Hz',   i:16, c:'#e8eaed'},
  {label:'臨場 2kHz',    i:20, c:'#ff9d5c'},
  {label:'明亮 4kHz',    i:23, c:'#ffd166'},
  {label:'氣息 8kHz',    i:26, c:'#ff6b9d'},
  {label:'嘶聲 12.5kHz', i:28, c:'#ff5c5c'}
];
function renderSpectrum(id, specRatio) {
  const el = document.getElementById(id);
  const maxR = Math.max(...DBANDS.map(b => specRatio[b.i] || 0), 1e-6);
  el.innerHTML = DBANDS.map(b => {
    const raw = specRatio[b.i] || 0;
    const pct = clamp((raw / maxR) * 100, 0, 100);
    return `<div class="sr"><div class="sl">${b.label}</div><div class="st"><div class="sf" style="width:${pct.toFixed(1)}%;background:${b.c};"></div></div><div class="sp">${(raw*100).toFixed(2)}%</div></div>`;
  }).join('');
}

// ===== 渲染：效果鏈流程圖 =====
function renderChain(id, flags, trackId) {
  const color = trackId === 'voice' ? 'var(--voice)' : 'var(--bgm)';
  const nodes = trackId === 'voice'
    ? [{id:'clipgain',lbl:'Clip Gain',on:flags.clipGain},{id:'denoise',lbl:'DeNoise',on:flags.denoise},
       {id:'eq',lbl:'EQ',on:flags.eq},{id:'dynamics',lbl:'Dynamics',on:flags.dynamics},
       {id:'deesser',lbl:'DeEsser',on:flags.deEsser},{id:'limiter',lbl:'Limiter',on:flags.limiter}]
    : [{id:'hp',lbl:'HP Filter',on:flags.hp},{id:'maskeq',lbl:'Masking EQ',on:flags.maskEq},
       {id:'stereoexp',lbl:'Stereo Exp',on:flags.stereo},{id:'bgmdyn',lbl:'Dynamics',on:flags.dynamics},
       {id:'duck',lbl:'→ Ducking',on:flags.ducking}];
  const el = document.getElementById(id);
  el.innerHTML = nodes.map((n, idx) => (
    n.on
      ? `<button type="button" class="chain-node active" data-fx="${n.id}" data-tr="${trackId}">${n.lbl}</button>`
      : `<span class="chain-node" aria-disabled="true">${n.lbl}</span>`
  ) + (idx < nodes.length-1 ? '<span class="chain-arr">→</span>' : '')).join('');
  el.querySelectorAll('button.chain-node.active').forEach(node => {
    node.addEventListener('click', () => {
      const fx = node.dataset.fx, tr = node.dataset.tr;
      if (fx === 'duck') {
        document.getElementById('fl-mix').scrollIntoView({behavior:'smooth',block:'start'});
      } else {
        const t = document.getElementById(`fx-${tr}-${fx}`);
        if (t) t.scrollIntoView({behavior:'smooth',block:'center'});
      }
    });
  });
}

// ===== 渲染：診斷列表 =====
function renderDiags(id, diags) {
  document.getElementById(id).innerHTML = diags.map(d =>
    `<div class="diag"><div class="dhead">
      <span class="tag ${d.lvl}">${d.lvl==='severe'?'嚴重':d.lvl==='mid'?'中等':'輕微'}</span>
      <span>${d.title}</span></div>
      <div class="ddesc">${d.desc}</div></div>`
  ).join('');
}

// ===== 渲染：FX 卡片 =====
function renderFxList(containerId, fx) {
  const trackId = containerId.includes('voice')?'voice':containerId.includes('bgm')?'bgm':'mix';
  document.getElementById(containerId).innerHTML = fx.map(f => {
    const pl = f.pathLabel
      ? `<div class="path-lbl"><span>${f.pathLabel}</span></div>`
      : '';
    const rows = (f.params || []).map(p => {
      const row = Array.isArray(p) ? { name:p[0], value:p[1], note:p[2], kind:'Suggested Setting' } : p;
      return `<tr><td>${row.name}</td><td>${row.value}</td><td class="zh">${row.kind || 'Suggested Setting'} · ${row.note || ''}</td></tr>`;
    }
    ).join('');
    const note = f.note ? `<div class="fxnote">${f.note}</div>` : '';
    const meta = `<div class="fxmeta">
      <span>狀態 <b>${f.status || '建議'}</b></span>
      <span>模式 <b>${f.mode || 'Premiere Pro / Audition'}</b></span>
      <span>信心 <b>${f.confidence || '中'}</b></span>
    </div>`;
    return `${pl}<div class="fxcard ${f.enabled===false?'disabled':''}" id="fx-${trackId}-${f.id}">
      <div class="fxhead"><span class="fxname">${f.name}</span><span class="fxwhy">${f.why}</span></div>
      <div class="fxbody">
        ${meta}
        <table class="p"><tr><th>變項</th><th>建議值</th><th>類型 / 目的</th></tr>${rows}</table>
        ${note}
        <ol class="steps">${(f.steps || []).map(s=>`<li>${s}</li>`).join('')}</ol>
      </div></div>`;
  }).join('');
}

// ===== 渲染：混音區塊 =====
function updateMix() {
  const empty = document.getElementById('mixEmpty');
  const sec   = document.getElementById('mixSec');
  if (!(S.voice && S.bgm)) { empty.style.display='block'; sec.style.display='none'; return; }
  empty.style.display = 'none'; sec.style.display = 'block';
  const va = S.voice.a, ba = S.bgm.a;
  const dm = DUCK_MATRIX[DUCK_TYPE] || DUCK_MATRIX.vlog;
  const attMid = Math.round((dm.attMin + dm.attMax) / 2);
  const tb = va.kwRms;
  const ducked = tb + attMid;
  const baseGain = tb - ba.kwRms;
  const pb = db => clamp(((db+60)/60)*100, 0, 100);
  document.getElementById('mixBars').innerHTML = `
    <div class="mbr"><div class="mbl">人聲 Integrated</div><div class="mbt"><div class="mbf" style="width:${pb(va.kwRms)}%;background:var(--voice);"></div></div><div class="mbv">${va.kwRms.toFixed(1)} LUFS</div></div>
    <div class="mbr"><div class="mbl">BGM 目前 Integrated</div><div class="mbt"><div class="mbf" style="width:${pb(ba.kwRms)}%;background:var(--bgm);"></div></div><div class="mbv">${ba.kwRms.toFixed(1)} LUFS</div></div>
    <div class="mbr"><div class="mbl">BGM 無對白目標</div><div class="mbt"><div class="mbf" style="width:${pb(tb)}%;background:var(--accent);"></div></div><div class="mbv">${tb.toFixed(1)} LUFS</div></div>
    <div class="mbr"><div class="mbl">BGM 對白段落目標</div><div class="mbt"><div class="mbf" style="width:${pb(ducked)}%;background:var(--warn);"></div></div><div class="mbv">${ducked.toFixed(1)} LUFS</div></div>`;
  document.getElementById('mixNote').innerHTML = `<div class="mixnote">
    人聲 Integrated Loudness <b>${va.kwRms.toFixed(1)} LUFS</b>，BGM Integrated Loudness <b>${ba.kwRms.toFixed(1)} LUFS</b>。內容類型：<b>${dm.label}</b><br>
    <b>步驟一</b>：無對白段落 BGM 先對齊 <b>${tb.toFixed(1)} LUFS</b>；由目前 BGM 響度換算，Clip/Track Gain 建議從 <b>${baseGain>=0?'+':''}${baseGain.toFixed(1)} dB</b> 起聽。<br>
    <b>步驟二</b>：透過 Essential Sound → Duck Audio 在對白出現時一次套用 <b>${attMid} dB</b>，BGM 約至 <b>${ducked.toFixed(1)} LUFS</b>；Attack <b>${dm.atkMin}~${dm.atkMax}ms</b>、Release <b>${dm.relMin}~${dm.relMax}ms</b>。
    ${monoDerivedReliable(ba) && (ba.bands.vocalOverlap > BGM_MASK_TH || ba.bands.lowMid > 0.35 || ba.bands.mid > 0.25) ? `<br>⚠ BGM-only heuristic：語音頻帶能量偏高、可能遮蔽；未跨軌比較，信心低，可試用 BGM 的頻譜避讓 EQ。` : ''}
  </div>`;
  renderFxList('fl-mix', normalizeFxList('mix', buildMixFx(va, ba), ba));
}

// ===== 主渲染函式 =====
function render(trackId, a, filename, buf) {
  S[trackId] = { a, filename };
  renderTrackSummary(trackId);
  renderMetrics('mg-' + trackId, a);
  renderWaveform('wf-' + trackId, buf);
  renderSpectrum('sp-' + trackId, a.specRatio);
  const diags = trackId === 'voice' ? diagVoice(a) : diagBgm(a);
  renderDiags('dl-' + trackId, diags);
  const fx = normalizeFxList(trackId, trackId === 'voice' ? buildVoiceFx(a) : buildBgmFx(a), a);
  renderFxList('fl-' + trackId, fx);
  const flags = trackId === 'voice' ? voiceFlags(a) : bgmFlags(a);
  renderChain('chain-' + trackId, flags, trackId);
  document.getElementById('res-' + trackId).classList.add('show');
  document.querySelector(`.tab[data-track="${trackId}"]`).classList.add('done');
  updateMix();
  updateCopyButtonState();
  const status = document.getElementById('st-' + trackId);
  status.textContent = '分析完成：已產生估算結果與建議。';
  status.classList.add('show');
}

// ===== 即時重算（目標區間改變時）=====
function rerenderAll() {
  ['voice','bgm'].forEach(trackId => {
    if (!S[trackId]) return;
    const a = S[trackId].a;
    renderTrackSummary(trackId);
    renderMetrics('mg-' + trackId, a);
    renderDiags('dl-' + trackId, trackId==='voice'?diagVoice(a):diagBgm(a));
    const fx = normalizeFxList(trackId, trackId==='voice'?buildVoiceFx(a):buildBgmFx(a), a);
    renderFxList('fl-' + trackId, fx);
    const flags = trackId==='voice'?voiceFlags(a):bgmFlags(a);
    renderChain('chain-' + trackId, flags, trackId);
  });
  updateMix();
}

// ===== Loading Overlay =====
function showLoad(msg) {
  document.getElementById('ldMsg').textContent = msg;
  const overlay = document.getElementById('loadingOverlay');
  overlay.classList.add('show');
  overlay.setAttribute('aria-busy', 'true');
}
function hideLoad() {
  const overlay = document.getElementById('loadingOverlay');
  overlay.classList.remove('show');
  overlay.setAttribute('aria-busy', 'false');
}

function beginAnalysisRun(trackId) {
  const runId = ++analysisRuns[trackId];
  activeAnalysisCount++;
  showLoad('智慧調音分析中，請勿關閉網頁…');
  return runId;
}

function isCurrentAnalysisRun(trackId, runId) {
  return analysisRuns[trackId] === runId;
}

function finishAnalysisRun() {
  activeAnalysisCount = Math.max(0, activeAnalysisCount - 1);
  if (activeAnalysisCount === 0) hideLoad();
}

function clearTrackState(trackId) {
  S[trackId] = null;
  document.getElementById('res-' + trackId).classList.remove('show');
  document.querySelector(`.tab[data-track="${trackId}"]`).classList.remove('done');
  renderChain('chain-' + trackId, {}, trackId);
  updateMix();
  updateCopyButtonState();
}

// ===== 檔案處理 =====
function initTrack(tid) {
  const drop = document.getElementById('drop-' + tid);
  const fi   = document.getElementById('fi-' + tid);
  const accentColor = tid === 'voice' ? '#5ec9a3' : '#7aa2ff';
  drop.style.setProperty('--accent-track', accentColor);
  ['dragenter','dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('drag'); }));
  ['dragleave','drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('drag'); }));
  const chooseFile = () => { fi.value = ''; fi.click(); };
  drop.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) handleFile(tid, f); });
  drop.addEventListener('click', chooseFile);
  drop.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); chooseFile(); }
  });
  fi.addEventListener('change', e => { if (e.target.files[0]) handleFile(tid, e.target.files[0]); });
}
initTrack('voice');
initTrack('bgm');

document.querySelectorAll('.rl').forEach(btn => {
  btn.addEventListener('click', () => { const input = document.getElementById(btn.dataset.t); input.value = ''; input.click(); });
});

function activateTrack(trackId) {
  document.querySelectorAll('.tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); t.tabIndex = -1; });
  document.querySelectorAll('.panel').forEach(p => { p.classList.remove('active'); p.hidden = true; });
  const tab = document.querySelector(`.tab[data-track="${trackId}"]`);
  tab.classList.add('active'); tab.setAttribute('aria-selected', 'true'); tab.tabIndex = 0;
  const panel = document.getElementById('panel-' + trackId);
  panel.classList.add('active'); panel.hidden = false;
  document.documentElement.style.setProperty('--accent-track', trackId === 'voice' ? '#5ec9a3' : '#7aa2ff');
}

async function inspectAudioFile(file, { timeoutMs = 5000, maxBytes = 128 * 1024 * 1024, maxDuration = 300 } = {}) {
  let url = null;
  try {
    url = URL.createObjectURL(file);
    if (file.size > maxBytes) {
      return { allowed: false, size: file.size, duration: null, reason: `檔案 ${(file.size / 1024 / 1024).toFixed(1)} MiB 超過 128 MiB 上限` };
    }
    const duration = await new Promise((resolve, reject) => {
      const audio = document.createElement('audio');
      const timer = setTimeout(() => reject(new Error('無法在 5 秒內確認音檔時長')), timeoutMs);
      audio.preload = 'metadata';
      audio.onloadedmetadata = () => {
        clearTimeout(timer);
        Number.isFinite(audio.duration) && audio.duration >= 0 ? resolve(audio.duration) : reject(new Error('無法確認音檔時長'));
      };
      audio.onerror = () => { clearTimeout(timer); reject(new Error('無法讀取音檔 metadata')); };
      audio.src = url;
    });
    if (duration > maxDuration) {
      return { allowed: false, size: file.size, duration, reason: `音檔 ${duration.toFixed(1)} 秒超過 300 秒上限` };
    }
    return { allowed: true, size: file.size, duration, reason: '' };
  } catch (err) {
    return { allowed: false, size: file.size, duration: null, reason: err.message || '無法確認音檔時長' };
  } finally {
    if (url) URL.revokeObjectURL(url);
  }
}

async function handleFile(tid, file) {
  const fb  = document.getElementById('fb-' + tid);
  const stEl = document.getElementById('st-' + tid);
  const setSt = msg => { stEl.textContent = msg; stEl.classList.toggle('show', !!msg); };

  clearTrackState(tid);
  setSt('');
  fb.classList.add('show');
  document.getElementById('fn-' + tid).textContent = file.name;
  document.getElementById('fm-' + tid).textContent = `(${(file.size/1024/1024).toFixed(2)} MB)`;

  // 先取得新 run token，metadata 檢查期間也不能讓舊分析重新渲染。
  const runId = beginAnalysisRun(tid);
  try {
    // 雙 rAF：確保 Overlay 渲染完成再開始檢查或解碼。
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    if (!isCurrentAnalysisRun(tid, runId)) return;
    setSt('檢查檔案大小與時長…');
    const inspected = await inspectAudioFile(file);
    if (!isCurrentAnalysisRun(tid, runId)) return;
    if (!inspected.allowed) {
      setSt(`未分析：${inspected.reason}。請在 PR／AU 匯出不超過五分鐘的代表片段。`);
      return;
    }
    document.getElementById('fm-' + tid).textContent = `(${(inspected.size/1024/1024).toFixed(2)} MB / ${inspected.duration.toFixed(1)} 秒)`;
    aCtx = aCtx || new (window.AudioContext || window.webkitAudioContext)();
    setSt('解碼音訊中…');
    const ab = await file.arrayBuffer();
    if (!isCurrentAnalysisRun(tid, runId)) return;
    const buf = await aCtx.decodeAudioData(ab);
    if (!isCurrentAnalysisRun(tid, runId)) return;
    setSt('');
    const a = analyzeAudio(buf);
    render(tid, a, file.name, buf);
  } catch (err) {
    if (isCurrentAnalysisRun(tid, runId)) {
      setSt('解碼失敗：' + err.message + '（請確認瀏覽器支援此格式）');
    }
  } finally {
    finishAnalysisRun();
  }
}

// ===== Tabs =====
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    activateTrack(tab.dataset.track);
  });
  tab.addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const tabs = [...document.querySelectorAll('.tab')];
    const current = tabs.indexOf(tab);
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (current + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    activateTrack(tabs[next].dataset.track);
    tabs[next].focus();
  });
});

// ===== 目標平台 / 輸出格式 / 內容類型 UI =====
function updateRangeUI() {
  const effTp = getEffectiveTp();
  document.getElementById('rDisp').textContent = `${PLATFORM.targetLufs} LUFS（${PLATFORM.label}）`;
  document.getElementById('mDisp').textContent = `${effTp} dBTP${OUT_FMT==='lossy'?' (有損壓縮已收斂)':''}`;
  rerenderAll();
}
document.getElementById('platformSel').addEventListener('change', e => {
  const key = e.target.value;
  document.getElementById('customRow').classList.toggle('show', key === 'custom');
  if (key === 'custom') {
    if (!applyCustomPlatform()) return;
  } else {
    PLATFORM = PLATFORM_PRESETS[key];
    clearCustomValidation();
    updateCopyButtonState();
  }
  updateRangeUI();
});
document.getElementById('outFmtSel').addEventListener('change', e => {
  OUT_FMT = e.target.value;
  updateRangeUI();
});
document.getElementById('duckTypeSel').addEventListener('change', e => {
  DUCK_TYPE = e.target.value;
  rerenderAll();
});
function applyCustomPlatform() {
  const lufsInput = document.getElementById('cLufs');
  const tpInput = document.getElementById('cTp');
  const error = document.getElementById('customError');
  const lufs = lufsInput.valueAsNumber;
  const tp = tpInput.valueAsNumber;
  const lufsValid = Number.isFinite(lufs) && lufs >= -60 && lufs <= 0;
  const tpValid = Number.isFinite(tp) && tp >= -10 && tp <= 0;
  const valid = lufsValid && tpValid;
  lufsInput.setAttribute('aria-invalid', String(!lufsValid));
  tpInput.setAttribute('aria-invalid', String(!tpValid));
  error.hidden = valid;
  error.textContent = valid ? '' : '請輸入目標 LUFS（-60 至 0）與 True Peak（-10 至 0）的有效數值。';
  updateCopyButtonState();
  if (!valid) return false;
  PLATFORM = { label:'自訂', targetLufs:lufs, targetTp:tp, social:false };
  return true;
}
function clearCustomValidation() {
  document.getElementById('cLufs').setAttribute('aria-invalid', 'false');
  document.getElementById('cTp').setAttribute('aria-invalid', 'false');
  const error = document.getElementById('customError');
  error.hidden = true;
  error.textContent = '';
}
['cLufs', 'cTp'].forEach(id => document.getElementById(id).addEventListener('input', () => {
  if (document.getElementById('platformSel').value !== 'custom' || !applyCustomPlatform()) return;
  updateRangeUI();
}));

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
function makeTestAnalysis(overrides = {}) {
  return {
    sr:48000, ch:2, dur:30, smpPkDb:-6, tpDb:-5.5, kwRms:-19, noiseFloor:-62,
    actRms:-18, overallRms:-25, snr:44, crest:13, lra:8, nearPeakCount:0, dcOffset:0.001,
    silentRatio:0.08, zcr:4200, stereo:{corr:0.6,width:0.4},
    bands:{rumble:0.03,bass:0.16,lowMid:0.12,mid:0.18,presence:0.06,sibilance:0.03,hiss:0.02,vocalOverlap:0.22,pkRumble:63,pkMuddy:315,pkPresence:2500,pkSibilance:6300},
    specRatio:new Array(T3.length).fill(1/T3.length), pSib:-22, sfm8k:0.25,
    ...overrides
  };
}
function runReportSelfTest() {
  const backup = { voice:S.voice, bgm:S.bgm };
  const scenarios = [
    { name:'voice low gain', voice:makeTestAnalysis({ kwRms:-22, tpDb:-8 }) },
    { name:'voice noisy sibilant dynamic', voice:makeTestAnalysis({ noiseFloor:-38, snr:18, crest:28, lra:25, bands:{...makeTestAnalysis().bands, sibilance:0.14, hiss:0.12} }) },
    { name:'bgm masking', bgm:makeTestAnalysis({ kwRms:-15, bands:{...makeTestAnalysis().bands, vocalOverlap:0.48, lowMid:0.38, mid:0.31} }) },
    { name:'voice and bgm mix', voice:makeTestAnalysis({ kwRms:-18 }), bgm:makeTestAnalysis({ kwRms:-14, bands:{...makeTestAnalysis().bands, vocalOverlap:0.42} }) }
  ];
  const required = {
    clipgain:['Set Gain To','Normalize All Peaks To','Safety Cap','Residual Gain Handling'],
    denoise:['Processing Focus','Amount','Output Noise Only','Gain'],
    deesser:['Mode','Threshold','Center Frequency','Bandwidth','Output Sibilance Only','Essential Sound DeEss Slider'],
    dynamics:['AutoGate Enabled','AutoGate Threshold','AutoGate Attack','AutoGate Release','AutoGate Hold','Compressor Enabled','Compressor Threshold','Ratio','Attack','Release','MakeUp Gain','Essential Sound Dynamics Slider'],
    eq:['Main Gain','Band Enabled','Filter Type','Frequency','Gain','Q','Slope'],
    limiter:['Peak Mode','Input Boost','Maximum Amplitude','Look-Ahead Time','Release Time','Link Channels'],
    duck:['Tag Clip As','Duck Against','Duck Amount','Sensitivity','Fade','Attack','Release','BGM Base Gain']
  };
  const failures = [];
  scenarios.forEach(sc => {
    S.voice = sc.voice ? { a:sc.voice, filename:sc.name + '-voice.wav' } : null;
    S.bgm = sc.bgm ? { a:sc.bgm, filename:sc.name + '-bgm.wav' } : null;
    const report = buildReportData();
    report.tracks.forEach(track => track.effects.forEach(effect => {
      const need = required[effect.id];
      if (!need) return;
      const names = effect.params.map(p => p.name);
      need.forEach(n => { if (!names.includes(n)) failures.push(`${sc.name}: ${effect.id} missing ${n}`); });
    }));
    if (report.mix.ready) {
      const duck = report.mix.effects.find(e => e.id === 'duck');
      required.duck.forEach(n => { if (!duck.params.some(p => p.name === n)) failures.push(`${sc.name}: duck missing ${n}`); });
    }
  });
  S.voice = backup.voice; S.bgm = backup.bgm;
  if (failures.length) console.error('Report self-test failed', failures);
  else console.info('Report self-test passed');
  return { ok: failures.length === 0, failures };
}
window.runReportSelfTest = runReportSelfTest;

function makePreviewBuffer(durationSec = 3, sr = 48000) {
  const safeSr = Number.isFinite(sr) && sr > 0 ? sr : 48000;
  const safeDur = Math.max(1, Math.min(durationSec || 3, 3));
  const len = Math.max(4096, Math.round(safeSr * safeDur));
  const mono = new Float32Array(len);
  for (let i = 0; i < len; i++) mono[i] = Math.sin(i / 37) * 0.16;
  return {
    numberOfChannels: 1,
    length: len,
    duration: len / safeSr,
    getChannelData() { return mono; }
  };
}

function setPreviewFileBar(trackId, filename) {
  document.getElementById('fb-' + trackId).classList.add('show');
  document.getElementById('fn-' + trackId).textContent = filename;
  document.getElementById('fm-' + trackId).textContent = '(Preview)';
}

function setPreviewError(trackId, message) {
  const stEl = document.getElementById('st-' + trackId);
  stEl.textContent = message;
  stEl.classList.add('show');
  document.getElementById('res-' + trackId).classList.remove('show');
}

function seedPreviewTrack(trackId, analysis, filename) {
  const stEl = document.getElementById('st-' + trackId);
  stEl.textContent = '';
  stEl.classList.remove('show');
  setPreviewFileBar(trackId, filename);
  render(trackId, analysis, filename, makePreviewBuffer(analysis.dur, analysis.sr));
}

function applyPreviewState() {
  const preview = new URLSearchParams(window.location.search).get('preview');
  if (!preview) return;

  const voicePreview = makeTestAnalysis({
    kwRms: -18.2,
    tpDb: -3.4,
    lra: 10.2,
    bands: { ...makeTestAnalysis().bands, presence: 0.04, sibilance: 0.05 }
  });
  const bgmPreview = makeTestAnalysis({
    kwRms: -15.6,
    tpDb: -4.6,
    lra: 9.5,
    bands: { ...makeTestAnalysis().bands, vocalOverlap: 0.36, lowMid: 0.24, mid: 0.22 }
  });

  hideLoad();
  if (preview === 'large-file') {
    setPreviewError('voice', '未分析：檔案 256.0 MiB 超過 128 MiB 上限。請在 PR／AU 匯出不超過五分鐘的代表片段。');
    activateTrack('voice');
    return;
  }
  if (preview === 'loading') {
    showLoad('智慧調音分析中，請勿關閉網頁…');
    return;
  }
  if (preview === 'error-voice') {
    setPreviewError('voice', '解碼失敗：Preview 狀態，模擬瀏覽器不支援此格式');
    activateTrack('voice');
    return;
  }
  if (preview === 'error-bgm') {
    setPreviewError('bgm', '解碼失敗：Preview 狀態，模擬瀏覽器不支援此格式');
    activateTrack('bgm');
    return;
  }
  if (preview === 'voice' || preview === 'both') {
    seedPreviewTrack('voice', voicePreview, 'preview-voice.wav');
  }
  if (preview === 'bgm' || preview === 'both') {
    seedPreviewTrack('bgm', bgmPreview, 'preview-bgm.wav');
  }
  if (preview === 'bgm') {
    activateTrack('bgm');
  } else if (preview === 'voice' || preview === 'both') {
    activateTrack('voice');
  }
}

function hasAnyAnalyzedTrack() {
  return ['voice', 'bgm'].some(trackId => !!S[trackId]);
}

function updateCopyButtonState() {
  const btn = document.getElementById('copyBtn');
  const customValid = document.getElementById('platformSel').value !== 'custom' || document.getElementById('customError').hidden;
  const ready = hasAnyAnalyzedTrack() && customValid;
  btn.disabled = !ready;
  btn.title = ready
    ? '複製目前分析報告'
    : customValid ? '請先完成至少一軌分析，再複製報告' : '請先修正自訂響度與 True Peak 數值';
}

function buildReport() {
  const r = buildReportData();
  let t = `${r.meta.title}\n工具版本：v${r.meta.appVersion} · 更新 ${r.meta.appUpdatedAt}\n產生時間：${r.meta.generatedAt}\n目標平台：${r.meta.platform}\nReference Target：${r.meta.targetLufs} / ${r.meta.peakCeiling}\n輸出格式：${r.meta.outputFormat}\n${'='.repeat(44)}\n\n`;
  t += `[總結建議]\n整體狀態：${r.summary.status}\n主要問題：${r.summary.mainIssues.join('；') || '尚未發現明顯問題'}\n優先處理順序：${r.summary.priority}\n\n`;
  r.tracks.forEach(track => {
    t += `[${track.label}] ${track.ready ? track.filename : '尚未上傳'}\n${'-'.repeat(36)}\n`;
    if (!track.ready) { t += '尚未上傳分析\n\n'; return; }
    t += `狀態：${track.status}\n`;
    if (track.channelCaveat) t += `多聲道注意：${track.channelCaveat}\n`;
    if (S[track.trackId]?.a?.stereo?.corr < 0) t += '注意：頻譜、ZCR 與噪音指標來自 mono downmix；因左右聲道負相關，這些 mono-derived 指標的信心降低。\n';
    t += `估算摘要：\n`;
    track.measurements.forEach(m => t += `- ${m.kind}｜${m.name}: ${m.value}\n`);
    t += `問題摘要：\n`;
    track.issues.forEach(i => t += `- ${i}\n`);
    t += `完整效果設定：\n`;
    track.effects.forEach(f => {
      t += `\n■ ${f.name}\n`;
      t += `  狀態：${f.status}　模式：${f.mode}　信心：${f.confidence}\n`;
      t += `  目的：${f.purpose}\n`;
      f.params.forEach(p => t += `  - ${p.name}: ${p.value}（${p.kind || 'Suggested Setting'}｜${stripHtml(p.note)}）\n`);
      (f.steps || []).forEach((s, i) => t += `  ${i+1}. ${stripHtml(s)}\n`);
    });
    t += '\n';
  });
  t += `[人聲 × BGM 混音建議]\n${'-'.repeat(36)}\n`;
  if (!r.mix.ready) {
    t += `${r.mix.note}\n`;
  } else {
    r.mix.effects.forEach(f => {
      t += `■ ${f.name}\n`;
      f.params.forEach(p => t += `  - ${p.name}: ${p.value}（${p.kind || 'Suggested Setting'}｜${stripHtml(p.note)}）\n`);
    });
  }
  t += `\n附註：Estimated 類數值為瀏覽器端近似分析，Reference Target 為目標值，Suggested Setting 為 PR/AU 調音起點；最終發布請以耳聽與專業 loudness meter 複核。\n`;
  return t;
}
const copyButtonIdleHtml = document.getElementById('copyBtn').innerHTML;
let copyFeedbackTimer;
function showCopyButtonFeedback(message, title, duration = 1500) {
  const btn = document.getElementById('copyBtn');
  clearTimeout(copyFeedbackTimer);
  btn.textContent = message;
  btn.title = title;
  if (!duration) return;
  copyFeedbackTimer = setTimeout(() => {
    btn.innerHTML = copyButtonIdleHtml;
    updateCopyButtonState();
  }, duration);
}

function writeToClipboard(text) {
  if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
    return Promise.reject(new Error('Clipboard API unavailable'));
  }
  return navigator.clipboard.writeText(text);
}

async function copyReport(writeText = writeToClipboard, feedbackDuration = 1500) {
  if (!hasAnyAnalyzedTrack()) return;
  try {
    await writeText(buildReport());
    showCopyButtonFeedback('已複製', '完整分析報告已複製到剪貼簿', feedbackDuration);
  } catch {
    showCopyButtonFeedback('複製失敗', '瀏覽器無法存取剪貼簿，請確認 HTTPS 或 localhost 權限後重試', feedbackDuration);
  }
}
document.getElementById('copyBtn').addEventListener('click', () => {
  void copyReport();
});

// 初始設定 accent-track（預設人聲 tab 啟動）
document.documentElement.style.setProperty('--accent-track', '#5ec9a3');
document.getElementById('versionBadge').textContent = `v${APP_VERSION} · 更新 ${APP_UPDATED_AT}`;
applyPreviewState();
updateCopyButtonState();
