import React, { useState } from "react";
import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";
import { RadioGroup } from "@excalidraw/excalidraw/components/RadioGroup";
import {
  getImageImportSettings,
  saveImageImportSettings,
  DEFAULT_IMAGE_IMPORT_SETTINGS,
  type ImageImportSettings,
  type ImageImportFormat,
} from "@excalidraw/excalidraw";
import "./ImageImportSettingsDialog.scss";

export const ImageImportSettingsDialog: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  if (!isOpen) {
    return null;
  }

  const [settings, setSettings] = useState<ImageImportSettings>(() =>
    getImageImportSettings(),
  );

  const [customRes, setCustomRes] = useState<string>(() =>
    [8192, 3840, 2560, 1440].includes(settings.maxResolution)
      ? ""
      : String(settings.maxResolution),
  );

  const [customSize, setCustomSize] = useState<string>(() =>
    [50, 20, 10, 4].includes(settings.maxFileSizeMB)
      ? ""
      : String(settings.maxFileSizeMB),
  );

  const resChoice = [8192, 3840, 2560, 1440].includes(settings.maxResolution)
    ? settings.maxResolution
    : -1;

  const sizeChoice = [50, 20, 10, 4].includes(settings.maxFileSizeMB)
    ? settings.maxFileSizeMB
    : -1;

  const handleSave = () => {
    saveImageImportSettings(settings);
    onClose();
  };

  const handleReset = () => {
    setSettings(DEFAULT_IMAGE_IMPORT_SETTINGS);
    setCustomRes("");
    setCustomSize("");
    saveImageImportSettings(DEFAULT_IMAGE_IMPORT_SETTINGS);
  };

  return (
    <Dialog
      title="🖼️ 圖片匯入設定 (Image Import Settings)"
      onCloseRequest={onClose}
      className="ImageImportSettingsModal"
      size="small"
    >
      <div className="ImageImportSettingsDialog">
        {/* 最大解析度限制 */}
        <div className="ImageImportSettingsDialog__section">
          <label className="title">最大解析度限制 (Max Resolution)</label>
          <div className="description">
            匯入圖片時若超出此尺寸，將自動等比例縮放以維持效能或畫質。
          </div>
          <RadioGroup
            name="maxResolution"
            value={resChoice}
            onChange={(val) => {
              if (val === -1) {
                const parsed = Number(customRes) || 1920;
                setSettings({ ...settings, maxResolution: parsed });
              } else {
                setSettings({ ...settings, maxResolution: val });
              }
            }}
            choices={[
              { value: 8192, label: "無限制 (8192px)" },
              { value: 3840, label: "4K (3840px)" },
              { value: 2560, label: "2K (2560px)" },
              { value: 1440, label: "預設 (1440px)" },
              { value: -1, label: "自訂" },
            ]}
          />
          {resChoice === -1 && (
            <div className="ImageImportSettingsDialog__custom-input">
              <input
                type="number"
                min="100"
                max="16384"
                value={customRes || settings.maxResolution}
                onChange={(e) => {
                  setCustomRes(e.target.value);
                  const num = Number(e.target.value);
                  if (num > 0) {
                    setSettings({ ...settings, maxResolution: num });
                  }
                }}
              />
              <span>像素 (px)</span>
            </div>
          )}
        </div>

        {/* 最大檔案大小限制 */}
        <div className="ImageImportSettingsDialog__section">
          <label className="title">最大檔案大小限制 (Max File Size)</label>
          <div className="description">
            超出限制的圖片將拒絕匯入，避免記憶體或場景體積過載。
          </div>
          <RadioGroup
            name="maxFileSizeMB"
            value={sizeChoice}
            onChange={(val) => {
              if (val === -1) {
                const parsed = Number(customSize) || 30;
                setSettings({ ...settings, maxFileSizeMB: parsed });
              } else {
                setSettings({ ...settings, maxFileSizeMB: val });
              }
            }}
            choices={[
              { value: 50, label: "50 MB" },
              { value: 20, label: "20 MB" },
              { value: 10, label: "10 MB" },
              { value: 4, label: "4 MB" },
              { value: -1, label: "自訂" },
            ]}
          />
          {sizeChoice === -1 && (
            <div className="ImageImportSettingsDialog__custom-input">
              <input
                type="number"
                min="1"
                max="500"
                value={customSize || settings.maxFileSizeMB}
                onChange={(e) => {
                  setCustomSize(e.target.value);
                  const num = Number(e.target.value);
                  if (num > 0) {
                    setSettings({ ...settings, maxFileSizeMB: num });
                  }
                }}
              />
              <span>MB</span>
            </div>
          )}
        </div>

        {/* 目標轉換格式 */}
        <div className="ImageImportSettingsDialog__section">
          <label className="title">目標轉換格式 (Target Format)</label>
          <div className="description">
            可選擇匯入時保持原檔格式，或強制轉為 WebP 等現代格式。
          </div>
          <RadioGroup
            name="targetFormat"
            value={settings.targetFormat}
            onChange={(format: ImageImportFormat) => {
              setSettings({ ...settings, targetFormat: format });
            }}
            choices={[
              { value: "original", label: "保持原圖" },
              { value: "image/webp", label: "強制轉為 WebP" },
              { value: "image/png", label: "轉為 PNG" },
              { value: "image/jpeg", label: "轉為 JPEG" },
            ]}
          />
        </div>

        {/* 壓縮品質 */}
        <div className="ImageImportSettingsDialog__section">
          <label className="title">壓縮品質 (Quality)</label>
          <div className="description">
            無損 (100%) 或設定失真壓縮品質（WebP / JPEG 轉檔有效）。
          </div>
          <RadioGroup
            name="qualityMode"
            value={settings.quality >= 1 ? "lossless" : "custom"}
            onChange={(mode) => {
              if (mode === "lossless") {
                setSettings({ ...settings, quality: 1.0 });
              } else {
                setSettings({ ...settings, quality: 0.85 });
              }
            }}
            choices={[
              { value: "lossless", label: "無損 (100%)" },
              { value: "custom", label: "自訂壓縮率" },
            ]}
          />
          {settings.quality < 1 && (
            <div className="ImageImportSettingsDialog__slider-row">
              <input
                type="range"
                min="1"
                max="99"
                value={Math.round(settings.quality * 100)}
                onChange={(e) => {
                  const val = Number(e.target.value) / 100;
                  setSettings({ ...settings, quality: val });
                }}
              />
              <span className="val-badge">
                {Math.round(settings.quality * 100)}%
              </span>
            </div>
          )}
        </div>

        {/* 按鈕列 */}
        <div className="ImageImportSettingsDialog__actions">
          <FilledButton
            label="重設為預設值"
            onClick={handleReset}
            variant="outlined"
            color="muted"
          >
            重設為預設值
          </FilledButton>
          <FilledButton label="儲存設定" onClick={handleSave}>
            確定儲存
          </FilledButton>
        </div>
      </div>
    </Dialog>
  );
};
