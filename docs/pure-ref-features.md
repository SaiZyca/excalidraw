# Pure-Ref 分支功能說明文件 (Pure-Ref Branch Documentation)

本分支（`pure-ref`）旨在為 Excalidraw 導入類似 **PureRef** 的靈感收集與畫布圖片管理工作流，針對大量參考素材（圖片、筆記、卡片等）提供自動化排版、尺寸比例控制與獨立離線桌面應用支援。

---

## 一、核心功能總覽

### 1. Frame 自動排版佈局系統 (Auto-layout Frames)
結合 Excalidraw 原生 Frame（框架）容器機制，提供四種自適應排列演算法：
- **水平排列 (Row / Distribute Horizontal)**：內部物件自動橫向排列，支援水平/垂直對齊與自適應換行。
- **垂直排列 (Column / Distribute Vertical)**：內部物件自動縱向排列。
- **瀑布流 (Masonry)**：
  - 根據內部物件平均寬度（`avgWidth`）自適應最佳欄數與欄寬。
  - 避免少量物件在寬框架內被異常拉伸變形。
  - 各欄高度自動平衡累積，適合不同長寬比之圖片展示。
- **緊湊拼貼 (Packery 2D Bin Packing)**：
  - 二維空間裝箱排版，最大化利用 Frame 空間。
  - 支援設定預設排序（面積由大至小等）。
- **Frame 與 Group 互轉**：
  - 一鍵將 Frame 轉換為 Group（保留排版成果並群組化）。
  - 一鍵將選取物件或現有 Group 轉換解散並打包入 Auto-layout Frame。

### 2. 精準控制與排序機制
- **獨立 Gap & Padding 控制**：
  - 每個 Frame 擁有個別獨立的 `layoutGap`（物件間距）與 `layoutPadding`（內邊距），調整即時更新。
- **多種排序依據 (Deterministic Sorting)**：
  - 保持圖層順序 (Natural)
  - 面積大小 (由大到小 / 由小到大)
  - 物件寬度 / 高度
  - 檔名或標籤文字 (A-Z)
  - 依目前視覺位置固定排序 (Freeze Order)
- **六向對齊支援**：
  - 水平對齊：靠左、置中、靠右。
  - 垂直對齊：靠上、置中、靠下。
- **外框貼齊 (Fit Frame to Content)**：
  - 一鍵調整 Frame 尺寸緊密貼齊內部所有物件之邊界。

### 3. 素材尺寸與比例管理工具
在 Frame 工具列、單一圖片工具列及右鍵上下文選單提供：
- **圖片 1:1 正方形裁切 (`1:1`)**：以最小邊進行中心正方形裁切。
- **統一寬度 / 統一高度 (`↔` / `↕`)**：選取物件或 Frame 內所有物件一鍵等寬或等高。
- **還原圖片裁切 (`↺`)**：解除圖片自訂裁切區域。
- **還原非等比縮放 (`⚖`)**：修正拉伸變形，還原圖片原始寬高比。
- **還原圖片原始大小 (`100%`)**：依據原始影像解析度（`naturalWidth` / `naturalHeight`）1:1 還原原始像素尺寸。

### 4. 畫布互動與選取體驗優化
- **防止點擊 / 拖曳誤觸重排**：
  - 單純點選 Frame 邊框選取或平移 Frame 時，絕不觸發內部子物件重設或重排。
  - 僅在主動調整邊界尺寸（Resize）或拖動 Frame 內子物件交換位置時才執行重排。
- **全選等比縮放保護**：
  - 當同時選取 Frame 與內部物件縮放整體大小時，保留使用者修改後的尺寸，不被演算法強行覆蓋。
- **左側選單自適應寬度**：
  - 面板加寬（`13.5rem` ~ `16rem`）並支援換行，避免工具增加造成橫向滾動條。

### 5. 獨立離線桌面應用程式 (Tauri Desktop App)
- 整合 Tauri 桌面環境打包，可完全離線執行。
- 發布檔案位於：
  - 可執行檔：`src-tauri/target/release/excalidraw-desktop.exe`
  - 安裝檔：`src-tauri/target/release/bundle/nsis/Excalidraw_1.0.0_x64-setup.exe`

---

## 二、檔案修改與新增目錄

- **核心排版演算法**：
  - `packages/element/src/layout/frameLayout.ts`：排版主控制器
  - `packages/element/src/layout/distributeWithGap.ts`：水平 / 垂直行列排版
  - `packages/element/src/layout/masonry.ts`：瀑布流演算法
  - `packages/element/src/layout/packery.ts`：2D 拼貼裝箱演算法
  - `packages/element/src/layout/sorting.ts`：多維度穩定排序
- **Excalidraw 動作與 UI 整合**：
  - `packages/excalidraw/actions/actionFrameLayout.ts`：排版、對齊、轉換、圖片處理等動作定義
  - `packages/excalidraw/components/Actions.tsx` & `.scss`：左側工具列 UI 及樣式
  - `packages/excalidraw/components/App.tsx`：指標事件、右鍵選單整合與重排觸發保護
- **多國語言**：
  - `packages/excalidraw/locales/zh-TW.json` & `en.json`
- **測試**：
  - `packages/element/tests/frameLayout.test.ts`
  - `packages/excalidraw/tests/frameLayout.test.tsx`
