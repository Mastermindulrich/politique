// Checks that every source cited in data/civic/*.json still answers.
// Usage: node scripts/check-civic-sources.mjs   (run by .github/workflows/civic-sources.yml,
// because the development container cannot reach most .ci sites)
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../data/civic");
const urls = new Map(); // url -> [where]
for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  for (const it of JSON.parse(readFileSync(path.join(dir, f), "utf8")).items) {
    for (const s of it.sources ?? (it.source ? [it.source] : [])) {
      if (!urls.has(s.url)) urls.set(s.url, []);
      urls.get(s.url).push(`${f} ${it.office}`);
    }
  }
}

const UA = "Mozilla/5.0 (compatible; POLITIQUE source check; +https://politique.prototypex.org)";
async function check(url) {
  for (const method of ["HEAD", "GET"]) {
    try {
      const r = await fetch(url, { method, redirect: "follow", headers: { "user-agent": UA }, signal: AbortSignal.timeout(20000) });
      if (r.ok) return r.status;
      if (method === "GET") return r.status;
    } catch (e) {
      if (method === "GET") return e.name === "TimeoutError" ? "timeout" : e.message;
    }
  }
}

const bad = [];
const list = [...urls.keys()];
for (let i = 0; i < list.length; i += 8) {
  await Promise.all(list.slice(i, i + 8).map(async (u) => {
    const s = await check(u);
    // Facebook and some news sites refuse robots with 4xx although the page exists.
    if (s !== 200 && !(typeof s === "number" && s < 400)) bad.push({ u, s });
  }));
}
console.log(`${list.length} sources checked, ${bad.length} not answering`);
for (const { u, s } of bad) console.log(`  ${s}  ${u}\n        used by ${urls.get(u).join(", ")}`);
process.exitCode = bad.some((b) => b.s === 404 || b.s === 410) ? 1 : 0;
