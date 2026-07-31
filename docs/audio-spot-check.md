# Audio Spot Check

Use this checklist when real voice or BGM files are available. The goal is to judge whether the tool gives useful PR / AU beginner tuning starting points, not to certify loudness or QC accuracy.

Do not commit private audio files to this repo. Keep test media outside the repository unless the file is explicitly cleared for public use.

## Test Set

Use 2-3 short samples when possible:

| Case | Purpose | Suggested source |
|---|---|---|
| Normal voice | Baseline beginner narration flow | Clean dialogue, 30-90 seconds |
| Noisy or uneven voice | Recommendation stress case | Fan noise, room tone, or large sentence-level volume changes |
| Voice + BGM | Ducking and masking review | One dialogue clip plus one music bed |

If only one file is available, start with a normal voice sample and record the limitation.

For very large files, first test a short excerpt and record that the result is excerpt-only. Current browser analysis decodes the selected file in memory, so hour-long uncompressed WAV files can be slow or fail on lower-memory machines.

## Run Steps

1. Start localhost with `npm run serve` or `.\scripts\serve.ps1`.
2. Open `http://127.0.0.1:8123/`.
3. Upload the voice file and wait for analysis to finish.
4. If BGM is available, upload it and review the mix section.
5. Copy the full report after at least one track is analyzed.
6. Listen to the source audio and compare the report against obvious audible issues.

## Review Criteria

Record whether each area is useful, noisy, or misleading:

| Area | Check |
|---|---|
| Loudness estimate | Does the gain advice feel directionally reasonable for the platform target? |
| Peak warning | Does clipping or peak risk match audible distortion or visibly hot material? |
| Noise/SNR | Does the tool flag obvious background noise without overreacting to clean material? |
| Dynamics/LRA-like | Does compression advice match clearly uneven or over-dynamic speech? |
| EQ bands | Are rumble, muddiness, presence, hiss, and sibilance suggestions plausible by ear? |
| BGM masking | Does the BGM advice help keep dialogue clear? |
| Report wording | Does the output stay framed as estimated guidance and not a QC verdict? |

## Result Template

```text
Date:
Sample:
Type: voice / bgm / voice + bgm
Length:
Browser:
Platform target:

Tool output:
- Main status:
- Top 3 issues:
- Suggested first action:

Listening notes:
- Obvious issues:
- Tool matched:
- Tool missed:
- Tool overreacted:

Verdict:
- Useful as beginner starting point: yes / partial / no
- Threshold or wording change needed:
- Follow-up:
```

## Close-Out

After a spot check, update `docs/worklog.md` with:

- Samples checked, without committing private filenames if sensitive.
- Browser and viewport used.
- Whether recommendations were directionally useful.
- Any threshold, copy, or UI issue found.
