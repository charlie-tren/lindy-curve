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

    # SELECTION is where crowding has to be solved, not placement. Spreading evenly by
    # INDEX through the age-sorted list put marks as little as 25px apart, and then no
    # label position exists that is both near its own dot and clear of its neighbour -
    # a label pushed off its neighbour reads as detached, one left near it reads as a
    # pair. So pick by horizontal SEPARATION instead and accept fewer labels.
    # Labels extend rightward from their mark, so a pair needs the left one's full width
    # between them; the final label extends leftward (it would overrun the right edge
    # otherwise), so its gap has to fit two label widths. Both ends are always kept.
    # Swept against the rendered result: 85 keeps six labels with 43px between the
    # closest pair, 95 drops to five. Below 85 they start reading as pairs again.
    MINSEP, LASTSEP = 85, 150
    ages_all = [math.log10(c["a"]) for c in usable]
    lo, hi = min(ages_all), max(ages_all)
    xf = lambda a: L + (0.05 + (a - lo) / (hi - lo) * 0.90) * (w - L - R)

    keep = [0]
    for i in range(1, len(usable) - 1):
        if xf(ages_all[i]) - xf(ages_all[keep[-1]]) >= MINSEP and len(keep) < 8:
            keep.append(i)
    last = len(usable) - 1
    while len(keep) > 1 and xf(ages_all[last]) - xf(ages_all[keep[-1]]) < LASTSEP:
        keep.pop()
    keep.append(last)

    picks = [usable[i] for i in keep]
    ages = [ages_all[i] for i in keep]
    # PLACEMENT. Each label sits as close to its mark as it can while clearing two
    # things: the curve, and the label before it. Fixed alternating offsets were the
    # earlier approach and they read as detached - half the labels floated well above a
    # curve they had no need to avoid. So the gap is derived, not chosen: start at the
    # minimum that clears the dot, and lift only on an actual collision.
    # The curve descends left to right, so a label must extend RIGHTWARD from its mark
    # (a centred label ran its left half through the steeper part above the mark) and sit
    # above it (below the line is inside the shaded fill).
    # The lift on collision happens in the browser (see heroLabels in page.js), which
    # has real text metrics. Estimating character widths here detected only some of the
    # collisions, and a stale estimate would silently overlap again on the next refresh.
    GAP = 9.0
    for i, (c, a) in enumerate(zip(picks, ages)):
        f = 0.05 + (a - lo) / (hi - lo) * 0.90
        x, y = L + f * (w - L - R), f2y(f)
        last = i == len(picks) - 1
        anchor = "end" if last else "start"
        lx = x if last else x + 7
        dy = -GAP

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
