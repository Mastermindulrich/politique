"use client";
// Browser side of attachments in direct messages: shrink photos, read sizes, upload.
import { prepareImage } from "./image-shrink";
import { DM_BUCKET, DM_MAX_BYTES, kindOf, storageType } from "./dm-media";
import { supabaseBrowser } from "./supabase/client";
import type { DmAttachment } from "./types";

export type Prepared = { blob: Blob; name: string; mime: string; kind: DmAttachment["type"]; width?: number; height?: number };

/**
 * Photos go in their original quality, with only their hidden metadata (GPS position) removed.
 * They are re-encoded only when the browser cannot show the format (HEIC) or the file is over
 * 15 MB. A photo the browser cannot decode at all (HEIC on Chrome, for example) is sent as a file.
 */
export async function prepare(file: File): Promise<Prepared> {
  const mime = file.type || "application/octet-stream";
  const name = file.name || "fichier";
  if (mime.startsWith("image/")) {
    const small = await prepareImage(file, "message");
    if (small) {
      const size = small.width && small.height ? { width: small.width, height: small.height } : await imageSize(small.blob);
      return { blob: small.blob, name: small.reencoded ? name.replace(/\.[^.]+$/, "") + "." + small.ext : name, mime: small.mime, kind: "image", ...size };
    }
  }
  const kind = kindOf(mime);
  if (kind === "image") {
    const size = await imageSize(file);
    return { blob: file, name, mime, kind, ...size };
  }
  return { blob: file, name, mime, kind: "file" };
}

function imageSize(file: Blob): Promise<{ width?: number; height?: number }> {
  return new Promise((ok) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { ok({ width: img.naturalWidth || undefined, height: img.naturalHeight || undefined }); URL.revokeObjectURL(url); };
    img.onerror = () => { ok({}); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

export function tooBig(p: Prepared) {
  return p.blob.size > DM_MAX_BYTES;
}

function safeExt(name: string, mime: string) {
  const fromName = (name.split(".").length > 1 ? name.split(".").pop()! : "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
  if (fromName) return fromName;
  return (mime.split("/")[1] || "bin").replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
}

/** Upload into <conversation>/<me>/ of the private bucket. Throws on failure. */
export async function upload(conversationId: string, viewerId: string, p: Prepared): Promise<DmAttachment> {
  const supabase = supabaseBrowser();
  const path = `${conversationId}/${viewerId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${safeExt(p.name, p.mime)}`;
  const { error } = await supabase.storage.from(DM_BUCKET).upload(path, p.blob, { contentType: storageType(p.mime), cacheControl: "31536000", upsert: false });
  if (error) throw new Error(error.message);
  return {
    type: p.kind,
    path,
    name: p.name.slice(0, 200),
    size: p.blob.size,
    mime: p.mime.slice(0, 120),
    ...(p.width && p.height ? { width: p.width, height: p.height } : {}),
  };
}

export async function removeUploaded(path: string) {
  try {
    await supabaseBrowser().storage.from(DM_BUCKET).remove([path]);
  } catch {
    /* best effort */
  }
}

/** Sign links for attachments that arrived live (RLS: only members get them). */
export async function signPaths(paths: string[], ttl: number): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data } = await supabaseBrowser().storage.from(DM_BUCKET).createSignedUrls(paths, ttl);
  const out: Record<string, string> = {};
  for (const row of (data ?? []) as { path: string | null; signedUrl: string | null; error: string | null }[]) {
    if (row.path && row.signedUrl && !row.error) out[row.path] = row.signedUrl;
  }
  return out;
}
