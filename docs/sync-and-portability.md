# Sync and Portability Checklist

Use this checklist before pushing changes to GitHub or moving the project to another computer.

## GitHub Sync

Local file changes do not automatically appear on GitHub. To publish source changes, use a normal Git flow on a machine where `git` is available:

```powershell
git status
git add .
git commit -m "Describe the change"
git push
```

Before committing, record:

- What changed
- Why it changed
- How it was verified
- Remaining risk

If `git` is not available on the current machine, do not guess the repository state from memory. Check files directly, then commit from another environment that has Git installed.

## Portable Folder

For moving the project to another computer, copy the whole project folder when possible.

Include:

- `index.html`
- `README.md`
- `AGENTS.md`
- `docs/`
- `scripts/`
- `package.json`
- `.codex/skills/`

Include `.git/` only if the target computer should keep the repository history, branch, remotes, and commit state.

## Minimal Runtime

The tool itself is a static browser page. For basic use, `index.html` is enough.

For maintenance and verification, keep the helper files too:

- `docs/preview-smoke-check.md`
- `scripts/serve.ps1`
- `scripts/preview-smoke-urls.ps1`
- `scripts/report-self-test.mjs`

Node/npm is useful for the npm helper commands. Python is enough to serve the static page locally through the PowerShell fallback.

## GitHub Pages Notes

- Keep asset paths relative unless there is a specific reason to use absolute paths.
- Avoid adding backend-only dependencies unless the hosting model changes.
- Re-check localhost preview states before publishing UI changes.
- Do not describe browser-side heuristic analysis as a standards-grade QC result.
