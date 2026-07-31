# Iteration Checklist

Use this checklist for each implementation cycle.

## 1. Classify the change

- `UI-only`
- `audio logic`
- `playback/export`
- `refactor`

## 2. Apply the minimum required verification

### UI-only

- Desktop layout still readable
- Mobile layout still usable
- Empty state checked
- Loading state checked
- Result state checked
- Error state checked
- Report or action buttons checked if the change touches them
- If available, use localhost preview states such as `?preview=voice|bgm|both|error-voice|error-bgm|loading`

### audio logic

- Recommendation wording does not overclaim precision
- One normal case reviewed
- One edge case reviewed if feasible
- Browser/runtime constraint considered
- If real audio is available, use `docs/audio-spot-check.md` and record whether the advice was directionally useful

### playback/export

- File import checked
- Playback or preview checked
- Export path checked if changed
- Invalid file or failure path checked

### refactor

- Behavior expected to stay the same
- Existing flow re-checked
- UI state visibility re-checked

## 3. Prepare commit notes

- What changed:
- Why:
- Verification:
- Residual risk:

## 4. Worklog template

Date:
Task:
Type:
Files:
Verification:
Risk:

Append completed entries to `docs/worklog.md`.
