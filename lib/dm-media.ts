// Shared helpers for photos, videos and files in direct messages.
// Safe to import from server and client code.
import type { DmAttachment } from "./types";

export const DM_BUCKET = "politique-dm";
export const DM_MAX_FILES = 10;
export const DM_MAX_BYTES = 50 * 1024 * 1024;
/** Signed URLs stay valid for six hours; a conversation left open longer re-signs on reload. */
export const DM_URL_TTL = 6 * 60 * 60;

/** Types the private bucket accepts as is (see migration 0006). Anything else goes up as octet-stream. */
const KNOWN_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif",
  "video/mp4", "video/webm", "video/quicktime", "video/3gpp",
  "audio/mpeg", "audio/mp4", "audio/aac", "audio/ogg", "audio/wav", "audio/webm", "audio/x-m4a",
  "application/pdf", "text/plain", "text/csv", "application/rtf", "application/zip",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.text", "application/vnd.oasis.opendocument.spreadsheet",
]);

export function storageType(mime: string) {
  return KNOWN_TYPES.has(mime) ? mime : "application/octet-stream";
}

/** Browsers can show these inline; HEIC and the rest are sent as a file card. */
export function kindOf(mime: string): DmAttachment["type"] {
  if (/^image\/(jpeg|png|webp|gif)$/.test(mime)) return "image";
  if (/^video\/(mp4|webm|quicktime)$/.test(mime)) return "video";
  return "file";
}

export function isDmAttachment(x: unknown): x is DmAttachment {
  return Boolean(x && typeof x === "object" && typeof (x as DmAttachment).path === "string" && ["image", "video", "file"].includes((x as DmAttachment).type));
}

export function attachmentsOf(media: unknown): DmAttachment[] {
  return Array.isArray(media) ? media.filter(isDmAttachment) : [];
}

export function formatSize(bytes: number | undefined, lang: "fr" | "en") {
  if (!bytes && bytes !== 0) return "";
  const unit = lang === "fr" ? ["o", "Ko", "Mo", "Go"] : ["B", "KB", "MB", "GB"];
  let n = bytes, i = 0;
  while (n >= 1024 && i < unit.length - 1) { n /= 1024; i++; }
  const v = i === 0 ? String(n) : n.toLocaleString(lang === "fr" ? "fr-FR" : "en-GB", { maximumFractionDigits: n < 10 ? 1 : 0 });
  return `${v} ${unit[i]}`;
}

/** "📷 Photo", "🎥 2 vidéos", "📎 Programme.pdf": used in pushes, toasts and the conversation list. */
export function attachmentLabel(media: unknown, lang: "fr" | "en"): string {
  const list = attachmentsOf(media);
  if (!list.length) return "";
  const fr = lang === "fr";
  const images = list.filter((m) => m.type === "image").length;
  const videos = list.filter((m) => m.type === "video").length;
  const files = list.length - images - videos;
  if (images && !videos && !files) return images === 1 ? "📷 Photo" : `📷 ${images} photos`;
  if (videos && !images && !files) return videos === 1 ? (fr ? "🎥 Vidéo" : "🎥 Video") : `🎥 ${videos} ${fr ? "vidéos" : "videos"}`;
  if (files && !images && !videos) {
    if (files === 1) return `📎 ${list[0].name || (fr ? "Fichier" : "File")}`;
    return `📎 ${files} ${fr ? "fichiers" : "files"}`;
  }
  if (!files) return `📷 ${images + videos} ${fr ? "photos et vidéos" : "photos and videos"}`;
  return `📎 ${list.length} ${fr ? "pièces jointes" : "attachments"}`;
}

/** One line for a message: its text, or what it carries when it has no text. */
export function messagePreview(text: string | null | undefined, media: unknown, lang: "fr" | "en") {
  const label = attachmentLabel(media, lang);
  const body = (text ?? "").trim();
  if (!label) return body;
  if (!body) return label;
  return `${label.split(" ")[0]} ${body}`;
}

/** Signed-URL query string that makes the browser download with the original file name. */
export function withDownload(url: string, name?: string) {
  if (!name) return url;
  return `${url}${url.includes("?") ? "&" : "?"}download=${encodeURIComponent(name)}`;
}
