# Codex Workflow

This repo is a browser-audio tool intended for static deployment.

## Default loop

1. Read the current code and classify the request.
2. Make the smallest change that solves the request.
3. Verify using the checklist for that change type.
4. Record the outcome in a compact worklog entry.

## Change types

### UI-only

- Touches layout, copy, state visibility, styling, or interaction feedback.
- Run the `ui-smoke-check` skill after changes.

### audio logic

- Touches analysis, recommendations, thresholds, or parameter logic.
- Run the `audio-tuning-review` skill after changes.

### playback/export

- Touches file import, playback, preview, rendering pipeline, or export behavior.
- Run both skills after changes because the audio path and the UI path can both regress.

### refactor

- Intends to keep behavior the same while improving structure.
- Re-check the old flow, not only the edited code.

## Verification rule

- Prefer `npm run test:report` for report self-test coverage when Node/npm is available.
- Prefer `npm run smoke:manual` to list localhost preview states before manual UI checks.
- If validation was manual, say so.
- If a state or environment was not checked, say so.
- Do not present heuristic browser-side audio output as lab-grade measurement.

## Iteration close-out

Every iteration should end with:

- Completed work
- Affected files
- Verification performed
- Residual risk

Append the compact record to `docs/worklog.md` when an iteration changes repo files.

## Git rule

- Keep one purpose per commit.
- Use `docs/sync-and-portability.md` before pushing or packaging the project.
- Before commit, answer:
  - What changed?
  - Why did it change?
  - How was it verified?
  - What risk remains?

## Upgrade trigger

Add `package.json`, scripts, and partial automation when either of these becomes true:

- The repo grows beyond a single-page structure.
- Manual smoke checks become repetitive enough that they hide regressions.

Current helper commands:

- `npm run serve`
- `npm run smoke:manual`
- `npm run test:report`

PowerShell fallbacks when Node/npm is not available:

- `.\scripts\serve.ps1`
- `.\scripts\preview-smoke-urls.ps1`
