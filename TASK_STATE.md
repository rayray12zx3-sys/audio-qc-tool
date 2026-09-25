# TASK_STATE

這是本專案跨對話的持續狀態檔。新對話應先讀本檔，再以目前檔案與 Git 狀態核對；若兩者不一致，以實際狀態為準並修正本檔。

最後更新：2026-09-24（新增 Firefox / WebKit 桌面跨瀏覽器 smoke coverage）

## 目前目標

- 維持瀏覽器端、可部署至 GitHub Pages 的 PR / AU 新手調音建議工具。
- 正式支援環境改為 PC／桌面瀏覽器；手機僅維持基本可開啟，不列入必要驗收。
- 音訊判斷維持 `estimated`、`heuristic`、`suggested`、`starting point` 定位，不宣稱為標準級 QC 或取代人工聆聽。
- 補齊 Firefox / WebKit 低風險桌面 smoke coverage，同時維持既有 Chromium 完整 E2E 與 DSP／report 驗證。

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
- 建立 Firefox / WebKit 輕量桌面 smoke coverage（`tests/desktop-smoke.spec.mjs`），重點驗證不依賴真實 codec 差異的核心靜態與 preview 行為。
- 尚未完成人工聆聽，因此 Noise、Dynamics、EQ、DeEsser、Stereo Width 與 Ducking 的主觀門檻未調整；Worker／取消與 Final Mix QC 也未納入本批。

## 本批變更範圍

| 檔案 | 用途 |
| --- | --- |
| `tests/desktop-smoke.spec.mjs` | Firefox / WebKit 輕量桌面 smoke 自動測試（靜態頁面、控制項、preview 狀態、版面無溢位、classic static assets） |
| `playwright.config.mjs` | 配置 `chromium`（完整 E2E）與 `firefox-smoke` / `webkit-smoke`（跨瀏覽器 smoke）專案 |
| `package.json` | 更新 `"test:e2e"` 專持 Chromium；新增 `"test:smoke:browsers"` 執行跨瀏覽器 smoke 測試 |
| `.github/workflows/verify.yml` | CI 安裝 `chromium firefox webkit` 依賴並執行 `test:e2e` 與 `test:smoke:browsers` |
| `README.md`、`TASK_STATE.md`、`docs/worklog.md` | 說明跨瀏覽器 smoke coverage 指令、驗證範圍與交接紀錄 |

正式基準分支：`main`。Repository 已公開；GitHub Pages source 為 `main`／`(root)`，公開網址為 `https://rayray12zx3-sys.github.io/audio-qc-tool/`。

## 驗證狀態

- `node --check audio-analysis.js`、`node --check app.js` 通過。
- `npm run test:report`（report self-test）通過。
- `npm run test:dsp`（DSP self-test）通過。
- `npm run test:e2e`（Chromium Playwright E2E 4 項測試）通過，涵蓋 empty/loading/preview/copy/keyboard、合成 WAV upload 替換與大檔拒絕、accessibility/安全驗證及 `file://` classic assets 載入。
- `npm run test:smoke:browsers`（Firefox-smoke 2 項、WebKit-smoke 2 項，共 4 項測試）通過，涵蓋首頁載入、版本 badge、控制項可見度、`?preview=loading`、`?preview=both` 兩軌 preview、`1024x768` / `1440x900` 無溢位、零 console/page error 及 `file://` classic assets 載入。
- `.github/workflows/verify.yml` 已配置 `npx playwright install --with-deps chromium firefox webkit` 及雙層測試執行。
- `git diff --check` 通過。

## 下一步

1. 由使用者對真實樣本完成人工聆聽，標記工具建議的 matched、missed、overreacted，再決定是否調整主觀門檻。
2. 若要處理長檔或完整成品 QC，再另案評估 Worker、分批處理／取消及 Final Mix QC；不要與本批客觀修正綁在一起。

## 風險與限制

- 被較新選取取代的分析只會停止渲染，不會中止已開始的 decode/analysis，仍可能消耗 CPU 與記憶體。
- 瀏覽器端量測仍是近似分析；Estimated True Peak 仍採 4x Catmull-Rom 插值，數值與規則不能取代專業 meter 或實際聆聽。
- `index.html` 必須和 `styles.css`、`audio-analysis.js`、`app.js` 一起複製或部署；缺少任一檔案都會使頁面失效。
- 部分格式或瀏覽器可能無法快速提供 metadata；此批選擇安全拒絕而非解碼原始大檔，使用者需改輸出代表片段。
- mono downmix 對反相或複雜多聲道素材可能抵消頻段與噪音能量；目前會抑制相關建議，但尚未提供逐聲道頻譜，>2 聲道仍只有 caveat。
- 自動化 Firefox / WebKit 目前僅涵蓋輕量桌面 smoke coverage（不依賴真實音訊解碼 codec）；完整合成 WAV 上傳與解碼流程仍由 Chromium E2E 驗證。不同瀏覽器間真實 codec 支援與 Web Audio 解碼細節仍可能存在差異。
- 手機不再是正式支援環境，未執行本批手機版 smoke check。
- `真實音檔/` 及私人來源檔不可提交或上傳。

## 維護方式

- 本檔只保留「現在仍有效」的目標、結論、修改範圍、驗證、下一步與風險；完成或失效的細節移至 `docs/worklog.md` 或刪除。
- 每次更新 `最後更新`，並同步修正本批變更範圍與分支；不要只在檔尾持續追加紀錄。
- 不確定的資訊標成「待確認」，不要把推測寫成已完成事項。
