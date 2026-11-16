#!/usr/bin/env bash
# Downloads the official texts listed in sources.tsv, extracts their text with pdftotext
# (OCR with tesseract when a PDF has no text layer), and lists the PDF links found on
# the index pages. Output goes to data/library/sources/. Run by GitHub Actions, since
# the official sites are not reachable from every environment.
set -u
cd "$(dirname "$0")/../.."
OUT=data/library/sources
mkdir -p "$OUT" /tmp/src
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36'
report="$OUT/_report.tsv"
printf 'id\thttp\tbytes\tpages\ttext_chars\tocr\tsha256\turl\n' > "$report"
grep -v '^#' scripts/library/sources.tsv | while IFS=$'\t' read -r id url; do
  [ -z "$id" ] && continue
  f="/tmp/src/$id.pdf"
  code=$(curl -sSL -m 120 -A "$UA" -o "$f" -w '%{http_code}' "$url" || echo 000)
  bytes=$(stat -c %s "$f" 2>/dev/null || echo 0)
  pages=$(pdfinfo "$f" 2>/dev/null | awk '/^Pages:/{print $2}')
  ocr=no
  pdftotext "$f" "$OUT/$id.txt" 2>/dev/null || : > "$OUT/$id.txt"
  chars=$(tr -d '[:space:]\f' < "$OUT/$id.txt" | wc -c)
  if [ -n "$pages" ] && [ "$chars" -lt $(( pages * 200 )) ]; then
    ocr=yes
    rm -rf /tmp/ocr && mkdir -p /tmp/ocr
    pdftoppm -r 300 -gray -png "$f" /tmp/ocr/p
    : > "$OUT/$id.txt"
    for p in /tmp/ocr/p*.png; do tesseract "$p" - -l fra 2>/dev/null >> "$OUT/$id.txt"; printf '\f' >> "$OUT/$id.txt"; done
    chars=$(tr -d '[:space:]\f' < "$OUT/$id.txt" | wc -c)
  fi
  # Two-column pages (Journal officiel): extract the left and right halves in turn.
  if [ -n "$pages" ] && [ "$ocr" = no ]; then
    : > "$OUT/$id.cols.txt"
    for ((pg=1; pg<=pages; pg++)); do
      read -r w h < <(pdfinfo -f $pg -l $pg "$f" | awk '/^Page.*size:/{print int($4), int($6); exit}')
      half=$(( w / 2 ))
      pdftotext -f $pg -l $pg -x 0 -y 0 -W $half -H $h "$f" - >> "$OUT/$id.cols.txt" 2>/dev/null
      pdftotext -f $pg -l $pg -x $half -y 0 -W $(( w - half )) -H $h "$f" - >> "$OUT/$id.cols.txt" 2>/dev/null
    done
  fi
  sha=$(sha256sum "$f" | cut -c1-16)
  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$id" "$code" "$bytes" "${pages:-0}" "$chars" "$ocr" "$sha" "$url" >> "$report"
done
: > "$OUT/_links.txt"
while read -r page; do
  [ -z "$page" ] && continue
  echo "## $page" >> "$OUT/_links.txt"
  curl -sSL -m 60 -A "$UA" "$page" | grep -oiE 'href="[^"]*\.pdf"' | sed 's/^href="//;s/"$//' | sort -u >> "$OUT/_links.txt" || true
done < scripts/library/index-pages.txt
cat "$report"
