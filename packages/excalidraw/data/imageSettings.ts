export type ImageImportFormat =
  | "original"
  | "image/webp"
  | "image/png"
  | "image/jpeg";

export interface ImageImportSettings {
  maxResolution: number; // 8192 (unlimited), 3840 (4K), 2560 (2K), 1440 (official default), or custom number
  maxFileSizeMB: number; // 50, 20, 10, 4, or custom number
  targetFormat: ImageImportFormat; // "original" | "image/webp" | "image/png" | "image/jpeg"
  quality: number; // 1.0 (lossless) or 0.01 - 0.99
}

export const STORAGE_KEY_IMAGE_SETTINGS = "excalidraw_image_import_settings";

export const DEFAULT_IMAGE_IMPORT_SETTINGS: ImageImportSettings = {
  maxResolution: 8192,
  maxFileSizeMB: 50,
  targetFormat: "original",
  quality: 1.0,
};

export const getImageImportSettings = (): ImageImportSettings => {
  if (typeof window === "undefined" || !window.localStorage) {
    return DEFAULT_IMAGE_IMPORT_SETTINGS;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_IMAGE_SETTINGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        maxResolution:
          typeof parsed.maxResolution === "number" && parsed.maxResolution > 0
            ? parsed.maxResolution
            : DEFAULT_IMAGE_IMPORT_SETTINGS.maxResolution,
        maxFileSizeMB:
          typeof parsed.maxFileSizeMB === "number" && parsed.maxFileSizeMB > 0
            ? parsed.maxFileSizeMB
            : DEFAULT_IMAGE_IMPORT_SETTINGS.maxFileSizeMB,
        targetFormat:
          parsed.targetFormat === "image/webp" ||
          parsed.targetFormat === "image/png" ||
          parsed.targetFormat === "image/jpeg"
            ? parsed.targetFormat
            : "original",
        quality:
          typeof parsed.quality === "number" &&
          parsed.quality >= 0.01 &&
          parsed.quality <= 1.0
            ? parsed.quality
            : DEFAULT_IMAGE_IMPORT_SETTINGS.quality,
      };
    }
  } catch (err) {
    console.warn("Failed to load image settings from localStorage", err);
  }
  return DEFAULT_IMAGE_IMPORT_SETTINGS;
};

export const saveImageImportSettings = (
  settings: ImageImportSettings,
): void => {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(
      STORAGE_KEY_IMAGE_SETTINGS,
      JSON.stringify(settings),
    );
  } catch (err) {
    console.error("Failed to save image settings to localStorage", err);
  }
};
