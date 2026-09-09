# Worklog

Compact record of project iterations. Keep entries factual and short.

## 2026-09-09

### v0.3.2 release finalization

- Type: `release`, `validation`, `documentation`
- Files: `audio-analysis.js`, `app.js`, `index.html`, `styles.css`, tests, version and handoff docs
- Completed: Re-reviewed and released the existing objective-correctness, anti-phase protection, recommendation wording, accessibility and desktop UI candidate as commit `a1be238`; pushed it to `origin/main` with GitHub noreply author metadata. Updated the visible release date to 2026-09-09.
- Verification: Both classic scripts passed `node --check`; report and DSP self-tests passed; four Playwright Chromium E2E cases passed at the required desktop sizes and relevant preview/upload/error/security states; `git diff --check` passed; GitHub Actions `Verify #10` completed successfully for `a1be238`.
- Risk: The repository is currently private, and GitHub Pages settings require either a plan upgrade or making the repository public; the former public Pages URL returns 404. Old Git history still contains private/company identity metadata. Human listening and non-Chromium codec coverage remain incomplete.

## 2026-08-19

### v0.3.2 objective correctness and desktop UI hardening candidate

- Type: `audio logic`, `UI-only`, `accessibility`, `test`
- Files: `audio-analysis.js`, `app.js`, `index.html`, `styles.css`, `scripts/report-self-test.mjs`, `tests/`, version and handoff docs
- Completed: Corrected short-block loudness continuity, True Peak endpoint coverage, final complete STFT-frame inclusion, Hann coherent-gain normalization, finite zero-length results, and stereo-width mapping for anti-phase material. Suppressed mono-downmix-derived recommendations when stereo correlation is negative; clarified PLR-like, noise-proxy, True Peak, limiter and BGM-masking language; separated LUFS targets from dB gain; and removed the duplicated BGM duck attenuation. Added safe filename rendering, valid custom zero handling, explicit validation, labelled controls and regions, real effect-chain buttons, stronger contrast, and long-filename containment. No listening-dependent recommendation threshold was tuned.
- Verification: Both classic scripts passed `node --check`; report and DSP self-tests passed the new deterministic and integration regressions; four Chromium E2E cases passed desktop previews, upload/replacement/rejection, accessibility/security validation, and direct `file://` loading; `git diff --check` passed. In-app browser smoke covered eight states at `1440x900` and `1024x768`, custom validation, result cards, and the Ducking section without horizontal overflow or console error/warn.
- Risk: Estimated True Peak remains a 4x Catmull-Rom approximation; analysis is synchronous once decoding begins and cannot be cancelled. Human listening, non-Chromium codec coverage, CI, and the published Pages site were not verified. This candidate is not committed or published.

## 2026-08-13

### v0.3.1 static asset split

- Type: `refactor`, `test`
- Files: `index.html`, `styles.css`, `audio-analysis.js`, `app.js`, `scripts/report-self-test.mjs`, `tests/`, version and handoff docs
- Completed: Moved the existing inline CSS unchanged to `styles.css`; moved pure DSP behind the classic `window.AudioAnalysis` namespace; moved remaining report, state and UI behavior to `app.js`. Kept relative classic assets so `file://` and GitHub Pages need no bundler or backend.
- Verification: Both scripts passed `node --check`; report and DSP self-tests passed, including the True Peak to Clip Gain integration assertion; three Chromium E2E cases passed desktop states, synthetic upload flow and direct `file://` loading; in-app browser smoke passed external assets and all preview states at `1440x900` and `1024x768` with no overflow or console error/warn. GitHub Actions passed on PR #7 before squash merge; the published Pages site shows `v0.3.1`, loads all three external assets, and has no console messages.
- Risk: This batch intentionally does not change formulas, thresholds, wording, DOM order or interactions. External relative assets must remain beside `index.html` when copied or deployed.

### v0.3.0 large-file excerpt preflight and desktop UX

- Type: `audio import`, `UI-only`, `accessibility`
- Files: `index.html`, `package.json`, `tests/app.spec.mjs`, `README.md`, `AGENTS.md`, `scripts/preview-smoke-urls.*`, `docs/preview-smoke-check.md`, `TASK_STATE.md`
- Completed: Added an object-URL metadata preflight before `arrayBuffer()`/decode (128 MiB, 300 seconds, 5-second timeout) and safe rejection that asks for a PR/AU representative excerpt. Added a large-file preview state, same-file reselect support, desktop keyboard/tab semantics, live loading/status feedback, profile-label presets, and desktop smoke coverage.
- Verification: Report and DSP self-tests passed; the report test proves oversized input does not call `arrayBuffer()` and object URLs are revoked. Two Chromium E2E cases passed synthetic WAV upload/reselect/invalid replacement/large-file rejection plus desktop state, copy, keyboard and console checks. In-app browser smoke passed `1440x900` and `1024x768` without overflow or console error/warn. GitHub Actions passed on PR #6 before squash merge.
- Risk: Metadata availability remains browser/codec dependent; unavailable or slow metadata intentionally rejects rather than attempting a memory-heavy decode.

### v0.2.1 multichannel meter safety

- Type: `audio logic`, `test`, `CI`
- Files: `index.html`, `package.json`, `package-lock.json`, `tests/`, `playwright.config.mjs`, `.github/workflows/verify.yml`, `README.md`, `TASK_STATE.md`
- Completed: Changed peak, near-peak, true-peak and DC-offset paths to preserve the worst individual channel; changed estimated integrated loudness to independently K-weight and equally sum channel block energy. Added a >2-channel caveat and reduced-confidence messaging for frequency/noise indicators derived from negative-correlation mono downmix.
- Verification: Report self-test passed; DSP self-test passed 8 deterministic fixtures; Chromium E2E passed empty/loading/both/copy/console at `1440x900` and `1024x768`; localhost browser smoke showed no horizontal overflow or console error/warn. GitHub Actions passed on PR #5 before squash merge.
- Risk: This is still browser-side estimated analysis. Downmix-derived spectrum/noise indicators can be misleading for phase-cancelled material; no large-file behavior was changed.

## 2026-08-12

### Visible v0.2.0 and desktop-first support

- Type: `UI-only`, `refactor`
- Files: `index.html`, `package.json`, `scripts/report-self-test.mjs`, `README.md`, `AGENTS.md`, `.codex/skills/ui-smoke-check/`, `docs/preview-smoke-check.md`, `docs/iteration-checklist.md`, `TASK_STATE.md`
- Completed: Added the visible `v0.2.0 · 更新 2026-08-12` badge and the same metadata to copied reports; aligned package version, release guidance, project rules, and UI verification guidance around PC/desktop browser support.
- Verification: Report self-test passed with `interaction: "passed"`; static version consistency and `git diff --check` passed; localhost browser checks covered empty, voice, BGM, both, error, loading, report-copy feedback, and no horizontal overflow or console error at `1440x900` and approximately `1024x768`. PR #4 was marked Ready, squash merged, and the published Pages site was confirmed at `v0.2.0`.
- Risk: Mobile is no longer a required acceptance target. The skill validator could not run because the host Python lacks `PyYAML`; frontmatter and `agents/openai.yaml` were reviewed directly.

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
