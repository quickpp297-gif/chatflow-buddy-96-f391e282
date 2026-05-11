/**
 * Compress/resize an image client-side before upload.
 * Prevents Android WebView memory blow-ups (white screen) for large camera photos.
 */
export async function compressImage(
  file: File,
  maxDim = 1600,
  quality = 0.82,
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  // Skip GIF (animation) and svg
  if (file.type === "image/gif" || file.type === "image/svg+xml") return file;

  try {
    const bitmap = await loadBitmap(file);
    const { width, height } = scaleDown(bitmap.width, bitmap.height, maxDim);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap as any, 0, 0, width, height);
    if ((bitmap as any).close) (bitmap as any).close();

    const outType = file.type === "image/png" ? "image/jpeg" : file.type;
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, outType, quality),
    );
    if (!blob) return file;
    if (blob.size >= file.size) return file;
    const newName = file.name.replace(/\.(png|webp|heic|heif)$/i, ".jpg");
    return new File([blob], newName, { type: outType, lastModified: Date.now() });
  } catch {
    return file;
  }
}

function scaleDown(w: number, h: number, max: number) {
  if (w <= max && h <= max) return { width: w, height: h };
  const ratio = w > h ? max / w : max / h;
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // fall through
    }
  }
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}