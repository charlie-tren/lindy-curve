"""Does a decay exist in the full corpus? Print it and read it.

This is the experiment the whole page rests on, and it runs BEFORE any copy is
written. The earlier design mock used a popularity-truncated sample of 1,136 works,
where the median was flat across every century - but that sample could not have shown
a decay, because sampling the most-downloaded end makes every row a survivor by
construction. This runs on all 67,519.

    python tools/analyse.py
"""

import csv
import math
import statistics
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NOW = 2026

rows = list(csv.DictReader(open(ROOT / "data" / "corpus.csv", encoding="utf-8")))
for r in rows:
    r["year"] = int(r["year"])
    r["downloads"] = int(r["downloads"])
    r["age"] = NOW - r["year"]
rows = [r for r in rows if r["age"] > 0]


def spearman(xs, ys):
    def rank(v):
        order = sorted(range(len(v)), key=lambda i: v[i])
        out = [0.0] * len(v)
        i = 0
        while i < len(order):                      # average ties, or the coefficient
            j = i                                  # is distorted by the long flat tail
            while j + 1 < len(order) and v[order[j + 1]] == v[order[i]]:
                j += 1
            avg = (i + j) / 2
            for k in range(i, j + 1):
                out[order[k]] = avg
            i = j + 1
        return out

    rx, ry = rank(xs), rank(ys)
    mx, my = statistics.mean(rx), statistics.mean(ry)
    num = sum((a - mx) * (b - my) for a, b in zip(rx, ry))
    den = math.sqrt(sum((a - mx) ** 2 for a in rx) * sum((b - my) ** 2 for b in ry))
    return num / den if den else float("nan")


print(f"corpus: {len(rows):,} works with a datable author\n")

dl = sorted(r["downloads"] for r in rows)
print("DOWNLOAD DISTRIBUTION (last 30 days, per work)")
for label, f in [("min", 0.0), ("p10", .10), ("p25", .25), ("median", .50),
                 ("p75", .75), ("p90", .90), ("p99", .99), ("max", 1.0)]:
    print(f"  {label:<7}{dl[min(len(dl) - 1, int(len(dl) * f))]:>9,}")
print(f"  {'mean':<7}{statistics.mean(dl):>9,.0f}   "
      f"<- mean is {statistics.mean(dl) / dl[len(dl) // 2]:.1f}x the median, "
      "so the axis must be log")

print("\nSPEARMAN(age, downloads), full corpus")
rho = spearman([r["age"] for r in rows], [r["downloads"] for r in rows])
print(f"  rho = {rho:+.4f}")
print("  positive means OLDER works are read MORE" if rho > 0
      else "  negative means older works are read LESS")

print("\nBY CENTURY")
cent = defaultdict(list)
for r in rows:
    cent[(r["year"] // 100) * 100].append(r["downloads"])
print(f"  {'century':>8} {'works':>7} {'median':>8} {'p75':>8} {'p90':>8} {'max':>9}")
for c in sorted(cent):
    v = sorted(cent[c])
    if len(v) < 5:
        continue
    q = lambda f: v[min(len(v) - 1, int(len(v) * f))]
    lab = f"{abs(c)}BC" if c < 0 else f"{c}s"
    print(f"  {lab:>8} {len(v):>7,} {statistics.median(v):>8,.0f} "
          f"{q(.75):>8,} {q(.90):>8,} {v[-1]:>9,}")

print("\nBY AGE DECILE (equal counts, so no century is over-weighted)")
by_age = sorted(rows, key=lambda r: r["age"])
n = len(by_age) // 10
print(f"  {'decile':>7} {'age range':>16} {'works':>7} {'median dl':>10} {'mean dl':>9}")
for i in range(10):
    chunk = by_age[i * n:(i + 1) * n if i < 9 else len(by_age)]
    a = [c["age"] for c in chunk]
    d = [c["downloads"] for c in chunk]
    print(f"  {i + 1:>7} {f'{min(a)}-{max(a)}':>16} {len(chunk):>7,} "
          f"{statistics.median(d):>10,.0f} {statistics.mean(d):>9,.0f}")

print("\nTHE SELECTION EFFECT, stated numerically")
anc = [r for r in rows if r["age"] > 500]
mod = [r for r in rows if r["age"] <= 200]
print(f"  works older than 500 years : {len(anc):>6,}  "
      f"median {statistics.median([r['downloads'] for r in anc]):>7,.0f}")
print(f"  works 200 years old or less: {len(mod):>6,}  "
      f"median {statistics.median([r['downloads'] for r in mod]):>7,.0f}")
print("  Gutenberg holds only the ancient works someone thought worth digitising,")
print("  and tens of thousands of forgotten recent ones. That is the confound.")

print("\nLANGUAGE MIX (top 6) - an English-heavy corpus is its own bias")
lang = defaultdict(int)
for r in rows:
    lang[r["lang"]] += 1
for k, v in sorted(lang.items(), key=lambda kv: -kv[1])[:6]:
    print(f"  {k:<6}{v:>7,}  {v / len(rows) * 100:>5.1f}%")

print("\nMEDIEVAL GAP - is it real?")
for lo, hi in [(500, 800), (800, 1100), (1100, 1300), (1300, 1500)]:
    c = [r for r in rows if lo <= r["year"] < hi]
    print(f"  {lo}-{hi}: {len(c):>4} works"
          + (f"   e.g. {c[0]['title'][:44]}" if c else "   <- genuinely empty"))
