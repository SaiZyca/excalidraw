import React, { useState } from "react";
import JSZip from "jszip";
import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";
import { RadioGroup } from "@excalidraw/excalidraw/components/RadioGroup";
import { downloadIcon } from "@excalidraw/excalidraw/components/icons";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import "./BatchExportImagesDialog.scss";

type ExportFormatChoice = "original" | "webp";

export const BatchExportImagesDialog: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}> = ({ isOpen, onClose, excalidrawAPI }) => {
  const [format, setFormat] = useState<ExportFormatChoice>("original");
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  if (!isOpen) {
    return null;
  }

  const elements = excalidrawAPI?.getSceneElements() || [];
  const files = excalidrawAPI?.getFiles() || {};

  // Find all active image elements that have corresponding files
  const imageElements = elements.filter(
    (el): el is typeof el & { fileId: string } =>
      el.type === "image" &&
      !el.isDeleted &&
      "fileId" in el &&
      Boolean(el.fileId) &&
      Boolean(files[(el as any).fileId]),
  );

  // Group unique file IDs
  const uniqueFileIds = Array.from(
    new Set(imageElements.map((el) => el.fileId)),
  );

  const isTauriEnv = () =>
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

  const convertToLosslessWebp = async (blob: Blob): Promise<Blob> => {
    if (blob.type === "image/webp") {
      return blob;
    }
    const img = new Image();
    const url = URL.createObjectURL(blob);
    try {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("載入圖片失敗"));
        img.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("無法建立 Canvas 上下文");
      }
      ctx.drawImage(img, 0, 0);
      return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) {
            resolve(b);
          } else {
            reject(new Error("WebP 轉碼失敗"));
          }
        }, "image/webp", 1.0);
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const prepareImages = async () => {
    const list: { filename: string; blob: Blob }[] = [];

    for (let i = 0; i < uniqueFileIds.length; i++) {
      const fileId = uniqueFileIds[i];
      const fileData = files[fileId];
      if (!fileData?.dataURL) {
        continue;
      }

      const res = await fetch(fileData.dataURL);
      let blob = await res.blob();

      let ext = "png";
      if (blob.type === "image/jpeg") {
        ext = "jpg";
      } else if (blob.type === "image/svg+xml") {
        ext = "svg";
      } else if (blob.type === "image/gif") {
        ext = "gif";
      } else if (blob.type === "image/webp") {
        ext = "webp";
      }

      if (format === "webp" && ext !== "svg") {
        blob = await convertToLosslessWebp(blob);
        ext = "webp";
      }

      const filename = `image_${i + 1}_${fileId.slice(0, 8)}.${ext}`;
      list.push({ filename, blob });
    }

    return list;
  };

  const handleExportZip = async () => {
    if (uniqueFileIds.length === 0) {
      return;
    }
    setIsProcessing(true);
    setStatusMessage(null);

    try {
      const images = await prepareImages();
      const zip = new JSZip();
      for (const img of images) {
        zip.file(img.filename, img.blob);
      }
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `excalidraw-images-${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);

      setStatusMessage({
        text: `已成功打包下載 ${images.length} 張圖片為 ZIP 壓縮檔！`,
        type: "success",
      });
    } catch (err: any) {
      console.error(err);
      setStatusMessage({
        text: `打包 ZIP 失敗：${err.message || String(err)}`,
        type: "error",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportFolder = async () => {
    if (uniqueFileIds.length === 0) {
      return;
    }
    if (!isTauriEnv()) {
      setStatusMessage({
        text: "「儲存至本機資料夾」功能僅支援桌面版 (Tauri)。請使用「下載 ZIP 壓縮檔」。",
        type: "error",
      });
      return;
    }

    setIsProcessing(true);
    setStatusMessage(null);

    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const { invoke } = await import("@tauri-apps/api/core");

      const selected = await open({
        directory: true,
        multiple: false,
        title: "選擇圖片匯出目標資料夾",
      });

      if (!selected) {
        setIsProcessing(false);
        return;
      }

      const dirPath = typeof selected === "string" ? selected : selected[0];
      const images = await prepareImages();

      const filesPayload = await Promise.all(
        images.map(async (img) => {
          const ab = await img.blob.arrayBuffer();
          return {
            name: img.filename,
            data: Array.from(new Uint8Array(ab)),
          };
        }),
      );

      const count = await invoke<number>("save_batch_images", {
        dirPath,
        files: filesPayload,
      });

      setStatusMessage({
        text: `成功儲存 ${count} 張圖片至「${dirPath}」！`,
        type: "success",
      });
    } catch (err: any) {
      console.error(err);
      setStatusMessage({
        text: `儲存至資料夾失敗：${err.message || String(err)}`,
        type: "error",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog
      title="📦 打包匯出所有圖片 (Batch Export Images)"
      onCloseRequest={onClose}
      className="BatchExportImagesModal"
      size="small"
    >
      <div className="BatchExportImagesDialog">
        <div className="BatchExportImagesDialog__info-card">
          <span>畫布上偵測到的圖片數量：</span>
          <span className="count">
            {uniqueFileIds.length} 個檔案 ({imageElements.length} 個圖檔元素)
          </span>
        </div>

        {uniqueFileIds.length === 0 ? (
          <div className="BatchExportImagesDialog__section">
            <div className="description">
              目前畫布上沒有任何圖片元素。請先在畫布上加入圖片後再使用此功能。
            </div>
          </div>
        ) : (
          <>
            {/* 格式選擇 */}
            <div className="BatchExportImagesDialog__section">
              <label className="title">匯出格式選擇</label>
              <div className="description">
                可選擇保持原圖片格式，或統一轉換為高品質無損 WebP。
              </div>
              <RadioGroup
                name="exportFormat"
                value={format}
                onChange={(f: ExportFormatChoice) => setFormat(f)}
                choices={[
                  { value: "original", label: "保留原圖格式" },
                  { value: "webp", label: "轉換為無損 WebP" },
                ]}
              />
            </div>

            {statusMessage && (
              <div
                className={`BatchExportImagesDialog__status ${statusMessage.type}`}
              >
                {statusMessage.text}
              </div>
            )}

            {/* 雙模匯出按鈕 */}
            <div className="BatchExportImagesDialog__actions">
              <FilledButton
                label="下載 ZIP 壓縮檔"
                onClick={handleExportZip}
                disabled={isProcessing}
                icon={downloadIcon}
                variant="outlined"
                color="muted"
              >
                {isProcessing ? "處理中..." : "下載 ZIP 壓縮檔"}
              </FilledButton>
              <FilledButton
                label="儲存至本機資料夾"
                onClick={handleExportFolder}
                disabled={isProcessing}
                icon={downloadIcon}
              >
                {isProcessing
                  ? "寫入中..."
                  : isTauriEnv()
                  ? "儲存至本機資料夾"
                  : "儲存至本機資料夾 (桌面專用)"}
              </FilledButton>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
};
