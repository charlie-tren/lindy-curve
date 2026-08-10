"""Turn the corpus into everything the page needs, and write it where I can read it.

    python tools/compute.py

Output is `data/derived.json`. Nothing downstream touches `corpus.csv`, so the page can
only ever show numbers that appear in a file I can open and check.

THE FINDING THIS ENCODES, measured on all 67,519 works before any copy was written:

  Spearman(age, downloads) over the whole corpus is +0.111 - which reads as "older
  works are read MORE". That number is an artefact. 61.5% of the corpus sits in a tight
  band between 300 and 600 downloads a month, and Gutenberg does not document what that
  baseline is; it is far too uniform across 41,520 obscure works to be human readership.
  Raise a floor through it and the correlation collapses and changes sign:

      floor      n        rho
      none    67,519   +0.111
      600     15,968   -0.025
      1,000    6,705   -0.101
      2,000    3,799   -0.054
      5,000    2,334   +0.056

  So the answer is neither the decay the classic curve draws nor the rise the naive
  number suggests: age does not predict how much a surviving work is read. The site's
  job is to show that honestly, which is why the floor is a CONTROL on the page rather
  than a decision buried in this file.
"""

import csv
import json
import math
import statistics
from collections import defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NOW = 2026

# The threshold slider is gone (Charlie's call): every chart is the whole corpus.
# The baseline floor is still real - it is now disclosed in the methodology and
# cross-checked against Wikipedia pageviews, which have no floor at all.
FLOORS = [0]

# Readership bars the second chart counts books above.
THRESHOLDS = [200, 600, 1000, 2000, 5000, 10000]

# Works worth naming on the charts: recognisable, and spread across the age axis.
CALLOUTS = ["Moby Dick", "Pride and Prejudice", "Romeo and Juliet", "The Odyssey",
            "Meditations", "The Iliad", "Frankenstein", "The Republic",
            "Beowulf", "The Divine Comedy", "Don Quixote", "The Prince",
            "Confessions", "The Art of War", "Walden", "Ulysses",
            "The Canterbury Tales", "Leviathan", "Faust", "Aesop"]


def spearman(xs, ys):
    """Tie-corrected. Without the tie averaging the flat baseline distorts this badly."""
    def rank(v):
        order = sorted(range(len(v)), key=lambda i: v[i])
        out = [0.0] * len(v)
        i = 0
        while i < len(order):
            j = i
            while j + 1 < len(order) and v[order[j + 1]] == v[order[i]]:
                j += 1
            for k in range(i, j + 1):
                out[order[k]] = (i + j) / 2
            i = j + 1
        return out

    rx, ry = rank(xs), rank(ys)
    mx, my = statistics.mean(rx), statistics.mean(ry)
    num = sum((a - mx) * (b - my) for a, b in zip(rx, ry))
    den = math.sqrt(sum((a - mx) ** 2 for a in rx) * sum((b - my) ** 2 for b in ry))
    return num / den if den else 0.0


def load():
    rows = []
    with open(ROOT / "data" / "corpus.csv", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            y, d = int(r["year"]), int(r["downloads"])
            if NOW - y <= 0 or d <= 0:
                continue
            rows.append({"y": y, "d": d, "a": NOW - y, "t": r["title"],
                         "au": r["author"], "l": r["lang"], "id": int(r["id"]),
                         "s": r.get("subject", "other")})
    return rows


def century_stats(rows, min_n=5):
    c = defaultdict(list)
    for r in rows:
        c[(r["y"] // 100) * 100].append(r["d"])
    out = []
    for k in sorted(c):
        v = sorted(c[k])
        if len(v) < min_n:
            continue
        out.append({"c": k, "n": len(v), "med": round(statistics.median(v)),
                    "p25": v[int(len(v) * .25)], "p75": v[int(len(v) * .75)]})
    return out


def ridge(rows, bins=26, lo=2.3, hi=5.3, min_n=12):
    """log10(downloads) histogram per century, for the stacked ridgeline."""
    c = defaultdict(list)
    for r in rows:
        c[(r["y"] // 100) * 100].append(r["d"])
    out = []
    for k in sorted(c):
        v = c[k]
        if len(v) < min_n:
            continue
        h = [0] * bins
        for d in v:
            b = int((math.log10(d) - lo) / (hi - lo) * (bins - 1))
            h[min(bins - 1, max(0, b))] += 1
        sm = [(h[max(0, i - 1)] + 2 * h[i] + h[min(bins - 1, i + 1)]) / 4
              for i in range(bins)]
        peak = max(sm) or 1
        out.append({"c": k, "n": len(v),
                    "h": [round(x / peak, 3) for x in sm],
                    "med": round(statistics.median(v))})
    return {"lo": lo, "hi": hi, "bins": bins, "rows": out}


def scatter(rows, cap=4600):
    """Decimated for the browser on ONE uniform stride, deterministically.

    The first version kept every work above 1,500 downloads and only every 94th below
    it. That put a hard horizontal edge across the plot at exactly 1,500 - a visitor
    would read it as real structure in the data when it was purely an artefact of how I
    sampled. A single stride over the whole corpus keeps density proportional
    everywhere, which costs some of the interesting upper tail; the named works are
    drawn separately on top, so nothing recognisable is lost.

    Sorted by Gutenberg id rather than downloads so the stride is not correlated with
    the thing being plotted, and reproducible so a rebuild does not reshuffle the cloud.
    """
    ordered = sorted(rows, key=lambda r: r["id"])
    stride = max(1, len(ordered) // cap)
    keep = ordered[::stride]
    return ([{"a": r["a"], "d": r["d"], "t": r["t"][:52], "l": r["l"], "s": r["s"],
              "au": r["au"].split(",")[0][:26]} for r in keep],
            {"kept": len(keep), "of": len(rows), "stride": stride,
             "uniform": True})


TITLES = []
_TIDX = {}


def intern_title(t, au):
    """Shelf titles repeat, so intern them rather than restating each one."""
    key = (t, au)
    if key not in _TIDX:
        _TIDX[key] = len(TITLES)
        TITLES.append([t, au])
    return _TIDX[key]


def shelf(rows, buckets=None):
    """How many books from each CENTURY clear a readership bar.

    Charlie's spec: keep only books read more than X times a month, then just count them
    per period. Simple, and it answers a question the earlier versions could not - where
    do the books people actually still read come from?

    Read it knowing it is a raw count, so it reflects what Gutenberg HOLDS as much as
    what endures: there are 27,719 works from the 1800s and 134 from the whole medieval
    period, so the recent centuries will tower whatever the truth about endurance is.
    The tooltip carries the share of each century as well as the count, which is the
    rate-based reading of the same bar.

    Two earlier versions of this chart were wrong: the first plotted the single
    most-downloaded work per age slot (a maximum, so one outlier set every bar and it drew
    the canon rather than the corpus); the second plotted a median, which was honest but
    so flat it said very little.
    """
    per = defaultdict(list)
    for r in rows:
        per[(r["y"] // 100) * 100].append(r)
    out = []
    for c in sorted(per):
        chunk = per[c]
        if len(chunk) < 5:
            continue
        top = max(chunk, key=lambda r: r["d"])
        # the current century is only 26 years old, so a raw count understates it by
        # roughly four. Every bar is therefore scaled to a per-100-years rate.
        span = min(c + 100, NOW) - c
        scale = 100.0 / span if span > 0 else 1.0
        out.append({
            "c": c,
            "n": len(chunk),
            "span": span,
            "cnt": {str(t): sum(1 for r in chunk if r["d"] >= t) for t in THRESHOLDS},
            "rate": {str(t): round(sum(1 for r in chunk if r["d"] >= t) * scale)
                     for t in THRESHOLDS},
            "y": c + 50,
            "i": intern_title(top["t"][:95], top["au"].split(",")[0][:30]),
        })
    return {"bars": out, "thresholds": THRESHOLDS}


def callouts(rows):
    seen, out = set(), []
    for r in sorted(rows, key=lambda r: -r["d"]):
        for name in CALLOUTS:
            if name in seen or name.lower() not in r["t"].lower():
                continue
            seen.add(name)
            out.append({"n": name, "a": r["a"], "d": r["d"], "y": r["y"],
                        "au": r["au"].split(",")[0], "t": r["t"], "id": r["id"]})
            break
    return sorted(out, key=lambda o: -o["a"])


def wiki_block(rows):
    """The independent measure: Wikipedia pageviews for works we could match.

    Gutenberg's count has a baseline floor; pageviews do not, and they run monthly back
    to 2016 so they also give the multi-year average Gutenberg cannot. It counts readers
    of the ARTICLE ABOUT a work rather than the work, which is why it is a cross-check
    rather than the main axis.
    """
    path = ROOT / "data" / "wiki.json"
    if not path.exists():
        return None
    cache = json.loads(path.read_text(encoding="utf-8"))
    ok = [v for v in cache.values() if v.get("ok")]
    if len(ok) < 20:
        return None
    age = [NOW - v["y"] for v in ok]
    return {
        "n": len(ok),
        "tried": len(cache),
        "rho_wiki": round(spearman(age, [v["peryear"] for v in ok]), 4),
        "rho_gut": round(spearman(age, [v["d"] for v in ok]), 4),
        "rho_agree": round(spearman([v["d"] for v in ok],
                                    [v["peryear"] for v in ok]), 4),
        "med_old": round(statistics.median(
            [v["peryear"] for v in ok if NOW - v["y"] > 300] or [0])),
        "n_old": sum(1 for v in ok if NOW - v["y"] > 300),
        "med_new": round(statistics.median(
            [v["peryear"] for v in ok if NOW - v["y"] <= 300] or [0])),
        "n_new": sum(1 for v in ok if NOW - v["y"] <= 300),
        "points": sorted([{"a": NOW - v["y"], "w": v["peryear"], "d": v["d"],
                           "t": v["t"][:46], "art": v["art"][:40]} for v in ok],
                         key=lambda x: -x["w"]),
    }


def main():
    rows = load()
    dl = sorted(r["d"] for r in rows)

    states = []
    for fl in FLOORS:
        sub = [r for r in rows if r["d"] >= fl]
        if len(sub) < 200:
            continue
        states.append({
            "floor": fl,
            "n": len(sub),
            "rho": round(spearman([r["a"] for r in sub], [r["d"] for r in sub]), 4),
            "med": round(statistics.median([r["d"] for r in sub])),
            "centuries": century_stats(sub),
            "shelf": shelf(sub),
        })

    pts, meta = scatter(rows)
    oldest = sorted(rows, key=lambda r: -r["a"])[:12]

    out = {
        "generated": None,          # stamped by build.py; time is unavailable here
        "corpus": {
            "works": len(rows),
            "median": dl[len(dl) // 2],
            "p25": dl[len(dl) // 4],
            "p75": dl[int(len(dl) * .75)],
            "max": dl[-1],
            "baseline_share": round(sum(1 for d in dl if 300 <= d < 600) / len(dl), 4),
            "under600": sum(1 for d in dl if d < 600),
            "oldest_age": max(r["a"] for r in rows),
            "langs": sorted(
                [{"l": k, "n": v} for k, v in
                 ((k, sum(1 for r in rows if r["l"] == k))
                  for k in {r["l"] for r in rows})],
                key=lambda x: -x["n"])[:6],
        },
        "states": states,
        "scatter": {"points": pts, "meta": meta},
        "wiki": wiki_block(rows),
        "titles": TITLES,
        "callouts": callouts(rows),
        "oldest": [{"t": r["t"][:70], "au": r["au"].split(",")[0], "y": r["y"],
                    "d": r["d"]} for r in oldest],
    }

    dest = ROOT / "data" / "derived.json"
    dest.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")),
                    encoding="utf-8")

    # A 30-day download window is seasonal - set texts spike in term time - so one run
    # is a snapshot, not a trend. Appending here is what eventually makes the noise
    # measurable, and the page says it happens, so it has to actually happen.
    hist = ROOT / "data" / "history.csv"
    cols = ["date", "works", "median", "rho_all", "rho_600", "rho_1000",
            "baseline_share"]
    by_floor = {s["floor"]: s for s in states}
    row = {
        "date": date.today().isoformat(),
        "works": len(rows),
        "median": dl[len(dl) // 2],
        "rho_all": by_floor[0]["rho"] if 0 in by_floor else "",
        "rho_600": by_floor[600]["rho"] if 600 in by_floor else "",
        "rho_1000": by_floor[1000]["rho"] if 1000 in by_floor else "",
        "baseline_share": out["corpus"]["baseline_share"],
    }
    new = not hist.exists()
    with open(hist, "a", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        if new:
            w.writeheader()
        w.writerow(row)
    print(f"appended to {hist.relative_to(ROOT)}: {row}\n")

    print(f"wrote {dest.relative_to(ROOT)}  {dest.stat().st_size / 1e6:.2f}MB")
    print(f"corpus {out['corpus']['works']:,} works, "
          f"baseline band = {out['corpus']['baseline_share'] * 100:.1f}% of it\n")
    print(f"{'floor':>7} {'n':>7} {'rho':>8} {'median':>7}  centuries")
    for s in states:
        print(f"{s['floor']:>7,} {s['n']:>7,} {s['rho']:>+8.4f} {s['med']:>7,}  "
              f"{len(s['centuries']):>2}")
    print(f"\nscatter: {meta['kept']:,} points of {meta['of']:,}, "
          f"one uniform stride of {meta['stride']}")
    print(f"callouts: {len(out['callouts'])} named works")
    for c in out["callouts"][:6]:
        print(f"   {c['y']:>6}  {c['d']:>7,}  {c['n']}")


if __name__ == "__main__":
    main()
