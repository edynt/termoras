import { readImage } from "@tauri-apps/plugin-clipboard-manager";
import { saveTempImage } from "./tauri-commands";

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"];

/** Convert a Blob to base64 string (without data URI prefix) */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip "data:image/png;base64," prefix
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Get file extension from MIME type */
function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/bmp": "bmp",
    "image/svg+xml": "svg",
  };
  return map[mime] || "png";
}

/** Save image blob to temp file via Rust, returns absolute path */
export async function saveImageBlob(blob: Blob): Promise<string> {
  const base64 = await blobToBase64(blob);
  const ext = extFromMime(blob.type);
  return saveTempImage(base64, ext);
}

/** Check if a File is an image */
export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

/** Check if a file path has an image extension */
export function isImagePath(path: string): boolean {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  return IMAGE_EXTENSIONS.includes(ext);
}

/**
 * Try reading an image from clipboard via Tauri native API.
 * Returns temp file path if found, null otherwise.
 * Uses Tauri's clipboard plugin (not browser Clipboard API) to avoid
 * WebKit's "Paste" permission badge in WKWebView.
 */
export async function pasteImageFromClipboard(): Promise<string | null> {
  try {
    const image = await readImage();
    const rgba = await image.rgba();
    const size = await image.size();
    if (!size.width || !size.height) return null;

    // Convert raw RGBA pixels to PNG via Canvas
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const imageData = new ImageData(
      new Uint8ClampedArray(rgba),
      size.width,
      size.height,
    );
    ctx.putImageData(imageData, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!blob) return null;

    return saveImageBlob(blob);
  } catch {
    // No image in clipboard or plugin unavailable — fall through
  }
  return null;
}
