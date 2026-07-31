---
name: ui-smoke-check
description: Run a lightweight UI verification pass for this static frontend audio tool. Use when Codex changes layout, copy, states, upload flow, playback controls, result rendering, or any interaction that could regress desktop or mobile behavior.
---

# UI Smoke Check

Use this skill after UI or interaction changes in this repo.

## Follow this workflow

1. Identify whether the change is `UI-only`, `playback/export`, or `refactor with UI impact`.
2. Re-check the relevant states instead of only the happy path.
3. Verify both desktop and narrow mobile layout assumptions.
4. Report regressions, unverified areas, and any manual-only checks clearly.

## Required state checks

### Always check

- Empty state before file selection.
- Loading or processing state.
- Result state after success.
- Error state for invalid or failed input.
- Basic readability and tap/click order on mobile width.
- Report or action button state if the change affects export, copy, or next-step actions.
- If this repo exposes `preview` query states, use them on localhost before claiming manual state coverage.

### If upload flow changed

- Drag and drop target state.
- File picker flow.
- Replace or clear file action.
- Status text during parse or analysis.

### If playback or preview changed

- Play, pause, and seek behavior if present.
- Whether analysis blocks UI updates.
- Whether controls remain reachable on mobile.

### If result rendering changed

- Card/table alignment.
- Long text wrapping.
- Metric emphasis and warning visibility.
- Overflow or clipping in narrow screens.

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
