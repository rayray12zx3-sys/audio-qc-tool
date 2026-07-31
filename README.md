# 音檔調音工具

瀏覽器端音檔調音建議工具，目標是給 PR / AU 新手取得可操作的調音起點。輸出內容是瀏覽器端近似分析與建議，不是專業 loudness meter 或標準級 QC 報告。

## 使用方式

可直接開啟 `index.html` 使用。若要用較接近正式部署的方式測試，建議從專案根目錄啟動 localhost：

```powershell
npm run serve
```

如果這台電腦沒有 Node/npm，也可以直接使用 Python：

```powershell
python -m http.server 8123 --bind 127.0.0.1
```

或使用 PowerShell fallback：

```powershell
.\scripts\serve.ps1
```

開啟：

```text
http://127.0.0.1:8123/
```

## 開發檢查

```powershell
npm run smoke:manual
npm run test:report
```

- `smoke:manual`：列出 preview smoke check URL；不會自動開瀏覽器。
- `test:report`：在 Node 環境執行既有 report self-test。

沒有 Node/npm 時，可用：

```powershell
.\scripts\preview-smoke-urls.ps1
```

詳細 UI 檢查步驟見 `docs/preview-smoke-check.md`。

真實音檔抽查流程見 `docs/audio-spot-check.md`。

迭代紀錄見 `docs/worklog.md`。

## 部署與攜帶

- 目前專案維持靜態網站形式，可部署到 GitHub Pages。
- 換電腦使用時，帶走整個資料夾即可保留工具本體、文件與 repo-local Codex skills。
- 若要同步到 GitHub，需要另外執行 `git add`、`git commit`、`git push`；本機修改不會自動推送。

詳細同步與打包檢查見 `docs/sync-and-portability.md`。
