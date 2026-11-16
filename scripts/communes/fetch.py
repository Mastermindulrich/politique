"""Fetch the public sources used to write each commune's "Découvertes" showcase.

Runs on GitHub Actions (the build container cannot reach Wikipedia). For every commune in
communes.tsv it resolves the French Wikipedia article, keeps its plain text, its free
images with their author and licence (Wikimedia Commons), its coordinates and the
population from Wikidata, and writes data/communes/sources/<id>.json.
"""
import json
import os
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request

API = "https://fr.wikipedia.org/w/api.php"
WD = "https://www.wikidata.org/w/api.php"
UA = "POLITIQUE-communes/1.0 (https://politique.prototypex.org)"
OUT = "data/communes/sources"
HERE = os.path.dirname(__file__)

# Article titles that the automatic lookup gets wrong.
OVERRIDES = {
    "Plateau": "Le Plateau (Abidjan)",
    "Man": "Man (Côte d'Ivoire)",
    "Kong": "Kong (Côte d'Ivoire)",
    "Songon": "Songon",
    "Koro": "Koro (Côte d'Ivoire)",
    "Kani": "Kani (Côte d'Ivoire)",
    "Bako": "Bako (Côte d'Ivoire)",
    "Mayo": "Mayo (Côte d'Ivoire)",
    "Agou": "Agou (Côte d'Ivoire)",
    "Arrah": "Arrah (Côte d'Ivoire)",
    "Gbon": "Gbon (Côte d'Ivoire)",
    "Diabo": "Diabo (Côte d'Ivoire)",
    "Taï": "Taï (Côte d'Ivoire)",
}


def get(url, params, tries=4):
    q = urllib.parse.urlencode({**params, "format": "json", "formatversion": "2"})
    for i in range(tries):
        try:
            req = urllib.request.Request(f"{url}?{q}", headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=40) as r:
                return json.load(r)
        except Exception as e:  # noqa: BLE001
            print("retry", url, params.get("titles") or params.get("srsearch"), e, file=sys.stderr)
            time.sleep(2 + 3 * i)
    return {}


def norm(s):
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def page(title):
    d = get(API, {
        "action": "query", "titles": title, "redirects": 1,
        "prop": "extracts|pageprops|coordinates|images|info",
        "explaintext": 1, "exsectionformat": "wiki", "imlimit": 60, "inprop": "url",
    })
    pages = d.get("query", {}).get("pages", [])
    if not pages or pages[0].get("missing"):
        return None
    p = pages[0]
    if "disambiguation" in p.get("pageprops", {}):
        return None
    if "ivoir" not in (p.get("extract") or "")[:4000].lower():
        return None
    return p


def resolve(name, dep):
    tries = [OVERRIDES[name]] if name in OVERRIDES else []
    tries += [name, f"{name} (Côte d'Ivoire)", f"{name} (ville)", f"{name} (commune)"]
    for t in tries:
        p = page(t)
        if p:
            return p
    s = get(API, {"action": "query", "list": "search", "srsearch": f"{name} Côte d'Ivoire commune {dep}", "srlimit": 8})
    for hit in s.get("query", {}).get("search", []):
        if norm(name) in norm(hit["title"]):
            p = page(hit["title"])
            if p:
                return p
    return None


def images(p):
    files = [i["title"] for i in p.get("images", []) if re.search(r"\.(jpe?g|png|webp)$", i["title"], re.I)]
    files = [f for f in files if not re.search(r"(flag|drapeau|carte|map|logo|blason|armoiries|locator|location|icon|pictogram|commons-logo|wiki|symbol)", f, re.I)]
    out = []
    for chunk in [files[i:i + 20] for i in range(0, min(len(files), 40), 20)]:
        d = get(API, {"action": "query", "titles": "|".join(chunk), "prop": "imageinfo",
                      "iiprop": "url|extmetadata|size|mime", "iiurlwidth": 1280})
        for f in d.get("query", {}).get("pages", []):
            info = (f.get("imageinfo") or [{}])[0]
            meta = info.get("extmetadata", {})
            val = lambda k: re.sub(r"<[^>]+>", "", (meta.get(k) or {}).get("value", "")).strip()
            lic = val("LicenseShortName")
            if not info.get("thumburl") or not lic:
                continue
            if not re.search(r"(CC|Public domain|Domaine public|PD|GFDL)", lic, re.I):
                continue
            if info.get("width", 0) < 640:
                continue
            out.append({
                "file": f["title"], "thumb": info["thumburl"], "page": info.get("descriptionurl"),
                "width": info.get("width"), "height": info.get("height"),
                "artist": val("Artist")[:160], "license": lic, "licenseUrl": val("LicenseUrl"),
                "description": val("ImageDescription")[:400],
            })
    return out


def population(qid):
    if not qid:
        return None
    d = get(WD, {"action": "wbgetentities", "ids": qid, "props": "claims"})
    claims = d.get("entities", {}).get(qid, {}).get("claims", {}).get("P1082", [])
    best = None
    for c in claims:
        try:
            amount = int(float(c["mainsnak"]["datavalue"]["value"]["amount"]))
        except Exception:  # noqa: BLE001
            continue
        when = ""
        for q in c.get("qualifiers", {}).get("P585", []):
            when = q["datavalue"]["value"]["time"][1:5]
        if best is None or when > best["year"]:
            best = {"value": amount, "year": when}
    return best


def main():
    os.makedirs(OUT, exist_ok=True)
    missing = []
    for line in open(os.path.join(HERE, "communes.tsv"), encoding="utf-8"):
        cid, name, dep, region = line.rstrip("\n").split("\t")
        p = resolve(name, dep)
        rec = {"id": int(cid), "name": name, "department": dep, "region": region}
        if p:
            qid = p.get("pageprops", {}).get("wikibase_item")
            rec.update({
                "title": p["title"], "url": p.get("fullurl"), "wikidata": qid,
                "coordinates": (p.get("coordinates") or [None])[0],
                "population": population(qid),
                "text": (p.get("extract") or "")[:14000],
                "images": images(p),
            })
        else:
            missing.append(name)
        with open(os.path.join(OUT, f"{cid}.json"), "w", encoding="utf-8") as f:
            json.dump(rec, f, ensure_ascii=False, indent=1)
        print(cid, name, "->", rec.get("title"), len(rec.get("images", [])), "images")
        time.sleep(0.3)
    print("missing:", missing)


if __name__ == "__main__":
    main()
