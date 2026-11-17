"use client";
// Photos go up in their original quality (Ulrich, 2026-11-17): same pixels, same colours, same
// size as on the phone. Only hidden metadata (GPS position, camera) is removed, losslessly, by
// stripMetadata. A photo is re-encoded only when it has to be: a format browsers cannot show
// (HEIC from some phones), a file over the size limit, or a file that cannot be cleaned.

import { stripMetadata } from "./image-clean";

export type Kind = "avatar" | "banner" | "post" | "message";
export type Shrunk = { blob: Blob; mime: string; ext: string; width?: number; height?: number; reencoded: boolean };

/** Originals up to this size go up untouched. */
export const KEEP_MAX: Record<Kind, number> = {
  avatar: 5 * 1024 * 1024,
  banner: 10 * 1024 * 1024,
  post: 15 * 1024 * 1024,
  message: 15 * 1024 * 1024,
};

/** Longest side, in pixels, when a photo must be re-encoded. Still sharper than any screen shows it. */
export const EDGE: Record<Kind, number> = { avatar: 2048, banner: 4096, post: 4096, message: 4096 };

/** Re-encoding quality: visually the same as the original. */
export const QUALITY = 0.95;

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

function encode(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((ok) => canvas.toBlob(ok, type, quality));
}

/**
 * The photo to upload for `kind`: the original without its metadata whenever possible,
 * otherwise a high-quality re-encode. Null when the browser cannot read the file at all.
 */
export async function prepareImage(file: Blob, kind: Kind): Promise<Shrunk | null> {
  const type = file.type;
  if (EXT[type] && (file.size <= KEEP_MAX[kind] || type === "image/gif")) {
    const clean = await stripMetadata(file).catch(() => null);
    if (clean) return { blob: clean, mime: type, ext: EXT[type], reencoded: false };
  }
  return reencode(file, EDGE[kind], type === "image/png" && file.size <= KEEP_MAX[kind]);
}

/**
 * Draws the photo on a canvas and encodes it again (this also drops all metadata).
 * PNGs keep transparency through WebP; photos become JPEG, which every browser shows.
 */
async function reencode(file: Blob, maxEdge: number, keepPng: boolean): Promise<Shrunk | null> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return null;
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return null;
  }
  try {
    const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
    const width = Math.max(1, Math.round(bmp.width * scale));
    const height = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp, 0, 0, width, height);
    if (keepPng) {
      const png = await encode(canvas, "image/png", 1);
      if (png) return { blob: png, mime: "image/png", ext: "png", width, height, reencoded: true };
    }
    const alpha = file.type === "image/png" || file.type === "image/webp";
    if (alpha) {
      const webp = await encode(canvas, "image/webp", QUALITY);
      // Safari before 17 silently returns PNG for WebP requests: check what came back.
      if (webp && webp.type === "image/webp") return { blob: webp, mime: "image/webp", ext: "webp", width, height, reencoded: true };
    }
    const jpeg = await encode(canvas, "image/jpeg", QUALITY);
    if (!jpeg) return null;
    return { blob: jpeg, mime: "image/jpeg", ext: "jpg", width, height, reencoded: true };
  } finally {
    bmp.close();
  }
}
