---
name: ui-smoke-check
description: Run a lightweight desktop-first UI verification pass for this static frontend audio tool. Use when Codex changes layout, copy, states, upload flow, playback controls, result rendering, or any interaction that could regress the PC browser experience; check narrow screens only when explicitly requested.
---

# UI Smoke Check

Use this skill after UI or interaction changes in this repo.

## Follow this workflow

1. Identify whether the change is `UI-only`, `playback/export`, or `refactor with UI impact`.
2. Re-check the relevant states instead of only the happy path.
3. Verify the desktop layouts relevant to the change; use `1440x900` and `1024x768` when no other viewport is specified.
4. Report regressions, unverified areas, and any manual-only checks clearly.

## Required state checks

### Always check

- Empty state before file selection.
- Loading or processing state.
- Result state after success.
- Error state for invalid or failed input.
- Basic readability, click order, wrapping, and horizontal overflow on desktop.
- Report or action button state if the change affects export, copy, or next-step actions.
- If this repo exposes `preview` query states, use them on localhost before claiming manual state coverage.

### Check narrow screens only when requested

- Confirm basic readability and tap order at the requested viewport.
- Report narrow-screen coverage separately; it is not part of the default acceptance criteria.

### If upload flow changed

- Drag and drop target state.
- File picker flow.
- Replace or clear file action.
- Status text during parse or analysis.

### If playback or preview changed

- Play, pause, and seek behavior if present.
- Whether analysis blocks UI updates.
- Whether controls remain reachable at supported desktop sizes.

### If result rendering changed

- Card/table alignment.
- Long text wrapping.
- Metric emphasis and warning visibility.
- Overflow or clipping at supported desktop sizes.

### If refactor changed structure

- Confirm existing states still appear in the same order.
- Confirm selectors, event wiring, and status visibility were not broken by the restructure.

## Failure rules

- Do not claim full verification if the browser interaction was not exercised.
- If a state was not checked, name it explicitly.
- If a regression risk is likely but unconfirmed, state it as risk instead of certainty.

## Output format

Use this structure in the final response when this skill is active:

- Result: pass/fail summary.
- States checked: concise list.
- Gaps: anything not exercised.
- Risk: the main regression concern, if any.
