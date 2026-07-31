# Worklog

Compact record of project iterations. Keep entries factual and short.

## 2026-07-31

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
