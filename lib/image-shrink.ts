"use client";
// Photos straight from a phone weigh 2 to 8 MB. On Ivorian mobile data that is seconds per
// image for every reader, so photos are resized and re-encoded in the browser before upload.

export type Shrunk = { blob: Blob; mime: string; ext: string; width: number; height: number };

/** Longest side, in pixels, for each use. Avatars show at 40 to 134 px, so 512 covers 3x screens. */
export const EDGE = { avatar: 512, banner: 1500, post: 1600, message: 1600 } as const;

function encode(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((ok) => canvas.toBlob(ok, type, quality));
}

/**
 * Resizes an image to at most `maxEdge` px and re-encodes it (WebP when the browser can,
 * JPEG otherwise). Returns null when the file should go up untouched: GIFs (animation),
 * formats the browser cannot decode, or when re-encoding would not make it smaller.
 */
export async function shrinkImage(file: Blob, maxEdge: number, quality = 0.82): Promise<Shrunk | null> {
  const type = file.type;
  if (!type.startsWith("image/") || type === "image/gif" || type === "image/svg+xml") return null;
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    return null;
  }
  try {
    const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
    const width = Math.max(1, Math.round(bmp.width * scale));
    const height = Math.max(1, Math.round(bmp.height * scale));
    // Already small and light, in a format every browser shows: keep the original bytes.
    if (scale === 1 && file.size < 300 * 1024 && /^image\/(jpeg|png|webp)$/.test(type)) return null;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp, 0, 0, width, height);
    // Safari before 17 silently returns PNG for WebP requests: check what came back.
    let blob = await encode(canvas, "image/webp", quality);
    let mime = "image/webp", ext = "webp";
    if (!blob || blob.type !== "image/webp") {
      blob = await encode(canvas, "image/jpeg", quality);
      mime = "image/jpeg";
      ext = "jpg";
    }
    // Never make a web-ready photo heavier; formats like HEIC are always converted.
    if (!blob || (blob.size >= file.size && /^image\/(jpeg|png|webp)$/.test(type))) return null;
    return { blob, mime, ext, width, height };
  } finally {
    bmp.close();
  }
}
