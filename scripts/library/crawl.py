"""Fetches web pages for the library sources (run by the Library sources workflow).
  crawl.py links URL           all links of a page ("=> url | text")
  crawl.py page URL            readable text of a page's main content, then its links
  crawl.py crawl URL SUBSTR    text of every page linked from URL's main content whose
                               address contains SUBSTR, in order, each after "##PAGE url"
"""
import re
import subprocess
import sys
import time
import urllib.request

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36"
HERE = __file__.rsplit("/", 1)[0]


def get(url):
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read().decode("utf-8", "replace")
        except Exception as e:  # noqa: BLE001
            err = e
            time.sleep(3)
    print(f"##ERROR {url} {err}")
    return ""


def text(html):
    out = subprocess.run([sys.executable, f"{HERE}/html-text.py"], input=html, capture_output=True, text=True).stdout
    return out


def fix(href):
    return re.sub(r"^(https?://[^/]+?\.biz)(\d)", r"\1/\2", href)


mode, url = sys.argv[1], sys.argv[2]
if mode == "links":
    html = get(url)
    for m in re.finditer(r'<a\s[^>]*href="([^"]+)"[^>]*>(.*?)</a>', html, re.S):
        t = " ".join(re.sub(r"<[^>]+>", " ", m.group(2)).split())
        print(f"=> {fix(m.group(1))} | {t}")
elif mode == "page":
    print(text(get(url)))
elif mode == "crawl":
    sub = sys.argv[3]
    seen = []
    for line in text(get(url)).splitlines():
        if line.startswith("=> "):
            href = fix(line[3:].split(" | ")[0].strip())
            if sub in href and href not in seen:
                seen.append(href)
    for href in seen:
        print(f"##PAGE {href}")
        print("\n".join(l for l in text(get(href)).splitlines() if not l.startswith("=> ")))
        time.sleep(1)
