# TASK_STATE

這是本專案跨對話的持續狀態檔。新對話應先讀本檔，再以目前檔案與 Git 狀態核對；若兩者不一致，以實際狀態為準並修正本檔。

最後更新：2026-08-05（互動競態回歸測試與 UI smoke check）

## 目前目標

- 維持瀏覽器端、可部署至 GitHub Pages 的 PR / AU 新手調音建議工具。
- `agent/analysis-state-hardening` 分支已完成本機 commit，包含分析並行狀態、互動回饋、report self-test 與真實音檔抽查文件，並以 draft PR 發布至 `main` 供檢視。
- 音訊判斷維持 `estimated`、`heuristic`、`suggested`、`starting point` 定位，不宣稱為標準級 QC 或取代人工聆聽。

## 已確認現況

- 分析流程已加入每軌 run token，只允許同一軌最新選取的分析更新結果或錯誤。
- loading overlay 以共用 active-analysis count 管理，可涵蓋人聲與 BGM 同時分析。
- report self-test 已擴充 stale token、平行 loading、近滿刻度警示、換檔清理與剪貼簿失敗回饋案例。
- self-test 會實際驅動新舊 `handleFile()` 成功與失敗競態，確認舊結果或舊錯誤不會覆蓋新狀態。
- 複製按鈕固定保存初始 SVG 與文字，快速連點只重設回饋 timer，結束後會恢復正常狀態。
- 兩個本機人聲 WAV 的工具輸出已記錄於 `docs/audio-spot-check-results.md`；來源音檔屬私人資料，不得加入 Git。
- 尚未完成人工聆聽，因此目前沒有證據支持調整 noise、dynamics、EQ 或 DeEsser 門檻。

## 本批變更範圍

| 檔案 | 用途 |
| --- | --- |
| `index.html` | 分析狀態、近滿刻度用語、換檔清理與複製提示行為 |
| `scripts/report-self-test.mjs` | 互動、平行 loading 與 async stale-run 回歸測試 |
| `docs/worklog.md` | 迭代與驗證紀錄 |
| `docs/audio-spot-check-results.md` | 不含來源音檔的抽查結果 |
| `TASK_STATE.md` | 跨對話目前狀態 |
| `AGENTS.md` | 要求持續維護本狀態檔 |

目前分支：`agent/analysis-state-hardening`，目標分支為 `main`；實際 commit 與 PR 狀態以 Git 為準。

## 驗證狀態

- 2026-08-05 已重新執行 `git diff --check` 與 report self-test；結果通過，包含 `interaction: "passed"`。
- localhost 桌機與 `390x844` 已檢查 empty、voice、BGM、both、error 與 loading 狀態，未見頁面水平溢位。
- 實際瀏覽器已檢查複製快速連點、較小私人 WAV 成功分析、無效檔案替換清理與 console error；結果通過，私人檔案未提交或上傳外部。
- 本次 browser file chooser 無法在前一檔分析結束前送入第二檔；平行 loading 由自動測試與 2026-08-04 已記錄的實際重疊檢查共同覆蓋。

## 下一步

1. 檢視並合併 `agent/analysis-state-hardening` 的 draft PR；不得 stage 私人音檔。
2. 由使用者對真實樣本完成人工聆聽，標記工具建議的 matched、missed、overreacted，再決定是否調整門檻。
3. 若要處理大型音檔，先設計 excerpt 或 chunk processing、進度與取消機制，不直接嘗試整個 1.46 GB WAV。

## 風險與限制

- 被較新選取取代的分析只會停止渲染，不會中止已開始的 decode/analysis，仍可能消耗 CPU 與記憶體。
- 瀏覽器端量測仍是近似分析；數值與規則不能取代實際聆聽驗證。
- `真實音檔/` 及私人來源檔不可提交或上傳。

## 維護方式

- 本檔只保留「現在仍有效」的目標、結論、修改範圍、驗證、下一步與風險；完成或失效的細節移至 `docs/worklog.md` 或刪除。
- 每次更新 `最後更新`，並同步修正本批變更範圍與分支；不要只在檔尾持續追加紀錄。
- 不確定的資訊標成「待確認」，不要把推測寫成已完成事項。
