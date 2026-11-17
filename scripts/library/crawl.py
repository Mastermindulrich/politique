"""Fetches web pages for the library sources (run by the Library sources workflow).
  crawl.py links URL           all links of a page ("=> url | text")
  crawl.py page URL            readable text of a page's main content, then its links
  crawl.py crawl URL SUBSTR    text of every page linked from URL's main content whose
                               address contains SUBSTR, in order, each after "##PAGE url"
                               ("*": any post of the site) and "##TITLE heading" (the index page itself comes first,
                               after "##INDEX", with its links)
  crawl.py category URL        every post of a WordPress category (all its listing pages),
                               oldest first, each after "##PAGE url" and "##TITLE heading"
  crawl.py raw URL             visible text of any page, then its links
  crawl.py nanan URL N         a nanan.ai text: its page after "##INDEX", then each article page
                               (links found on the page, else article-1..N) after "##ARTICLE slug"
"""
import html as htmllib
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36"
HERE = __file__.rsplit("/", 1)[0]


def get(url):
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return ""
            err = e
            time.sleep(3)
        except Exception as e:  # noqa: BLE001
            err = e
            time.sleep(3)
    print(f"##ERROR {url} {err}")
    return ""


def text(html):
    out = subprocess.run([sys.executable, f"{HERE}/html-text.py"], input=html, capture_output=True, text=True).stdout
    return out


def title(html):
    m = re.search(r'<h1[^>]*class="[^"]*entry-title[^"]*"[^>]*>(.*?)</h1>', html, re.S)
    return " ".join(re.sub(r"<[^>]+>", " ", m.group(1)).split()) if m else ""


def post(href):
    html = get(href)
    print(f"##PAGE {href}")
    print(f"##TITLE {title(html)}")
    print("\n".join(l for l in text(html).splitlines() if not l.startswith("=> ")))
    time.sleep(1)


def fix(href):
    return re.sub(r"^(https?://[^/]+?\.biz)(\d)", r"\1/\2", href)


def plain(html):
    """Visible text of any page, one block per line."""
    html = re.sub(r"<(script|style|noscript|svg|head)\b.*?</\1>", " ", html, flags=re.S | re.I)
    html = re.sub(r"<(br|/p|/div|/li|/h\d|/section|/article|/tr|/a)\b[^>]*>", "\n", html, flags=re.I)
    out = htmllib.unescape(re.sub(r"<[^>]+>", " ", html))
    return "\n".join(" ".join(l.split()) for l in out.splitlines() if l.strip())


mode, url = sys.argv[1], sys.argv[2]
if mode == "links":
    html = get(url)
    for m in re.finditer(r'<a\s[^>]*href="([^"]+)"[^>]*>(.*?)</a>', html, re.S):
        t = " ".join(re.sub(r"<[^>]+>", " ", m.group(2)).split())
        print(f"=> {fix(m.group(1))} | {t}")
elif mode == "raw":
    html = get(url)
    print(plain(html))
    for m in sorted(set(re.findall(r'href="([^"#]+)"', html))):
        print(f"=> {m}")
elif mode == "nanan":
    html = get(url)
    print("##INDEX")
    print(plain(html))
    base = url.rstrip("/") + "/articles/"
    slugs = []
    for m in re.finditer(r'/articles/([a-z0-9-]+)', html):
        if m.group(1) not in slugs:
            slugs.append(m.group(1))
    if len(slugs) < 3:
        slugs = [f"article-{i}" for i in range(1, int(sys.argv[3]) + 1)]
    empty = 0
    for slug in slugs:
        page = get(base + slug)
        if not page:
            empty += 1
            if empty > 3:
                break
            continue
        empty = 0
        print(f"##ARTICLE {slug}")
        print(plain(page))
        time.sleep(0.5)
elif mode == "page":
    print(text(get(url)))
elif mode == "crawl":
    sub = sys.argv[3]
    seen = []
    index = text(get(url))
    print("##INDEX")
    print(index)
    for line in index.splitlines():
        if line.startswith("=> "):
            href = fix(line[3:].split(" | ")[0].strip())
            # "*": every post of the site linked from the index (short /YYYY/MM/DD/slug/ links).
            ok = re.match(r"https?://(www\.)?loidici\.biz/\d{4}/\d\d/\d\d/", href) and "#" not in href if sub == "*" else sub in href
            if ok and href not in seen:
                seen.append(href)
    for href in seen:
        post(href)
elif mode == "category":
    path = url.split("/category/", 1)[1].rstrip("/")
    posts = {}
    for n in range(1, 200):
        html = get(url if n == 1 else f"{url.rstrip('/')}/page/{n}/")
        found = 0
        for m in re.finditer(r'href="(https?://[^"#]+?/' + re.escape(path) + r'/(?:[^"#]*/)?(\d+)/naty/)"', html):
            href = fix(m.group(1))
            if href not in posts.values():
                posts[int(m.group(2))] = href
                found += 1
        if not found:
            break
        time.sleep(1)
    print(f"##POSTS {len(posts)}")
    for pid in sorted(posts):
        post(posts[pid])
