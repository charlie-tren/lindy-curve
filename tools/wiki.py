"""Wikipedia pageviews for the best-known works: a second, independent measure.

    python tools/wiki.py            # uses the cache
    python tools/wiki.py --refresh  # re-resolve titles and re-pull views

WHY THIS EXISTS. Gutenberg's download count has a floor: 61.5% of the corpus sits between
300 and 600 a month, too uniform to be readers, and the age/readership correlation changes
sign depending on where you cut through it. That is the weakest joint in the whole finding,
so it needs a measure that does not share the flaw.

Wikipedia pageviews do not. They are free and keyless, run monthly back to January 2016,
and have no baseline floor. They also answer the "average yearly reads" question that
Gutenberg cannot, because Gutenberg publishes one rolling 30-day number and no history.

WHAT IT IS NOT. This counts people reading the ARTICLE ABOUT a work, not people reading
the work. That is a different quantity - closer to cultural presence than readership - and
the page says so. It is a cross-check, not a replacement.

THE HARD PART is matching a Gutenberg record to a Wikipedia article. Titles disagree
("Meditations" vs "Meditations (Marcus Aurelius)"), Gutenberg holds multiple editions of
one work, and the search API happily returns an article about something else. Every match
is therefore resolved through search, scored, and stored in data/wiki.json with the score
so a bad match can be found and blacklisted rather than silently believed.
"""

import argparse
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "data" / "wiki.json"
UA = {"User-Agent": "lindy-curve/1.0 (+https://charlietrenorden.com)"}
START, END = "2016010100", "2026070100"
TOP_N = 5000         # match rate falls with fame; this should clear 1,000 matched

# Matches that search gets wrong in a way scoring cannot catch.
BLOCK = {"The Bible", "Bible", "Book", "Novel", "Poetry"}


def get(url, timeout=45):
    req = urllib.request.Request(url, headers=UA)
    return json.load(urllib.request.urlopen(req, timeout=timeout))


def norm(s):
    s = re.sub(r"\(.*?\)", " ", s.lower())
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def score(title, author, art):
    """How much do we believe this article is that work? 0 to 1."""
    t, a, x = norm(title), norm(author), norm(art)
    if not x:
        return 0.0
    tw, xw = set(t.split()), set(x.split())
    if not tw:
        return 0.0
    overlap = len(tw & xw) / len(tw)
    bonus = 0.0
    if x.startswith(t[:24]) or t.startswith(x[:24]):
        bonus += 0.25
    surname = a.split()[0] if a else ""
    if surname and surname in x:
        bonus += 0.15                       # "Meditations (Marcus Aurelius)"
    return min(1.0, overlap + bonus)


def resolve(title, author):
    """Search Wikipedia and return (article, score) for the best candidate."""
    q = re.sub(r"\s*[;:].*$", "", title)[:60]
    if author:
        q += " " + author.split(",")[0]
    url = ("https://en.wikipedia.org/w/api.php?action=query&list=search&format=json"
           "&srlimit=5&srsearch=" + urllib.parse.quote(q))
    try:
        hits = get(url)["query"]["search"]
    except Exception:
        return None, 0.0
    best, bs = None, 0.0
    for h in hits:
        art = h["title"]
        # a disambiguation page or an episode list is never the work itself
        if art in BLOCK or "(disambiguation)" in art or art.startswith("List of"):
            continue
        s = score(title, author, art)
        if s > bs:
            best, bs = art, s
    return best, bs


def views(article):
    """Monthly pageviews. Returns (total, months, per_year) or None."""
    url = ("https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/"
           "en.wikipedia/all-access/user/"
           + urllib.parse.quote(article.replace(" ", "_"), safe="")
           + f"/monthly/{START}/{END}")
    try:
        items = get(url)["items"]
    except Exception:
        return None
    if not items:
        return None
    total = sum(i["views"] for i in items)
    months = len(items)
    return total, months, round(total / (months / 12)) if months else 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--refresh", action="store_true")
    args = ap.parse_args()

    cache = {}
    if CACHE.exists() and not args.refresh:
        cache = json.loads(CACHE.read_text(encoding="utf-8"))
        print(f"cache holds {len(cache)} resolved works - pass --refresh to redo")

    import csv
    rows = []
    with open(ROOT / "data" / "corpus.csv", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            rows.append(r)
    rows.sort(key=lambda r: -int(r["downloads"]))

    seen, todo = set(), []
    for r in rows:
        key = norm(r["title"])[:48]
        if not key or key in seen:
            continue
        seen.add(key)
        todo.append(r)
        if len(todo) >= TOP_N:
            break

    got = skipped = 0
    for i, r in enumerate(todo, 1):
        pid = r["id"]
        if pid in cache:
            got += 1
            continue
        art, sc = resolve(r["title"], r["author"])
        if not art or sc < 0.55:
            cache[pid] = {"ok": False, "why": "no confident match",
                          "art": art, "score": round(sc, 2), "t": r["title"][:60]}
            skipped += 1
        else:
            v = views(art)
            if not v:
                cache[pid] = {"ok": False, "why": "no pageviews", "art": art,
                              "score": round(sc, 2), "t": r["title"][:60]}
                skipped += 1
            else:
                cache[pid] = {"ok": True, "art": art, "score": round(sc, 2),
                              "total": v[0], "months": v[1], "peryear": v[2],
                              "t": r["title"][:60], "y": int(r["year"]),
                              "d": int(r["downloads"])}
                got += 1
            time.sleep(0.08)
        if i % 25 == 0:
            print(f"  {i}/{len(todo)}  matched {got}  skipped {skipped}")
            CACHE.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")

    CACHE.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
    ok = [v for v in cache.values() if v.get("ok")]
    print(f"\nwrote {CACHE.relative_to(ROOT)}  {len(ok)} matched of {len(cache)} tried")
    print("\ntop by Wikipedia views a year:")
    for v in sorted(ok, key=lambda v: -v["peryear"])[:10]:
        print(f"  {v['peryear']:>9,}/yr  {v['d']:>7,} dl  {v['y']:>5}  "
              f"{v['t'][:38]:<38} -> {v['art'][:30]}")
    print("\nlowest-confidence matches kept (check these):")
    for v in sorted(ok, key=lambda v: v["score"])[:6]:
        print(f"  score {v['score']}  {v['t'][:40]:<40} -> {v['art'][:34]}")


if __name__ == "__main__":
    main()
