---
name: audio-tuning-review
description: Review browser-audio tuning changes for this static-site repo. Use when Codex needs to assess audio analysis logic, recommendation wording, playback or export side effects, browser feasibility, performance cost, or GitHub Pages deployment risk.
---

# Audio Tuning Review

Use this skill before changing or reviewing audio-related behavior in this repo.

## Follow this workflow

1. Read the current implementation and identify whether the change touches `audio logic`, `playback/export`, or a mixed flow.
2. State assumptions explicitly when the current code does not prove the behavior.
3. Keep recommendations framed as guidance, estimate, likelihood, or confidence. Do not present browser-side heuristics as standards-grade measurement.
4. Check whether the change remains compatible with static hosting and browser-only execution.
5. End with a compact outcome note covering completed work, affected files, verification, and residual risk.

## Review criteria

### Recommendation wording

- Prefer `suggest`, `estimate`, `likely`, `confidence`, `approximate`.
- Avoid `certified`, `accurate measurement`, `professional-grade`, `meets broadcast spec` unless the code and validation actually prove it.
- Call out when output is heuristic, threshold-based, or based on limited browser-side analysis.

### Browser audio constraints

- Confirm the change can run without a backend.
- Check whether Web Audio API usage depends on user gesture, decode limits, memory pressure, or browser support gaps.
- Flag heavy synchronous work that could block playback, scrubbing, or UI response.
- Prefer chunked work, Worker offload, progress reporting, or lighter defaults when analysis cost grows.

### Playback and export safety

- Check file import failure handling.
- Check playback stability after analysis or parameter changes.
- Check whether preview and export use the same assumptions or could diverge.
- Flag any change that could break large-file handling or cancelability.

### Static deployment safety

- Do not introduce server-side dependencies by accident.
- Watch relative paths, base-path assumptions, and browser-only APIs.
- Flag third-party libraries that would require build or hosting changes.

## Verification expectations by change type

### audio logic

- Review output wording for overclaim risk.
- Test at least one normal input and one edge case if feasible.
- Check that UI still explains uncertainty and limitation clearly.

### playback/export

- Re-check file import, playback, preview, export, and error handling.
- Confirm no regression in loading or completion states.

### mixed change

- Apply both lists above and call out cross-effects.

## Output format

Use this structure in the final response when this skill is active:

- Result: one-sentence conclusion.
- Verification: what was checked and what was not checked.
- Risk: the most important remaining limitation, if any.
