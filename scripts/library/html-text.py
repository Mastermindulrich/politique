"""Prints the readable text of a web page's main content (WordPress .entry-content when
present), one block per line, followed by the links found in it ("=> url | text")."""
import sys
from html.parser import HTMLParser

BLOCK = {"p", "div", "br", "li", "h1", "h2", "h3", "h4", "h5", "h6", "tr", "section", "article"}
SKIP = {"script", "style", "noscript", "nav", "footer", "header", "form"}


class P(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.depth = 0  # depth inside the main content
        self.skip = 0
        self.lines, self.cur, self.links, self.href = [], [], [], None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if self.depth:
            self.depth += tag not in {"br", "img", "hr", "meta", "link", "input"}
        elif "entry-content" in (a.get("class") or "").split():
            self.depth = 1
        if tag in SKIP:
            self.skip += 1
        if tag in BLOCK:
            self.flush()
        if tag == "a" and self.depth:
            self.href = a.get("href")
            self.atext = []

    def handle_endtag(self, tag):
        if tag in SKIP and self.skip:
            self.skip -= 1
        if tag in BLOCK:
            self.flush()
        if tag == "a" and self.href:
            self.links.append((self.href, "".join(self.atext).strip()))
            self.href = None
        if self.depth and tag not in {"br", "img", "hr", "meta", "link", "input"}:
            self.depth -= 1

    def handle_data(self, d):
        if self.depth and not self.skip:
            self.cur.append(d)
            if self.href:
                self.atext.append(d)

    def flush(self):
        t = " ".join("".join(self.cur).split())
        if t:
            self.lines.append(t)
        self.cur = []


p = P()
p.feed(sys.stdin.read())
p.flush()
print("\n".join(p.lines))
for h, t in p.links:
    print(f"=> {h} | {t}")
