"""End-to-end checks against the built page in a real browser.

    python tests/smoke.py

Self-contained: picks a free port, serves docs/, tears the server down. Every check
here failed at least once during the build, which is the only reason to keep it.
"""

import http.server
import json
import socket
import socketserver
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
fails = []


def check(ok, msg):
    if not ok:
        fails.append(msg)
    return ok


def serve():
    class H(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **k):
            super().__init__(*a, directory=str(DOCS), **k)

        def log_message(self, *a):
            pass

    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    srv = socketserver.TCPServer(("127.0.0.1", port), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f"http://127.0.0.1:{port}/"


def main():
    derived = json.loads((ROOT / "data" / "derived.json").read_text(encoding="utf-8"))
    # Several works can share the oldest date (Homer's two epics do), and the hero keeps
    # only one of them, so accept any label at the maximum age rather than a fixed title.
    max_age = max(c["a"] for c in derived["callouts"])
    oldest_names = [c["n"] for c in derived["callouts"] if c["a"] == max_age]

    srv, url = serve()
    try:
        with sync_playwright() as p:
            b = p.chromium.launch()
            for theme, w, h in [("dark", 1280, 900), ("light", 1280, 900),
                                ("dark", 375, 812)]:
                tag = f"{theme}/{w}"
                ctx = b.new_context(viewport={"width": w, "height": h},
                                    color_scheme=theme)
                pg = ctx.new_page()
                errs = []
                pg.on("console", lambda m: m.type == "error" and errs.append(m.text))
                pg.on("pageerror", lambda e: errs.append(str(e)))
                pg.goto(url, wait_until="load")
                pg.wait_for_timeout(700)

                check(not errs, f"{tag}: console errors {errs[:2]}")

                sw = pg.evaluate("document.documentElement.scrollWidth")
                iw = pg.evaluate("window.innerWidth")
                check(sw <= iw + 1, f"{tag}: page pans sideways {sw} > {iw}")

                # the hero must place the OLDEST work in the flat tail on the right.
                # This is the axis inversion that shipped once in a mock; it went
                # unnoticed because there was no y-axis label to contradict it.
                pos = pg.evaluate(
                    """(names) => {
                        const t = [...document.querySelectorAll('#v-curve .mkl')]
                          .find(e => names.includes(e.textContent.trim()));
                        if (!t) return null;
                        const svg = t.closest('svg');
                        return {name: t.textContent.trim(), x: +t.getAttribute('x'),
                                w: svg.viewBox.baseVal.width};
                    }""", oldest_names)
                if check(pos is not None,
                         f"{tag}: no oldest work ({'/'.join(oldest_names)}, {max_age}yrs) "
                         "labelled in the hero"):
                    check(pos["x"] > pos["w"] / 2,
                          f"{tag}: AXIS INVERTED - oldest work '{pos['name']}' "
                          f"({max_age}yrs) at x={pos['x']:.0f} of {pos['w']}, "
                          "should be past halfway in the flat tail")
                check(pg.locator("#v-curve text", has_text="STILL READ").count() > 0,
                      f"{tag}: hero has no y-axis label")

                # SAME GUARD ON THE SHELF. Age rises to the right there too, and the
                # hero-only version of this check missed the inversion when the shelf was
                # added. Reads data-year off the bars - the corpus's oldest work is a
                # Chinese text from 1105 BC, so a title-based assertion was wrong too.
                shelf = pg.evaluate("""() => {
                    const rs = [...document.querySelectorAll('#shelf rect[data-year]')];
                    if (rs.length < 4) return null;
                    const o = rs.map(r => ({x: +r.getAttribute('x'),
                                            yr: +r.getAttribute('data-year')}))
                                .sort((a, b) => a.x - b.x);
                    return {left: o[0].yr, right: o[o.length - 1].yr, n: o.length};
                }""")
                if check(shelf is not None, f"{tag}: shelf bars carry no year data"):
                    check(shelf["right"] < shelf["left"],
                          f"{tag}: SHELF AXIS INVERTED - leftmost bar is {shelf['left']}, "
                          f"rightmost is {shelf['right']}; age must rise to the right, "
                          "matching the curve above it")

                # every view draws something
                counts = pg.evaluate("""() => ({
                    med: document.querySelectorAll('#medchart .medpt').length,
                    medpath: document.querySelectorAll('#medchart path.med').length,
                    pts: document.querySelectorAll('#scatter circle.pt').length,
                    hi: document.querySelectorAll('#scatter circle.hi').length,
                    bars: document.querySelectorAll('#shelf rect').length,
                    spread: document.querySelectorAll('#spread path').length,
                    details: document.querySelectorAll('.method details').length,
                })""")
                check(counts["medpath"] == 1, f"{tag}: median line missing")
                check(counts["med"] >= 20,
                      f"{tag}: only {counts['med']} century points")
                check(counts["pts"] > 4000, f"{tag}: only {counts['pts']} scatter points")
                check(counts["hi"] >= 5, f"{tag}: only {counts['hi']} named works plotted")
                check(counts["bars"] >= 40, f"{tag}: only {counts['bars']} shelf bars")
                check(counts["spread"] >= 2,
                      f"{tag}: spread chart has {counts['spread']} paths, need a band "
                      "and a median line")
                check(counts["details"] == 6,
                      f"{tag}: {counts['details']} methodology sections, expected 6")

                # the slider must actually change the finding, not just the label
                before = pg.evaluate("""() => ({
                    rho: document.getElementById('rho').textContent,
                    n: document.getElementById('nread').textContent,
                    bars: document.querySelectorAll('#shelf rect').length,
                })""")
                pg.eval_on_selector("#floor", """el => {
                    el.value = String(Math.min(5, +el.max));
                    el.dispatchEvent(new Event('input', {bubbles: true}));
                }""")
                pg.wait_for_timeout(250)
                after = pg.evaluate("""() => ({
                    rho: document.getElementById('rho').textContent,
                    n: document.getElementById('nread').textContent,
                    bars: document.querySelectorAll('#shelf rect').length,
                })""")
                check(before["rho"] != after["rho"],
                      f"{tag}: rho unchanged by the slider ({before['rho']})")
                check(before["n"] != after["n"], f"{tag}: work count unchanged by slider")
                # and the sign really does flip somewhere, which is the whole point
                signs = {("+" if s["rho"] >= 0 else "-") for s in derived["states"]}
                check(len(signs) == 2,
                      f"{tag}: rho never changes sign across thresholds - "
                      "the page's central claim would be wrong")

                # tabs
                for tab, view in [("t-scatter", "v-scatter"), ("t-ridge", "v-ridge"),
                                  ("t-curve", "v-curve")]:
                    pg.click(f"#{tab}")
                    pg.wait_for_timeout(120)
                    on = pg.evaluate(f"document.getElementById('{view}')"
                                     ".classList.contains('on')")
                    check(on, f"{tag}: clicking #{tab} did not open #{view}")

                check(pg.locator("footer a.back .arw").count() == 1,
                      f"{tag}: the Other projects link has no arrow")

                # THE REGRESSION THAT MATTERS: Charlie chose the cream design, and an OS
                # set to dark meant he never saw it. Cream must be the default in BOTH
                # browser preferences; dark is opt-in via the toggle only.
                theme = pg.evaluate("document.documentElement.getAttribute('data-theme')")
                check(theme == "light",
                      f"{tag}: default theme is '{theme}', must be light (cream) "
                      "regardless of the browser preference")
                check(pg.locator("#tog").count() == 1, f"{tag}: no theme toggle")
                pg.click("#tog")
                pg.wait_for_timeout(150)
                check(pg.evaluate("document.documentElement.getAttribute('data-theme')")
                      == "dark", f"{tag}: the toggle did not switch to dark")
                pg.click("#tog")
                pg.wait_for_timeout(150)

                # one dot size only - two radii read as a distinction in the data
                radii = pg.evaluate("""() => [...new Set([...document.querySelectorAll(
                    '#scatter circle.pt')].map(c => c.getAttribute('r')))]""")
                check(len(radii) == 1,
                      f"{tag}: scatter uses {len(radii)} dot radii {radii}, expected 1")

                # hovering a chart must actually produce a tooltip with a work in it
                # every chart with a tooltip must fire it from ANYWHERE in its column,
                # not only from a direct hit on a 3px marker
                for sel, tid, name in [("#shelf rect", "tip3", "shelf"),
                                       ("#medchart circle.medpt", "tip4", "century line")]:
                    # scroll it under the viewport first - mouse.move takes viewport
                    # coordinates, so an element 1,500px down is unreachable and the
                    # tooltip looks broken when it is not
                    pg.locator(sel).nth(12).scroll_into_view_if_needed()
                    pg.wait_for_timeout(150)
                    bb = pg.locator(sel).nth(12).bounding_box()
                    pg.mouse.move(bb["x"] + bb["width"] / 2, bb["y"] - 40)
                    pg.wait_for_timeout(180)
                    got = pg.evaluate(
                        f"document.getElementById('{tid}').classList.contains('on')")
                    check(got, f"{tag}: hovering the {name} column produced no tooltip")
                pg.click("#t-ridge")
                pg.wait_for_timeout(200)
                pg.locator("#spread").scroll_into_view_if_needed()
                pg.wait_for_timeout(150)
                sp = pg.locator("#spread").bounding_box()
                pg.mouse.move(sp["x"] + sp["width"] * 0.5, sp["y"] + sp["height"] * 0.25)
                pg.wait_for_timeout(200)
                check(pg.evaluate("document.getElementById('tip2').classList.contains('on')"),
                      f"{tag}: hovering the spread chart produced no tooltip")
                pg.click("#t-curve")
                pg.wait_for_timeout(150)

                # the page must be legible in this theme, not just present
                col = pg.evaluate("""() => {
                    const s = getComputedStyle(document.body);
                    return [s.color, s.backgroundColor];
                }""")
                check(col[0] != col[1], f"{tag}: text and background are the same colour")
                print(f"{tag:<12} pts={counts['pts']:<5} bars={counts['bars']:<3} "
                      f"centuries={counts['med']:<3} rho {before['rho']} -> {after['rho']}"
                      f"   {col[0]} on {col[1]}")
                ctx.close()
            b.close()
    finally:
        srv.shutdown()
        srv.server_close()

    print()
    if fails:
        print(f"FAIL ({len(fails)})")
        for f in fails:
            print("  -", f)
        sys.exit(1)
    print("All checks passed")


if __name__ == "__main__":
    main()
