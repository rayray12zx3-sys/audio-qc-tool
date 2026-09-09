# 音檔調音工具

瀏覽器端音檔匯入、分析與建議報告工具，目標是給 PR / AU 新手取得可操作的調音起點。輸出內容是瀏覽器端近似分析與建議，不是專業 loudness meter 或標準級 QC 報告。

本工具以 PC／桌面瀏覽器為正式支援環境，方便直接選取電腦內的音檔。手機僅維持基本可開啟，不保證完整操作體驗。

為避免大型原始檔在瀏覽器解碼時耗盡記憶體，匯入前會檢查檔案大小與 metadata 時長：上限為 128 MiB、五分鐘，且五秒內無法確認時長會安全拒絕。請在 PR／AU 匯出不超過五分鐘的代表片段；工具不會強制繼續或在瀏覽器裁切原始檔。

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
npm run test:dsp
npm run test:e2e
```

- `smoke:manual`：列出 preview smoke check URL；不會自動開瀏覽器。
- `test:report`：在 Node 環境執行既有 report self-test。
- `test:dsp`：驗證 mono、stereo、多聲道與極短音訊的安全量測行為。
- `test:e2e`：以 Chromium-based Playwright 瀏覽器覆蓋 empty、loading、preview、報告複製及 console 基本回歸；這是目前自動驗收的瀏覽器範圍。

首次執行 E2E 時需安裝 Chromium：

```powershell
npx playwright install chromium
```

## 多聲道量測說明

- Sample Peak、Estimated True Peak 與 DC Offset 以各聲道最壞值計算；接近滿刻度以 sample frame 計數，同一 frame 多個聲道超標只算一次。
- Estimated Integrated Loudness 會先對每個聲道各自套用 K-weighting，再以等權方式合計區塊能量；相同 stereo 訊號相對 mono 約增加 3.01 dB。
- 頻譜、ZCR、noise 與波形為 mono downmix 衍生指標；若左右聲道負相關，畫面與複製報告會標記這些指標的信心降低。超過雙聲道時也會顯示等權合計與 mono 衍生指標的注意事項。

沒有 Node/npm 時，可用：

```powershell
.\scripts\preview-smoke-urls.ps1
```

詳細 UI 檢查步驟見 `docs/preview-smoke-check.md`。

## 靜態檔案結構

- `index.html`：頁面結構與靜態資產載入順序。
- `styles.css`：畫面樣式與桌面／窄螢幕基本版面。
- `audio-analysis.js`：純瀏覽器 DSP，透過 `window.AudioAnalysis` 提供量測 API。
- `app.js`：匯入、報告、畫面狀態與互動流程。

所有 script 均為 classic script，不需要 bundler；可直接開啟 `index.html`，也可部署至 GitHub Pages。

真實音檔抽查流程見 `docs/audio-spot-check.md`。

迭代紀錄見 `docs/worklog.md`。

## 版本規則

- 網頁標題與複製報告會顯示相同的工具版本與更新日期。
- 版本採 Semantic Versioning：功能更新遞增 minor，修正遞增 patch。
- 開發分支上的版本屬候選內容；只有合併至 `main` 後才算正式發布。

## 部署與攜帶

- 目前專案維持靜態網站形式，可部署到 GitHub Pages。
- 換電腦使用時，帶走整個資料夾即可保留工具本體、文件與 repo-local Codex skills。
- 若要同步到 GitHub，需要另外執行 `git add`、`git commit`、`git push`；本機修改不會自動推送。

詳細同步與打包檢查見 `docs/sync-and-portability.md`。
