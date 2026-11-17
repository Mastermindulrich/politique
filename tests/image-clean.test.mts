// Photos keep their exact pixels; GPS and camera metadata are removed.
// Run: node --experimental-strip-types tests/image-clean.test.mts  (then: python3 tests/image-clean-check.py)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { stripMetadata } from "../lib/image-clean.ts";
import { tuneOpus } from "../lib/call-sdp.ts";

const assert = (c: unknown, m: string) => { if (!c) throw new Error("ASSERT: " + m); };
const dir = new URL("./fixtures/", import.meta.url);
mkdirSync(new URL("out/", dir), { recursive: true });
const has = (b: Uint8Array, s: string) => Buffer.from(b).includes(Buffer.from(s));

for (const [f, type] of [["gps.jpg", "image/jpeg"], ["prog.jpg", "image/jpeg"], ["t.png", "image/png"], ["e.webp", "image/webp"]] as const) {
  const src = readFileSync(new URL(f, dir));
  assert(has(src, "PhoneMaker"), `${f}: fixture has metadata`);
  const out = await stripMetadata(new Blob([src], { type }));
  assert(out, `${f}: cleaned`);
  const bytes = new Uint8Array(await out!.arrayBuffer());
  assert(!has(bytes, "PhoneMaker"), `${f}: camera maker removed`);
  assert(!has(bytes, "secret place"), `${f}: text removed`);
  assert(bytes.length < src.length, `${f}: smaller`);
  writeFileSync(new URL("out/" + f, dir), bytes);
}
assert((await stripMetadata(new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }))) === null, "garbage refused");

const sdp = "v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111 63\r\na=rtpmap:111 opus/48000/2\r\na=fmtp:111 minptime=10;useinbandfec=1\r\na=rtpmap:63 red/48000/2\r\n";
const t = tuneOpus(sdp);
assert(t.includes("a=fmtp:111 minptime=10;useinbandfec=1;stereo=0;maxplaybackrate=48000;maxaveragebitrate=96000\r\n"), "opus tuned: " + JSON.stringify(t));
const noFmtp = tuneOpus("m=audio 9 X 111\r\na=rtpmap:111 opus/48000/2\r\na=x\r\n");
assert(noFmtp.includes("a=rtpmap:111 opus/48000/2\r\na=fmtp:111 minptime=10;"), "fmtp added");
assert(tuneOpus("m=video 9 X 96\r\n") === "m=video 9 X 96\r\n", "no opus: untouched");
console.log("image-clean + opus tests passed");
