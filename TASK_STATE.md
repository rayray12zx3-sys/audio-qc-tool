# TASK_STATE

這是本專案跨對話的持續狀態檔。新對話應先讀本檔，再以目前檔案與 Git 狀態核對；若兩者不一致，以實際狀態為準並修正本檔。

最後更新：2026-08-13（v0.2.1 多聲道安全量測）

## 目前目標

- 維持瀏覽器端、可部署至 GitHub Pages 的 PR / AU 新手調音建議工具。
- 正式支援環境改為 PC／桌面瀏覽器；手機僅維持基本可開啟，不列入必要驗收。
- `agent/multichannel-meter-safety` 分支包含 `v0.2.1` 多聲道安全量測與 CI 候選內容。
- 音訊判斷維持 `estimated`、`heuristic`、`suggested`、`starting point` 定位，不宣稱為標準級 QC 或取代人工聆聽。

## 已確認現況

- 分析流程已加入每軌 run token，只允許同一軌最新選取的分析更新結果或錯誤。
- loading overlay 以共用 active-analysis count 管理，可涵蓋人聲與 BGM 同時分析。
- report self-test 已擴充 stale token、平行 loading、近滿刻度警示、換檔清理與剪貼簿失敗回饋案例。
- self-test 會實際驅動新舊 `handleFile()` 成功與失敗競態，確認舊結果或舊錯誤不會覆蓋新狀態。
- 複製按鈕固定保存初始 SVG 與文字，快速連點只重設回饋 timer，結束後會恢復正常狀態。
- 頁首 badge 顯示 `v0.2.1 · 更新 2026-08-13`，`package.json`、report metadata 與複製報告使用相同版本資料。
- Sample Peak、Estimated True Peak 與 DC Offset 不再由 mono downmix 取得；前兩者採逐聲道最大值，DC Offset 保留絕對值最大的聲道正負號，near-peak 依 sample frame 去重。
- Estimated Integrated Loudness 對每個聲道分別 K-weighting，逐 block 等權加總；>2 聲道顯示 channel caveat。頻譜、ZCR、noise 與波形仍僅使用 mono downmix；負相關立體聲會降低這些衍生指標的信心。
- UI smoke check、專案規範與驗證文件已改為桌面必測；窄螢幕只在需求明確指定時驗證。
- 兩個本機人聲 WAV 的工具輸出已記錄於 `docs/audio-spot-check-results.md`；來源音檔屬私人資料，不得加入 Git。
- 尚未完成人工聆聽，因此目前沒有證據支持調整 noise、dynamics、EQ 或 DeEsser 門檻。

## 本批變更範圍

| 檔案 | 用途 |
| --- | --- |
| `index.html` | 多聲道安全量測、版本 badge、report metadata 與 mono-derived 警示 |
| `package.json`、`package-lock.json` | 版本同步與唯一新增的 Playwright devDependency |
| `tests/`、`playwright.config.mjs` | DSP fixtures 與 Chromium E2E |
| `.github/workflows/verify.yml` | PR / main report、DSP、Chromium E2E CI |
| `README.md`、`docs/worklog.md`、`TASK_STATE.md` | 使用、驗證與狀態交接 |

目前分支：`agent/multichannel-meter-safety`，目標分支為 `main`；實際 commit 與 PR 狀態以 Git 為準。

## 驗證狀態

- 2026-08-13 `npm run test:report` 通過，包含版本、競態、loading、複製與多聲道／負相關報告提示回歸。
- `npm run test:dsp` 通過 8 組合成 fixture：mono、identical stereo、left-hot、anti-phase、short、zero、near-peak frame 與 true-peak gain safety。
- Playwright Chromium E2E 通過，涵蓋 empty、loading、both preview、copy、console，以及 `1440x900`、`1024x768` 無水平溢位。
- localhost 以 in-app browser 複核相同桌面狀態，版本可見且 console 無 error/warn；`git diff --check` 通過。
- GitHub Actions CI 需在分支推送後確認；目前尚未取得遠端結果。

## 下一步

1. 提交並推送 v0.2.1，建立 PR，確認 GitHub Actions 後合併。
2. 實作 v0.3.0 大型檔案 excerpt preflight、桌面 UX／無障礙與產品定位修正。
3. 由使用者對真實樣本完成人工聆聽，標記工具建議的 matched、missed、overreacted，再決定是否調整門檻。

## 風險與限制

- 被較新選取取代的分析只會停止渲染，不會中止已開始的 decode/analysis，仍可能消耗 CPU 與記憶體。
- 瀏覽器端量測仍是近似分析；數值與規則不能取代實際聆聽驗證。
- `v0.2.1` 在合併前仍是候選內容，正式站目前尚未更新。
- mono downmix 對反相或複雜多聲道素材可能抵消頻段與噪音能量；工具已標示低信心，但不能取代逐聲道頻譜與專業 meter 複核。
- 手機不再是正式支援環境，未執行本批手機版 smoke check。
- `真實音檔/` 及私人來源檔不可提交或上傳。

## 維護方式

- 本檔只保留「現在仍有效」的目標、結論、修改範圍、驗證、下一步與風險；完成或失效的細節移至 `docs/worklog.md` 或刪除。
- 每次更新 `最後更新`，並同步修正本批變更範圍與分支；不要只在檔尾持續追加紀錄。
- 不確定的資訊標成「待確認」，不要把推測寫成已完成事項。
