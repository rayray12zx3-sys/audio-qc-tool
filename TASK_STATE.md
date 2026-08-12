# TASK_STATE

這是本專案跨對話的持續狀態檔。新對話應先讀本檔，再以目前檔案與 Git 狀態核對；若兩者不一致，以實際狀態為準並修正本檔。

最後更新：2026-08-12（v0.2.0 版本標示與桌面優先驗證）

## 目前目標

- 維持瀏覽器端、可部署至 GitHub Pages 的 PR / AU 新手調音建議工具。
- 正式支援環境改為 PC／桌面瀏覽器；手機僅維持基本可開啟，不列入必要驗收。
- `agent/analysis-state-hardening` 分支對應 draft PR #4，包含分析並行狀態、互動回饋、`v0.2.0` 版本標示與桌面優先規範。
- 音訊判斷維持 `estimated`、`heuristic`、`suggested`、`starting point` 定位，不宣稱為標準級 QC 或取代人工聆聽。

## 已確認現況

- 分析流程已加入每軌 run token，只允許同一軌最新選取的分析更新結果或錯誤。
- loading overlay 以共用 active-analysis count 管理，可涵蓋人聲與 BGM 同時分析。
- report self-test 已擴充 stale token、平行 loading、近滿刻度警示、換檔清理與剪貼簿失敗回饋案例。
- self-test 會實際驅動新舊 `handleFile()` 成功與失敗競態，確認舊結果或舊錯誤不會覆蓋新狀態。
- 複製按鈕固定保存初始 SVG 與文字，快速連點只重設回饋 timer，結束後會恢復正常狀態。
- 網頁標題顯示 `v0.2.0 · 更新 2026-08-12`，`package.json`、report metadata 與複製報告使用相同版本資料。
- UI smoke check、專案規範與驗證文件已改為桌面必測；窄螢幕只在需求明確指定時驗證。
- 兩個本機人聲 WAV 的工具輸出已記錄於 `docs/audio-spot-check-results.md`；來源音檔屬私人資料，不得加入 Git。
- 尚未完成人工聆聽，因此目前沒有證據支持調整 noise、dynamics、EQ 或 DeEsser 門檻。

## 本批變更範圍

| 檔案 | 用途 |
| --- | --- |
| `index.html` | 分析狀態、版本 badge、report metadata 與複製提示行為 |
| `package.json` | 專案版本同步為 `0.2.0` |
| `scripts/report-self-test.mjs` | 互動、async stale-run 與版本一致性回歸測試 |
| `README.md`、`AGENTS.md` | 發布規則與 PC／桌面優先定位 |
| `.codex/skills/ui-smoke-check/`、`docs/` | 桌面優先驗證流程與迭代紀錄 |
| `docs/worklog.md` | 迭代與驗證紀錄 |
| `docs/audio-spot-check-results.md` | 不含來源音檔的抽查結果 |
| `TASK_STATE.md` | 跨對話目前狀態 |

目前分支：`agent/analysis-state-hardening`，目標分支為 `main`；實際 commit 與 PR 狀態以 Git 為準。

## 驗證狀態

- 2026-08-12 report self-test 通過，結果包含 `{ "ok": true, "failures": [], "interaction": "passed" }`，並覆蓋版本一致性與複製報告版本列。
- `git diff --check` 與 PowerShell 靜態版本檢查通過。
- localhost 已在 `1440x900` 與約 `1024x768` 檢查 empty、voice、BGM、both、error、loading 與複製按鈕回饋；版本可見、無水平溢位，console 無 error/warn。
- `skill-creator` 的 `quick_validate.py` 因主機 Python 缺少 `PyYAML` 無法執行；已直接核對 skill frontmatter 與 `agents/openai.yaml`，但不宣稱官方 validator 通過。

## 下一步

1. 檢視並合併 draft PR #4，讓 `v0.2.0` 成為 GitHub Pages 正式版本。
2. 由使用者對真實樣本完成人工聆聽，標記工具建議的 matched、missed、overreacted，再決定是否調整門檻。
3. 若要處理大型音檔，先設計 excerpt 或 chunk processing、進度與取消機制，不直接嘗試整個 1.46 GB WAV。

## 風險與限制

- 被較新選取取代的分析只會停止渲染，不會中止已開始的 decode/analysis，仍可能消耗 CPU 與記憶體。
- 瀏覽器端量測仍是近似分析；數值與規則不能取代實際聆聽驗證。
- `v0.2.0` 在 PR #4 合併前仍是候選內容，正式站目前尚未更新。
- 手機不再是正式支援環境，未執行本批手機版 smoke check。
- `真實音檔/` 及私人來源檔不可提交或上傳。

## 維護方式

- 本檔只保留「現在仍有效」的目標、結論、修改範圍、驗證、下一步與風險；完成或失效的細節移至 `docs/worklog.md` 或刪除。
- 每次更新 `最後更新`，並同步修正本批變更範圍與分支；不要只在檔尾持續追加紀錄。
- 不確定的資訊標成「待確認」，不要把推測寫成已完成事項。
