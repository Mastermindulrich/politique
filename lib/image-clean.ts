// Removes hidden metadata from a photo WITHOUT touching its pixels.
//
// Phone photos carry EXIF: GPS position, phone model, date. On POLITIQUE where someone votes
// stays private, so that must never be published. Re-encoding through a canvas removed it, but
// also softened every photo. Here the file is copied byte for byte and only the metadata blocks
// are left out: the picture is exactly the original, colour profile included.
//
// JPEG: drops APP1 (EXIF, XMP), APP13 (IPTC), COM, APP2 "MPF" and anything after the main
// image (iPhone depth and gain maps), keeps APP0, ICC profile (APP2 "ICC_PROFILE") and Adobe.
// The orientation tag is written back in a tiny EXIF block so photos stay the right way up.
// PNG: drops eXIf, tEXt, zTXt, iTXt and tIME chunks. WebP: drops EXIF and XMP chunks.
// Anything that does not parse cleanly returns null: the caller then re-encodes instead.

const u8 = (b: ArrayBuffer) => new Uint8Array(b);

function ascii(a: Uint8Array, at: number, s: string) {
  for (let i = 0; i < s.length; i++) if (a[at + i] !== s.charCodeAt(i)) return false;
  return true;
}

/** Reads the EXIF orientation (1 to 8) from the body of an APP1 Exif segment. */
function exifOrientation(seg: Uint8Array): number {
  if (!ascii(seg, 0, "Exif\0\0")) return 1;
  const t = 6;
  const le = seg[t] === 0x49 && seg[t + 1] === 0x49;
  if (!le && !(seg[t] === 0x4d && seg[t + 1] === 0x4d)) return 1;
  const r16 = (o: number) => (le ? seg[t + o] | (seg[t + o + 1] << 8) : (seg[t + o] << 8) | seg[t + o + 1]);
  const r32 = (o: number) => (le ? (r16(o) | (r16(o + 2) << 16)) >>> 0 : ((r16(o) << 16) | r16(o + 2)) >>> 0);
  const ifd = r32(4);
  if (t + ifd + 2 > seg.length) return 1;
  const n = r16(ifd);
  for (let i = 0; i < n; i++) {
    const e = ifd + 2 + i * 12;
    if (t + e + 12 > seg.length) break;
    if (r16(e) === 0x0112) {
      const v = r16(e + 8);
      return v >= 1 && v <= 8 ? v : 1;
    }
  }
  return 1;
}

/** A complete APP1 segment holding only the orientation tag. */
function orientationSegment(o: number): Uint8Array {
  // FFE1, length 34, "Exif\0\0", TIFF big-endian header, IFD with one SHORT entry, no next IFD.
  return new Uint8Array([
    0xff, 0xe1, 0x00, 0x22,
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08,
    0x00, 0x01,
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, o, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
  ]);
}

function cleanJpeg(a: Uint8Array): Uint8Array[] | null {
  if (a[0] !== 0xff || a[1] !== 0xd8) return null;
  const out: Uint8Array[] = [a.subarray(0, 2)];
  let orientation = 1;
  let insertAt = 1; // after SOI, or after APP0 when there is one
  let p = 2;
  while (p + 4 <= a.length) {
    if (a[p] !== 0xff) return null;
    const m = a[p + 1];
    if (m === 0xff) { p++; continue; } // fill byte
    const len = (a[p + 2] << 8) | a[p + 3];
    if (len < 2 || p + 2 + len > a.length) return null;
    const body = a.subarray(p + 4, p + 2 + len);
    const seg = a.subarray(p, p + 2 + len);
    if (m === 0xda) {
      // Start of scan: copy the image data up to the first end-of-image marker, then stop.
      let q = p + 2 + len;
      while (q + 1 < a.length && !(a[q] === 0xff && a[q + 1] === 0xd9)) q++;
      if (q + 1 >= a.length) return null;
      out.push(a.subarray(p, q + 2));
      if (orientation !== 1) out.splice(insertAt, 0, orientationSegment(orientation));
      return out;
    }
    const drop =
      m === 0xe1 || m === 0xed || m === 0xfe ||
      (m === 0xe2 && ascii(body, 0, "MPF\0")) ||
      (m >= 0xe3 && m <= 0xec); // other vendor blocks (camera makers, Samsung, ...)
    if (m === 0xe1 && orientation === 1) orientation = exifOrientation(body);
    if (!drop) {
      out.push(seg);
      if (m === 0xe0 && out.length === 2) insertAt = 2;
    }
    p += 2 + len;
  }
  return null;
}

function cleanPng(a: Uint8Array): Uint8Array[] | null {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (sig.some((b, i) => a[i] !== b)) return null;
  const out: Uint8Array[] = [a.subarray(0, 8)];
  const drop = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);
  let p = 8;
  while (p + 12 <= a.length) {
    const len = ((a[p] << 24) | (a[p + 1] << 16) | (a[p + 2] << 8) | a[p + 3]) >>> 0;
    const type = String.fromCharCode(a[p + 4], a[p + 5], a[p + 6], a[p + 7]);
    const end = p + 12 + len;
    if (end > a.length) return null;
    if (!drop.has(type)) out.push(a.subarray(p, end));
    p = end;
    if (type === "IEND") return out;
  }
  return null;
}

function cleanWebp(a: Uint8Array): Uint8Array[] | null {
  if (!ascii(a, 0, "RIFF") || !ascii(a, 8, "WEBP")) return null;
  const chunks: Uint8Array[] = [];
  let p = 12;
  let vp8x: Uint8Array | null = null;
  while (p + 8 <= a.length) {
    const size = (a[p + 4] | (a[p + 5] << 8) | (a[p + 6] << 16) | (a[p + 7] << 24)) >>> 0;
    const end = p + 8 + size + (size & 1);
    if (p + 8 + size > a.length) return null;
    const fourcc = String.fromCharCode(a[p], a[p + 1], a[p + 2], a[p + 3]);
    if (fourcc === "VP8X") {
      vp8x = a.slice(p, Math.min(end, a.length));
      vp8x[8] &= ~(0x08 | 0x04); // no EXIF, no XMP
      chunks.push(vp8x);
    } else if (fourcc !== "EXIF" && fourcc !== "XMP ") {
      chunks.push(a.subarray(p, Math.min(end, a.length)));
    }
    p = end;
  }
  const body = chunks.reduce((n, c) => n + c.length, 0) + 4;
  const head = new Uint8Array(12);
  head.set(a.subarray(0, 12));
  head[4] = body & 0xff;
  head[5] = (body >> 8) & 0xff;
  head[6] = (body >> 16) & 0xff;
  head[7] = (body >>> 24) & 0xff;
  return [head, ...chunks];
}

/**
 * The same photo, pixel for pixel, without location or camera metadata.
 * Returns null for formats it does not handle or files it cannot parse.
 */
export async function stripMetadata(file: Blob): Promise<Blob | null> {
  const type = file.type;
  if (type === "image/gif") return file; // GIF has no EXIF; keep the animation as is
  if (!/^image\/(jpeg|png|webp)$/.test(type)) return null;
  const a = u8(await file.arrayBuffer());
  const parts = type === "image/jpeg" ? cleanJpeg(a) : type === "image/png" ? cleanPng(a) : cleanWebp(a);
  if (!parts) return null;
  return new Blob(parts as BlobPart[], { type });
}

export const __test = { cleanJpeg, cleanPng, cleanWebp, exifOrientation };
