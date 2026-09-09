# TASK_STATE

這是本專案跨對話的持續狀態檔。新對話應先讀本檔，再以目前檔案與 Git 狀態核對；若兩者不一致，以實際狀態為準並修正本檔。

最後更新：2026-09-09（v0.3.2 已推送，Pages 因 private repository 停用）

## 目前目標

- 維持瀏覽器端、可部署至 GitHub Pages 的 PR / AU 新手調音建議工具。
- 正式支援環境改為 PC／桌面瀏覽器；手機僅維持基本可開啟，不列入必要驗收。
- `main`／`origin/main` 目前基準為 commit `a1be238`（`v0.3.2`）；本機工作目錄已收斂。
- 音訊判斷維持 `estimated`、`heuristic`、`suggested`、`starting point` 定位，不宣稱為標準級 QC 或取代人工聆聽。
- 公開 repo 已補強 secrets／local configuration ignore 規則與憑證／個資提交規範；repository-local Git author 改用 GitHub noreply email。

## 已確認現況

- DSP 邊界已補正：短於 400 ms 的 loudness 與完整 block 公式連續、True Peak 插值涵蓋首尾區間、STFT 納入最後一個完整 frame、零長度輸入維持有限值。
- `P_Sib` 改用 Hann window 實際 coherent gain 正規化；對應 air gate 由 `-15` 移至 `-9 dBFS` 僅補償同一個約 `+6.02 dB` 尺度差，不是聆聽調參。
- 立體聲寬度改為 `(1 - correlation) / 2`，同相為 0、反相為 1；負相關時停用依賴 mono downmix 的 Noise、EQ、ZCR、LRA、BGM masking 與 Stereo Expander 建議，並明示低信心與相位風險。
- `crest` 在 UI／報告改稱 `Peak-to-Loudness difference (PLR-like)`，noise 指標改稱 `Estimated noise-floor proxy`；True Peak、Limiter、Clip Gain 與 masking 文案不再暗示保證或跨軌實測。
- BGM 混音改為先以 `BGM Gain` 對齊無對白目標，再只套用一次 Duck Amount；畫面與報告分開顯示 LUFS 目標與 dB 增益，不再把相同衰減重複計算。
- 自訂目標接受合法的 `0`，空值、非有限值與超界值會顯示錯誤並設定 `aria-invalid`；select／number input、結果 region 與 loading／完成狀態已補 accessibility 關聯。
- 效果鏈可作用節點改為真正的 `<button>`，檔名進入 `innerHTML` 前會 escape，長檔名可換行且不會擠壓「重新選擇」按鈕；文字對比亦已提高。
- 頁首 badge、package metadata、複製報告與 E2E 期望值已同步為 `v0.3.2 · 更新 2026-08-19`。
- 原有每軌 run token、共用 loading count、128 MiB／300 秒 metadata preflight、classic script 靜態架構與 `file://` 相容性均保留。
- 尚未完成人工聆聽，因此 Noise、Dynamics、EQ、DeEsser、Stereo Width 與 Ducking 的主觀門檻未調整；Worker／取消與 Final Mix QC 也未納入本批。

## 本批變更範圍

| 檔案 | 用途 |
| --- | --- |
| `audio-analysis.js`、`tests/dsp-self-test.mjs` | DSP 邊界、正規化、反相寬度與 deterministic regression |
| `app.js`、`scripts/report-self-test.mjs` | 建議邏輯、單位／文案、負相關保護、Ducking 與整合回歸 |
| `index.html`、`styles.css`、`tests/app.spec.mjs` | accessibility、安全輸出、桌面版面與 Chromium E2E |
| `package.json`、`package-lock.json`、`README.md`、`docs/` | `0.3.2` 版本、可攜性說明與交接 |

正式基準分支：`main`；`v0.3.2` release commit `a1be238` 已推送至 `origin/main`。Repository 目前為 private，GitHub Pages 因帳號方案限制未啟用，正式站回傳 404。

## 驗證狀態

- 2026-09-09 `node --check audio-analysis.js`、`node --check app.js`、report self-test、DSP self-test 與 `git diff --check` 通過。
- DSP self-test 涵蓋同相／反相寬度、零長度有限值、399.98 ms／400 ms loudness 連續、Hann 正規化與最後完整 STFT frame。
- report self-test 涵蓋負相關建議抑制、BGM base gain 與 Duck Amount 只套用一次、LUFS／dB 單位、檔名 escape、自訂 `0`／無效值及 stale run 競態。
- localhost in-app browser 於 `1440x900`、`1024x768` 複核 empty、loading、voice、bgm、both、error-voice、error-bgm、large-file、自訂錯誤、結果卡與 Ducking 區；皆無水平溢位或 console error/warn。
- Playwright Chromium E2E 重新驗證 4 項通過（2.6 秒）：兩種桌面尺寸與 preview states、合成 WAV upload／換檔／大檔拒絕、accessibility／自訂驗證／長惡意檔名，以及 `file://` classic assets；GitHub Actions `Verify #10` 對 commit `a1be238` 完成且成功。
- 正式 GitHub Pages 已驗證為 404；GitHub Pages 設定顯示必須升級方案或將 repository 改為 public 才能啟用。
- 本批未執行真實音檔聆聽或非 Chromium 瀏覽器驗證。

## 下一步

1. 由使用者決定是否將 repository 改回 public 以恢復免費 GitHub Pages；舊 Git history 個資仍存在，公開前應先確認可接受性或另案重寫歷史。
2. 由使用者對真實樣本完成人工聆聽，標記工具建議的 matched、missed、overreacted，再決定是否調整主觀門檻。
3. 若要處理長檔或完整成品 QC，再另案評估 Worker、分批處理／取消及 Final Mix QC；不要與本批客觀修正綁在一起。

## 風險與限制

- 被較新選取取代的分析只會停止渲染，不會中止已開始的 decode/analysis，仍可能消耗 CPU 與記憶體。
- 瀏覽器端量測仍是近似分析；Estimated True Peak 仍採 4x Catmull-Rom 插值，數值與規則不能取代專業 meter 或實際聆聽。
- `index.html` 必須和 `styles.css`、`audio-analysis.js`、`app.js` 一起複製或部署；缺少任一檔案都會使頁面失效。
- 部分格式或瀏覽器可能無法快速提供 metadata；此批選擇安全拒絕而非解碼原始大檔，使用者需改輸出代表片段。
- mono downmix 對反相或複雜多聲道素材可能抵消頻段與噪音能量；目前會抑制相關建議，但尚未提供逐聲道頻譜，>2 聲道仍只有 caveat。
- 自動化 E2E 只驗證 Chromium；其他桌面瀏覽器與 codec 支援仍可能不同。
- `v0.3.2` 已通過 CI 並推送，但 repository 為 private，免費帳號無法啟用該 repository 的 GitHub Pages；正式站目前不可用。
- 手機不再是正式支援環境，未執行本批手機版 smoke check。
- `真實音檔/` 及私人來源檔不可提交或上傳。
- 目前 tracked files 未發現明顯 API Key、token 或 password；舊 Git history 仍含私人／公司 email 與姓名／部門資訊，待另案確認後處理，未進行 history rewrite 或 force push。

## 維護方式

- 本檔只保留「現在仍有效」的目標、結論、修改範圍、驗證、下一步與風險；完成或失效的細節移至 `docs/worklog.md` 或刪除。
- 每次更新 `最後更新`，並同步修正本批變更範圍與分支；不要只在檔尾持續追加紀錄。
- 不確定的資訊標成「待確認」，不要把推測寫成已完成事項。
