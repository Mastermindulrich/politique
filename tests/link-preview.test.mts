// Link cards: the page reader and its guard against private addresses.
// Run: node --experimental-strip-types tests/link-preview.test.mts
import { fetchPreview, firstUrl, signPreview, verifyPreview } from "../lib/link-preview.ts";

const assert = (c: unknown, m: string) => { if (!c) throw new Error("ASSERT: " + m); };
const realFetch = globalThis.fetch;
const calls: string[] = [];
const page = (html: string, init: ResponseInit = {}) => new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" }, ...init });
function serve(routes: Record<string, () => Response>) {
  calls.length = 0;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    const hit = routes[url];
    if (!hit) throw new Error("unexpected fetch " + url);
    return hit();
  }) as typeof fetch;
}

assert(firstUrl("Lisez https://exemple.ci/budget?an=2027, merci.") === "https://exemple.ci/budget?an=2027", "first link, without the trailing comma");
assert(firstUrl("pas de lien ici") === null, "no link");

// A public address (IP literal, so no DNS in the test) with Open Graph tags.
serve({
  "http://93.184.216.34/article": () => page(`<html><head><title>Titre de secours</title>
    <meta property="og:title" content="Budget 2027 : ce qui change &amp; pourquoi">
    <meta name="description" content="Le d&eacute;tail   par quartier.">
    <meta property="og:image" content="/img/une.jpg"><meta property="og:image:secure_url" content="https://cdn.exemple.ci/une.jpg">
    <meta property="og:site_name" content="Le Journal"></head><body>…</body></html>`),
});
const p = await fetchPreview("http://93.184.216.34/article");
assert(p && p.title === "Budget 2027 : ce qui change & pourquoi", "og:title, entities decoded: " + JSON.stringify(p));
assert(p!.description === "Le détail par quartier." && p!.site === "Le Journal" && p!.image === "https://cdn.exemple.ci/une.jpg", "description, site and https image: " + JSON.stringify(p));

// Falls back to <title> and the host name; an http image is dropped.
serve({ "http://93.184.216.34/simple": () => page(`<title> Page simple </title><meta property="og:image" content="http://93.184.216.34/a.jpg">`) });
const q = await fetchPreview("http://93.184.216.34/simple");
assert(q && q.title === "Page simple" && q.site === "93.184.216.34" && q.image === undefined, "fallbacks: " + JSON.stringify(q));

// Never fetched: private, loopback, link-local and metadata addresses, odd ports, credentials, other schemes.
for (const bad of ["http://127.0.0.1/", "http://10.0.0.5/x", "http://192.168.1.1/", "http://169.254.169.254/latest/meta-data", "http://[::1]/", "http://[fd00::1]/", "http://[::ffff:10.0.0.1]/", "http://localhost/", "http://intranet/", "http://93.184.216.34:8080/", "http://user:pw@93.184.216.34/", "ftp://93.184.216.34/", "file:///etc/passwd", "javascript:alert(1)"]) {
  serve({});
  assert((await fetchPreview(bad)) === null && calls.length === 0, "refused without any request: " + bad);
}

// A redirect to a private address is not followed.
serve({ "http://93.184.216.34/r": () => new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data" } }) });
assert((await fetchPreview("http://93.184.216.34/r")) === null && calls.length === 1, "redirect to a private address refused");

// A redirect to a public page is followed, at most four hops.
serve({
  "http://93.184.216.34/a": () => new Response(null, { status: 301, headers: { location: "/b" } }),
  "http://93.184.216.34/b": () => page("<title>Arrivée</title>"),
});
assert((await fetchPreview("http://93.184.216.34/a"))?.title === "Arrivée", "public redirect followed");
serve({ "http://93.184.216.34/loop": () => new Response(null, { status: 302, headers: { location: "/loop" } }) });
assert((await fetchPreview("http://93.184.216.34/loop")) === null && calls.length === 4, "redirect loop stops after four hops");

// Not a web page, or an error page: no card.
serve({ "http://93.184.216.34/pdf": () => new Response("%PDF", { headers: { "content-type": "application/pdf" } }) });
assert((await fetchPreview("http://93.184.216.34/pdf")) === null, "non-HTML ignored");
serve({ "http://93.184.216.34/404": () => page("<title>Introuvable</title>", { status: 404 }) });
assert((await fetchPreview("http://93.184.216.34/404")) === null, "error page ignored");

// The signature binds every field of the card.
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-secret";
const sig = signPreview(p!);
assert(sig.length === 64 && verifyPreview(p!, sig), "a signed card verifies");
assert(!verifyPreview({ ...p!, title: "Autre titre" }, sig) && !verifyPreview({ ...p!, url: "http://evil.example/" }, sig) && !verifyPreview(p!, ""), "a changed card does not");

globalThis.fetch = realFetch;
console.log("link preview OK");
