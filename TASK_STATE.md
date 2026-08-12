# TASK_STATE

這是本專案跨對話的持續狀態檔。新對話應先讀本檔，再以目前檔案與 Git 狀態核對；若兩者不一致，以實際狀態為準並修正本檔。

最後更新：2026-08-13（v0.3.1 靜態檔案拆分）

## 目前目標

- 維持瀏覽器端、可部署至 GitHub Pages 的 PR / AU 新手調音建議工具。
- 正式支援環境改為 PC／桌面瀏覽器；手機僅維持基本可開啟，不列入必要驗收。
- `main` 已發布 `v0.3.1`；正式 GitHub Pages 使用行為不變的外部靜態檔案結構。
- 音訊判斷維持 `estimated`、`heuristic`、`suggested`、`starting point` 定位，不宣稱為標準級 QC 或取代人工聆聽。

## 已確認現況

- 分析流程已加入每軌 run token，只允許同一軌最新選取的分析更新結果或錯誤。
- loading overlay 以共用 active-analysis count 管理，可涵蓋人聲與 BGM 同時分析。
- report self-test 已擴充 stale token、平行 loading、近滿刻度警示、換檔清理與剪貼簿失敗回饋案例。
- self-test 會實際驅動新舊 `handleFile()` 成功與失敗競態，確認舊結果或舊錯誤不會覆蓋新狀態。
- 複製按鈕固定保存初始 SVG 與文字，快速連點只重設回饋 timer，結束後會恢復正常狀態。
- 頁首 badge 顯示 `v0.3.1 · 更新 2026-08-13`，`package.json`、report metadata 與複製報告使用相同版本資料。
- 原本集中在 `index.html` 的樣式、DSP 與應用程式邏輯已拆為 `styles.css`、`audio-analysis.js`、`app.js`；使用 classic script 與 `window.AudioAnalysis`，不需要 bundler，保留直接開啟及 GitHub Pages 相容性。
- 音檔在 `arrayBuffer()` 前先以 object URL 檢查 metadata；128 MiB、300 秒與 5 秒 timeout 任一不通過便拒絕，且所有 success/reject/timeout/exception 路徑都 revoke URL。拒絕時不 decode，提示在 PR/AU 匯出五分鐘內代表片段。
- 產品定位統一為桌面端「匯入、分析、產生建議報告」；不承諾播放、調整、預覽或匯出。
- Sample Peak、Estimated True Peak 與 DC Offset 不再由 mono downmix 取得；前兩者採逐聲道最大值，DC Offset 保留絕對值最大的聲道正負號，near-peak 依 sample frame 去重。
- Estimated Integrated Loudness 對每個聲道分別 K-weighting，逐 block 等權加總；>2 聲道顯示 channel caveat。頻譜、ZCR、noise 與波形仍僅使用 mono downmix；負相關立體聲會降低這些衍生指標的信心。
- UI smoke check、專案規範與驗證文件已改為桌面必測；窄螢幕只在需求明確指定時驗證。
- 兩個本機人聲 WAV 的工具輸出已記錄於 `docs/audio-spot-check-results.md`；來源音檔屬私人資料，不得加入 Git。
- 尚未完成人工聆聽，因此目前沒有證據支持調整 noise、dynamics、EQ 或 DeEsser 門檻。

## 本批變更範圍

| 檔案 | 用途 |
| --- | --- |
| `index.html`、`styles.css` | 頁面結構、資產載入順序與原樣搬出的樣式 |
| `audio-analysis.js`、`app.js` | `window.AudioAnalysis` DSP namespace 與其餘報告／UI 流程 |
| `scripts/report-self-test.mjs`、`tests/` | 外部 classic script、整合量測與 `file://` 直接開啟回歸 |
| `package.json`、`package-lock.json`、`README.md`、`docs/` | `0.3.1` 版本、結構說明與交接 |

正式基準分支：`main`；`v0.3.1` 已由 PR #7 squash merge，合併 commit 為 `9b83fe3`。

## 驗證狀態

- 2026-08-13 `node --check` 通過兩個 classic scripts；`npm run test:report`、`npm run test:dsp` 與 `git diff --check` 通過。report test 保留 True Peak 限制 Clip Gain 的跨檔整合斷言。
- Playwright Chromium E2E 三項通過：桌面狀態／鍵盤、合成 WAV upload／拒絕流程，以及 `file://` 直接開啟與 `window.AudioAnalysis` namespace。
- localhost in-app browser 於 `1440x900`、`1024x768` 複核 external CSS/scripts、empty、both、error、loading、large-file 與水平溢位；console 無 error/warn。
- GitHub Actions `Verify` 已在 PR #7 通過；正式 GitHub Pages 已顯示 `v0.3.1`，並正確載入 `styles.css`、`audio-analysis.js`、`app.js`，console 無訊息。

## 下一步

1. 由使用者對真實樣本完成人工聆聽，標記工具建議的 matched、missed、overreacted，再決定是否調整門檻。
2. 只有在未來確定要完整分析長檔時，再另案評估 PCM WAV parser、Worker、分批處理與取消機制。

## 風險與限制

- 被較新選取取代的分析只會停止渲染，不會中止已開始的 decode/analysis，仍可能消耗 CPU 與記憶體。
- 瀏覽器端量測仍是近似分析；數值與規則不能取代實際聆聽驗證。
- `v0.3.1` 的三個相對路徑資產必須與 `index.html` 一起複製或部署；缺少任一檔案都會使正式頁面失效。
- 部分格式或瀏覽器可能無法快速提供 metadata；此批選擇安全拒絕而非解碼原始大檔，使用者需改輸出代表片段。
- mono downmix 對反相或複雜多聲道素材可能抵消頻段與噪音能量；工具已標示低信心，但不能取代逐聲道頻譜與專業 meter 複核。
- 手機不再是正式支援環境，未執行本批手機版 smoke check。
- `真實音檔/` 及私人來源檔不可提交或上傳。

## 維護方式

- 本檔只保留「現在仍有效」的目標、結論、修改範圍、驗證、下一步與風險；完成或失效的細節移至 `docs/worklog.md` 或刪除。
- 每次更新 `最後更新`，並同步修正本批變更範圍與分支；不要只在檔尾持續追加紀錄。
- 不確定的資訊標成「待確認」，不要把推測寫成已完成事項。
