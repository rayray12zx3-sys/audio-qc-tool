# Worklog

Compact record of project iterations. Keep entries factual and short.

## 2026-08-05

### Interaction race regression coverage and copy feedback hardening

- Type: `UI-only`, `audio logic`
- Files: `index.html`, `scripts/report-self-test.mjs`, `docs/worklog.md`, `TASK_STATE.md`
- Completed: Preserved a fixed idle template for the report-copy button so rapid feedback cannot lose its SVG or label; expanded the VM interaction self-test to drive stale successful and failed `handleFile()` runs instead of checking run-token helpers alone.
- Verification: `git diff --check` and the report self-test passed with `interaction: "passed"`. Localhost browser checks covered desktop and `390x844` empty, voice, BGM, both, error, and loading states; rapid copy feedback; one private local WAV success; invalid replacement cleanup; and no browser console errors or page-level horizontal overflow.
- Risk: Browser file-chooser latency prevented a fresh two-file overlap in this run, so parallel loading relies on the direct automated test plus the 2026-08-04 browser record. Replaced decode work is still not cancelled, and human listening remains pending.

## 2026-08-04

### Concurrent analysis state hardening

- Type: `UI-only`, `audio logic`
- Files: `index.html`, `scripts/report-self-test.mjs`, `docs/worklog.md`
- Completed: Added per-track analysis run tokens so only the newest selection may render its result or error, and a shared active-analysis count so the loading overlay stays until all active tracks finish.
- Verification: Report self-test covers stale same-track tokens and parallel loading; localhost browser checks covered a successful real WAV upload, copy feedback, failed replacement cleanup, two overlapping local WAV analyses, desktop previews, and `390x844` mobile loading/error/both previews with no horizontal overflow.
- Risk: Replaced analyses are ignored at render time but are not cancelled, so stale browser decode work can still consume CPU and memory. Human listening and any threshold change remain pending.

## 2026-08-03

### Upload-state and peak-warning hardening

- Type: `audio logic`, `UI-only`
- Files: `index.html`, `scripts/report-self-test.mjs`, `docs/worklog.md`
- Completed: Clear stale track, mix, badge, and report-copy state before replacement analysis; reframe near-full-scale samples as a clipping-risk indicator; add visible clipboard failure feedback.
- Verification: Expanded report self-test covers near-full-scale wording, stale-state clearing, and clipboard failure feedback; localhost browser checks covered two real WAV uploads, copy feedback, failed replacement, desktop preview states, and `390x844` mobile `?preview=both`.
- Risk: Human listening remains pending, so no noise, dynamics, or EQ threshold was changed.

## 2026-07-31

### Real audio report extraction

- Type: `audio logic`
- Files: `docs/audio-spot-check-results.md`, `docs/worklog.md`
- Completed: Recorded current tool output for two local mono voice WAV files without committing private audio; both samples showed low estimated loudness, raised noise floor, wide dynamics, and Clip Gain safety-cap behavior.
- Verification: Local static server loaded at `http://127.0.0.1:8123/`; the current `index.html` analysis/report functions were run against both WAV files.
- Risk: Human listening was not performed by Codex, so threshold changes remain blocked until audible match/miss/overreaction is confirmed.

### Real audio spot check workflow

- Type: `audio logic`, `refactor`
- Files: `docs/audio-spot-check.md`, `README.md`, `docs/iteration-checklist.md`, `.gitignore`, `index.html`
- Completed: Added a real-audio spot check workflow, ignored local private audio media, and aligned Clip Gain risk wording with the same 1 dB peak safety margin used by effect recommendations.
- Verification: Two full mono voice WAV files and one 5-minute excerpt from a large stereo WAV were analyzed with the current browser-analysis functions.
- Risk: The large stereo WAV was not analyzed end-to-end because hour-long uncompressed files remain a browser memory/performance risk.

### Analysis wording and heuristic framing pass

- Type: `audio logic`, `UI-only`
- Files: `index.html`
- Completed: Reframed remaining QC, measurement, standard, and safety wording toward browser-side estimates and beginner tuning suggestions; fixed mobile preview overflow from chain/path/table content.
- Verification: PowerShell smoke URL helper, PowerShell parser checks, `git diff --check`, report self-test through Codex Node REPL, localhost UI smoke on desktop and `390x844`, and GitHub Pages basic load check.
- Risk: Audio measurements remain heuristic estimates and still need real audio spot checks before expanding analysis claims.

### Repo-local Codex workflow setup

- Type: `refactor`
- Files: `.codex/skills/`, `docs/codex-workflow.md`, `docs/iteration-checklist.md`
- Completed: Added repo-local review and UI smoke-check guidance for future Codex iterations.
- Verification: Basic file presence and content checks.
- Risk: Future Codex skill auto-trigger behavior still needs observation in new threads.

### UI report guard and conservative wording

- Type: `UI-only`, `audio logic`
- Files: `index.html`
- Completed: Guarded copy report behavior before analysis and reduced overconfident positive wording.
- Verification: Preview states and report self-test were checked in prior iteration.
- Risk: Audio measurements remain browser-side heuristic estimates, not standards-grade QC.

### Preview smoke check documentation

- Type: `UI-only`
- Files: `docs/preview-smoke-check.md`
- Completed: Documented localhost preview URLs for empty, loading, error, and result states.
- Verification: Static URL check against `index.html` preview parameters.
- Risk: Manual browser check still required for real visual confirmation.

### Lightweight helper commands

- Type: `refactor`
- Files: `package.json`, `scripts/preview-smoke-urls.mjs`, `scripts/report-self-test.mjs`
- Completed: Added no-dependency npm helper entries for serving, manual smoke URL listing, and report self-test.
- Verification: Package scripts parsed; report self-test passed through Codex Node environment.
- Risk: Local machine PATH currently lacks `node` and `npm`.

### PowerShell fallbacks

- Type: `refactor`
- Files: `scripts/serve.ps1`, `scripts/preview-smoke-urls.ps1`, `README.md`, `docs/preview-smoke-check.md`, `docs/codex-workflow.md`
- Completed: Added Python-backed PowerShell helpers for environments without Node/npm.
- Verification: PowerShell preview URL script ran; both `.ps1` files passed parser checks.
- Risk: `serve.ps1` was not left running after verification to avoid occupying the terminal.

### Sync and portability checklist

- Type: `refactor`
- Files: `docs/sync-and-portability.md`, `README.md`, `docs/codex-workflow.md`
- Completed: Documented GitHub sync, portable folder contents, and GitHub Pages constraints.
- Verification: Static checks confirmed coverage of Git commands, portable files, `.codex/skills/`, and GitHub Pages notes.
- Risk: Current machine PATH lacks `git`, so repository status and commit state were not checked.
