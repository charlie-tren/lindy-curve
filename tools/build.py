"""Render docs/index.html from data/derived.json.

    python tools/compute.py && python tools/build.py

The page is static and self-contained: no build step in the browser, no external
requests, all numbers baked in at build time. The only thing the browser computes is
which precomputed threshold state to show.
"""

import csv
import json
import math
import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NOW = 2026


def hero_svg(callouts, w=960, h=340):
    """The classic Lindy curve, drawn, with real works placed on it by age.

    AXIS DIRECTION, which was got wrong once and is easy to get wrong again: x is AGE
    and it rises to the RIGHT. Newest at the left on the steep shoulder, most ancient at
    the right out in the flat tail. The works that endured have to land in the tail,
    because that is the entire claim of the picture. A y-axis label is mandatory - the
    inversion went unnoticed the first time precisely because there was nothing for the
    placement to contradict.
    """
    L, R, T, B = 60, 30, 46, 56
    k = 0.085
    f2y = lambda f: T + (1 - k / (f + k)) * (h - T - B)
    pts = [f"{L + i / 220 * (w - L - R):.1f},{f2y(i / 220):.1f}" for i in range(221)]
    o = [f'<svg viewBox="0 0 {w} {h}" role="img" aria-label="The classic Lindy curve '
         'with real works placed on it by age">']
    o.append(f'<path class="cvf" d="M{L},{h - B} L' + " L".join(pts)
             + f' L{w - R},{h - B} Z"/>')
    o.append('<path class="cv" d="M' + " L".join(pts) + '"/>')

    # Spread the labels across the whole age range, keeping BOTH ends. Slicing the
    # first nine of an age-sorted list quietly dropped the oldest work - which is the
    # one label the picture exists to place, out in the tail.
    # One label per age: Homer's Iliad and Odyssey share a date, so without this two
    # labels land on the same x and overprint each other. Keep the more-read of a tie.
    best = {}
    for c in callouts:
        if c["a"] > 20 and c["d"] > best.get(c["a"], {"d": -1})["d"]:
            best[c["a"]] = c
    usable = [best[a] for a in sorted(best)]
    want = min(9, len(usable))
    idx = sorted({round(i * (len(usable) - 1) / (want - 1)) for i in range(want)})
    picks = [usable[i] for i in idx]
    ages = [math.log10(c["a"]) for c in picks]
    lo, hi = min(ages), max(ages)
    for i, (c, a) in enumerate(zip(picks, ages)):
        f = 0.05 + (a - lo) / (hi - lo) * 0.90
        x, y = L + f * (w - L - R), f2y(f)
        # The curve only ever descends left to right, so a label must extend RIGHTWARD
        # from its mark, into the region where the curve is lower, and sit above the
        # mark. Centring it ran the left half of "Ulysses" straight through the steep
        # shoulder; putting labels below the line instead put them in the shaded fill.
        dy = -13 if i % 2 == 0 else -28
        anchor = "end" if i == len(picks) - 1 else "start"
        lx = x + (0 if anchor == "end" else 7)
        # the detail rides on data attributes rather than a <title>, which the browser
        # would show as its own tooltip in the moment before the page script runs
        o.append(f'<circle class="mk" cx="{x:.1f}" cy="{y:.1f}" r="4.5" '
                 f'data-title="{c["t"][:70]}" data-dl="{c["d"]:,}"/>')
        o.append(f'<text class="mkl" x="{lx:.1f}" y="{y + dy:.1f}" '
                 f'text-anchor="{anchor}">{c["n"]}</text>')

    tx = L + 0.66 * (w - L - R)
    o.append(f'<text class="note" x="{tx:.0f}" y="{f2y(0.66) - 62:.1f}">'
             'where great ideas live</text>')
    # the leader has to end ON the curve - it pointed off into empty space before
    # ends BELOW the curve, inside the shaded area, rather than hovering above it
    o.append(f'<line class="lead" x1="{tx + 34:.0f}" y1="{f2y(0.66) - 54:.1f}" '
             f'x2="{L + 0.76 * (w - L - R):.0f}" y2="{f2y(0.76) + 8:.1f}"/>')
    o.append(f'<line class="g" x1="{L}" y1="{h - B}" x2="{w - R}" y2="{h - B}"/>')
    o.append(f'<text class="axl" x="{L}" y="{h - B + 20}">NEWER</text>')
    o.append(f'<text class="axl" x="{w - R}" y="{h - B + 20}" '
             'text-anchor="end">OLDER</text>')
    o.append(f'<text class="axl" transform="rotate(-90 {L - 22} {(T + h - B) / 2:.0f})" '
             f'x="{L - 22}" y="{(T + h - B) / 2:.0f}" text-anchor="middle">'
             'NO. BOOKS STILL BEING READ</text>')
    o.append("</svg>")
    return "\n".join(o)


def corpus_facts():
    """The handful of counts quoted in the methodology, read from the corpus itself."""
    ancient = medieval = c19 = en = total = 0
    with open(ROOT / "data" / "corpus.csv", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            y = int(r["year"])
            if NOW - y <= 0:
                continue
            total += 1
            if NOW - y > 500:
                ancient += 1
            if 500 <= y < 1300:
                medieval += 1
            if 1800 <= y < 1900:
                c19 += 1
            if r["lang"] == "en":
                en += 1
    return {"ancient": ancient, "medieval": medieval, "c19": c19,
            "en_share": en / total * 100, "total": total}


def main():
    derived = json.loads((ROOT / "data" / "derived.json").read_text(encoding="utf-8"))
    tpl = (ROOT / "tools" / "template.html").read_text(encoding="utf-8")
    f = corpus_facts()
    c = derived["corpus"]

    derived["generated"] = date.today().isoformat()
    subs = {
        "DATA": json.dumps(derived, ensure_ascii=False, separators=(",", ":")),
        "WORKS": f"{c['works']:,}",
        "MAXI": str(len(derived["states"]) - 1),
        "BASELINE": f"{c['baseline_share'] * 100:.1f}",
        "UNDER600": f"{c['under600']:,}",
        "ANCIENT": f"{f['ancient']:,}",
        "MEDIEVAL": f"{f['medieval']:,}",
        "C19": f"{f['c19']:,}",
        "ENSHARE": f"{f['en_share']:.0f}",
        "GENERATED": date.today().strftime("%d/%m/%Y"),
    }
    js = (ROOT / "tools" / "page.js").read_text(encoding="utf-8")
    out = tpl.replace("%%HERO%%", hero_svg(derived["callouts"]))
    out = out.replace("%%SCRIPT%%", js)
    for k, v in subs.items():
        out = out.replace(f"%%{k}%%", v)

    left = re.findall(r"%%\w+%%", out)
    if left:
        sys.exit(f"unsubstituted placeholders: {sorted(set(left))}")
    bad = [ch for ch in out if ch in "—–"]
    if bad:
        sys.exit(f"{len(bad)} em/en dash characters in the output")

    docs = ROOT / "docs"
    docs.mkdir(exist_ok=True)
    (docs / "index.html").write_text(out, encoding="utf-8", newline="\n")
    (docs / ".nojekyll").write_text("", encoding="utf-8")

    kb = (docs / "index.html").stat().st_size / 1024
    print(f"wrote docs/index.html  {kb:.0f}KB")
    print(f"  {c['works']:,} works, {len(derived['states'])} threshold states, "
          f"{len(derived['callouts'])} named works")
    print(f"  baseline band {subs['BASELINE']}% of corpus, "
          f"{subs['UNDER600']} works under 600/month")
    print(f"  quoted in methodology: {subs['ANCIENT']} works >500yrs, "
          f"{subs['MEDIEVAL']} medieval, {subs['C19']} from the 1800s, "
          f"{subs['ENSHARE']}% English")


if __name__ == "__main__":
    main()
