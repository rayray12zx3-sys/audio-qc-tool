# Preview Smoke Check

Use this manual smoke check when UI state visibility, result rendering, tabs, or report actions may have changed.

This is not a full E2E test suite. It is a lightweight localhost checklist for catching obvious UI regressions without preparing real audio files.

## Start Local Server

From the repo root:

```powershell
npm run serve
```

If Node/npm is not available on the machine, use Python directly:

```powershell
python -m http.server 8123 --bind 127.0.0.1
```

Or use the PowerShell fallback:

```powershell
.\scripts\serve.ps1
```

Base URL:

```text
http://127.0.0.1:8123/
```

If port `8123` is already in use, choose another local port and update the URLs below.

## Preview URLs

| State | URL | Expected checks |
|---|---|---|
| Empty | `http://127.0.0.1:8123/` | No uploaded track results are shown; mix empty state is visible; copy report button is disabled. |
| Voice result | `http://127.0.0.1:8123/?preview=voice` | Voice tab is active; voice result is visible; BGM result is not required; copy report button is enabled. |
| BGM result | `http://127.0.0.1:8123/?preview=bgm` | BGM tab is active; `preview-bgm.wav` is visible; BGM result is visible; copy report button is enabled. |
| Both results | `http://127.0.0.1:8123/?preview=both` | Voice and BGM data are present; mix section is visible; copy report button is enabled. |
| Voice error | `http://127.0.0.1:8123/?preview=error-voice` | Voice tab is active; voice error state is visible; copy report button is disabled. |
| BGM error | `http://127.0.0.1:8123/?preview=error-bgm` | BGM tab is active; BGM error state is visible; copy report button is disabled. |
| Loading | `http://127.0.0.1:8123/?preview=loading` | Loading overlay is visible; no completed report should be treated as ready. |

## Desktop Checklist

- Tabs switch to the expected active track for `voice`, `bgm`, `error-voice`, and `error-bgm`.
- Result, error, and loading states are visually distinct.
- Copy report button enabled or disabled state matches the preview state.
- Mix section appears only when enough analyzed data exists.
- Long recommendation text wraps without clipping.

## Mobile Checklist

Recommended viewport:

```text
390x844
```

Check:

- Tabs remain reachable and horizontally scrollable if needed.
- Primary controls and report actions remain tappable.
- Result cards, metric rows, and warning text do not overlap.
- Copy report button state is still clear.
- Loading and error states remain readable.

## Close-Out Notes

When reporting the smoke check result, include:

- States checked
- Viewports checked
- Any state not checked
- Main remaining UI risk
