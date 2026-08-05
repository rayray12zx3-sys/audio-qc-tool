# Audio Spot Check Results

This file records real-audio spot checks for private local samples. Do not add
the source audio files to git.

## 2026-07-31 - Local voice WAV pair

Scope: two local mono 48 kHz 32-bit float WAV files from `真實音檔/`.
Private filenames are omitted from this public-facing note.

Browser target: `http://127.0.0.1:8123/`
Platform target: YouTube / Spotify (`-14 LUFS / -1.0 dBTP`)
Method: current `index.html` analysis functions were run against the two WAV
files. Human listening was not performed by Codex.

### Sample A

Type: voice
Length: 327.83 seconds
Format: 48 kHz, mono, 32-bit float WAV

Tool output:

- Main status: 有風險
- Top 3 issues:
  - 人聲音量不足: Estimated Integrated Loudness `-38.0 LUFS`, about `24.0 dB` below the YouTube / Spotify target.
  - 背景雜音顯著: estimated noise floor `-51.8 dBFS`, SNR about `14.9 dB`.
  - 動態範圍過大: crest about `21.4 dB`.
- Suggested first action: Clip Gain starting point, capped at `+14.6 dB` by the Estimated True Peak safety rule.
- Suggested effect chain: Clip Gain, DeNoise, DeEsser, Dynamics, Parametric Equalizer, Hard Limiter.

Listening notes:

- Obvious issues: not checked by human listening in this Codex run.
- Tool matched: pending human confirmation.
- Tool missed: pending human confirmation.
- Tool overreacted: pending human confirmation.

Verdict:

- Useful as beginner starting point: pending human confirmation.
- Threshold or wording change needed: none confirmed.
- Follow-up: listen to beginning, middle, and a visibly/obviously uneven section before changing thresholds.

### Sample B

Type: voice
Length: 348.85 seconds
Format: 48 kHz, mono, 32-bit float WAV

Tool output:

- Main status: 有風險
- Top 3 issues:
  - 人聲音量不足: Estimated Integrated Loudness `-38.1 LUFS`, about `24.1 dB` below the YouTube / Spotify target.
  - 背景雜音顯著: estimated noise floor `-51.7 dBFS`, SNR about `14.6 dB`.
  - 動態範圍過大: crest about `21.3 dB`.
- Suggested first action: Clip Gain starting point, capped at `+14.7 dB` by the Estimated True Peak safety rule.
- Suggested effect chain: Clip Gain, DeNoise, DeEsser, Dynamics, Parametric Equalizer, Hard Limiter.

Listening notes:

- Obvious issues: not checked by human listening in this Codex run.
- Tool matched: pending human confirmation.
- Tool missed: pending human confirmation.
- Tool overreacted: pending human confirmation.

Verdict:

- Useful as beginner starting point: pending human confirmation.
- Threshold or wording change needed: none confirmed.
- Follow-up: listen to beginning, middle, and a visibly/obviously uneven section before changing thresholds.

### Cross-sample observations

- Both samples produced the same high-level recommendation pattern: low loudness, raised noise floor, and wide dynamics.
- Both samples triggered the Clip Gain safety cap, leaving remaining gain to compression/makeup instead of full pre-gain.
- No threshold adjustment is justified from these results alone because human listening has not confirmed whether the noise, dynamics, EQ, or DeEsser suggestions are audible and useful.
- The 1.46 GB stereo WAV remains out of scope for full-file analysis until a browser-side large-file strategy exists.
