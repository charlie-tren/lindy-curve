"use strict";
/* Inlined by build.py. No innerHTML anywhere - a security hook blocks it, so every
   chart is built with createElementNS and every label with textContent. */
const D = JSON.parse(document.getElementById("data").textContent);
const NS = "http://www.w3.org/2000/svg";
const el = (n, a = {}) => {
  const e = document.createElementNS(NS, n);
  for (const k in a) e.setAttribute(k, a[k]);
  return e;
};
const txt = (s, a) => { const t = el("text", a); t.textContent = s; return t; };
const clear = n => { while (n.firstChild) n.removeChild(n.firstChild); };
const band = y => y < 1500 ? 0 : y < 1700 ? 1 : y < 1800 ? 2 : y < 1900 ? 3 : 4;
const cLab = c => c < 0 ? Math.abs(c) + " BC" : (c === 0 ? "0-99" : c + "s");
const yrLab = y => y < 0 ? Math.abs(y) + " BC" : String(y);
const fmt = n => n.toLocaleString("en-AU");
const yLab = v => v >= 1000 ? (v / 1000) + "k" : String(v);
const DOT = " · ";

/* ------------------------------------------------------------------- theme */
const tog = document.getElementById("tog");
const togl = document.getElementById("togl");
function setTheme(dark) {
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  togl.textContent = dark ? "Light" : "Dark";
  tog.setAttribute("aria-label", "Switch to the " + (dark ? "light" : "dark") + " theme");
  try { localStorage.setItem("lc-theme", dark ? "dark" : "light"); } catch (e) {}
}
tog.addEventListener("click", () =>
  setTheme(document.documentElement.getAttribute("data-theme") !== "dark"));
setTheme((function () {
  try { return localStorage.getItem("lc-theme") === "dark"; } catch (e) { return false; }
})());

/* ------------------------------------------- one tooltip implementation, four charts */
function tipper(tipId, svg) {
  const tip = document.getElementById(tipId);
  let hits = [];
  return {
    reset: function () { hits = []; },
    add: function (x, y, head, sub) { hits.push({x: x, y: y, head: head, sub: sub}); },
    hide: function () { tip.classList.remove("on"); },
    /* xonly snaps to the nearest column regardless of vertical position, which is how
       a line or bar chart should behave - requiring a hit on the 3px marker itself made
       the tooltips feel broken. The scatter stays 2D, where y carries meaning. */
    track: function (u, W, H, radius, xonly) {
      let best = null, bd = radius * radius;
      for (const h of hits) {
        const q = xonly ? (h.x - u.x) * (h.x - u.x)
          : (h.x - u.x) * (h.x - u.x) + (h.y - u.y) * (h.y - u.y);
        if (q < bd) { bd = q; best = h; }
      }
      if (!best) { tip.classList.remove("on"); return; }
      clear(tip);
      const b = document.createElement("b");
      b.textContent = best.head;
      const sp = document.createElement("span");
      sp.textContent = best.sub;
      tip.appendChild(b);
      tip.appendChild(sp);
      const r = svg.getBoundingClientRect();
      // flip to the left of the point when it would otherwise run off the edge, which
      // was cutting long book titles in half
      const tw = tip.offsetWidth || 240;
      let lx = best.x / W * r.width + 12;
      if (lx + tw > r.width - 4) lx = Math.max(0, best.x / W * r.width - tw - 12);
      tip.style.left = lx + "px";
      tip.style.top = Math.max(0, best.y / H * r.height - 48) + "px";
      tip.classList.add("on");
    }
  };
}
function userPos(svg, ev, W, H) {
  const r = svg.getBoundingClientRect();
  return {x: (ev.clientX - r.left) / r.width * W, y: (ev.clientY - r.top) / r.height * H};
}


/* A least-squares fit in log-log space plus R squared. Drawn on both dot plots so the
   "there is no slope" claim is a measured line rather than an eyeball judgement. */
function fitLine(pairs) {
  const n = pairs.length;
  if (n < 8) return null;
  let sx = 0, sy = 0;
  for (const q of pairs) { sx += q[0]; sy += q[1]; }
  const mx = sx / n, my = sy / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (const q of pairs) {
    const dx = q[0] - mx, dy = q[1] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return null;
  const slope = sxy / sxx;
  return {slope: slope, intercept: my - slope * mx,
          r2: (sxy * sxy) / (sxx * syy), n: n};
}
function drawFit(svg, fit, x0, x1, px, py, labelX, labelY) {
  if (!fit) return;
  const ya = fit.intercept + fit.slope * x0, yb = fit.intercept + fit.slope * x1;
  svg.appendChild(el("line", {class: "fit", x1: px(x0).toFixed(1), y1: py(ya).toFixed(1),
    x2: px(x1).toFixed(1), y2: py(yb).toFixed(1)}));
  svg.appendChild(txt("r² = " + fit.r2.toFixed(3)
    + "  (n = " + fmt(fit.n) + ")", {class: "fitl", x: labelX, y: labelY,
    "text-anchor": "end"}));
}

/* ------------------------------------------------- the hero curve gets hover too */
const svgHero = document.querySelector("#v-curve figure svg");
if (svgHero && document.getElementById("tip6")) {
  const tipHero = tipper("tip6", svgHero);
  const HW = svgHero.viewBox.baseVal.width, HH = svgHero.viewBox.baseVal.height;
  const marks = svgHero.querySelectorAll("circle.mk");
  const labels = svgHero.querySelectorAll("text.mkl");
  for (let i = 0; i < marks.length; i++) {
    const t = marks[i].querySelector("title");
    tipHero.add(+marks[i].getAttribute("cx"), +marks[i].getAttribute("cy"),
      labels[i] ? labels[i].textContent : "?",
      t ? t.textContent.replace(/^[^·]*·\s*/, "") : "");
    if (t) marks[i].removeChild(t);
  }
  svgHero.addEventListener("pointermove", function (ev) {
    tipHero.track(userPos(svgHero, ev, HW, HH), HW, HH, 26);
  });
  svgHero.addEventListener("pointerleave", function () { tipHero.hide(); });
}

/* --------------------------------------------------- shelf: medians, not maxima */
const svgShelf = document.getElementById("shelf");
const tipShelf = tipper("tip3", svgShelf);
const SH = {W: 960, H: 260};
function shelf(st) {
  clear(svgShelf);
  tipShelf.reset();
  const W = SH.W, H = SH.H, L = 54, R = 12, T = 18, B = 32;
  const bars = st.shelf.bars;
  if (!bars.length) return;
  const top = Math.log10(Math.max.apply(null, bars.map(b => b.p75)) * 1.15);
  const bot = Math.log10(Math.min.apply(null, bars.map(b => b.med)) * 0.7);
  const bw = (W - L - R) / st.shelf.buckets;
  const yv = v => H - B - (Math.log10(v) - bot) / (top - bot) * (H - T - B);
  [300, 500, 1000, 2000, 5000].forEach(function (v) {
    const lv = Math.log10(v);
    if (lv < bot || lv > top) return;
    svgShelf.appendChild(el("line", {class: "g", x1: L, y1: yv(v).toFixed(1),
      x2: W - R, y2: yv(v).toFixed(1)}));
    svgShelf.appendChild(txt(yLab(v), {class: "ax", x: L - 8, y: (yv(v) + 4).toFixed(1),
      "text-anchor": "end"}));
  });
  bars.forEach(function (b) {
    // k rises WITH age, so k=0 (newest) sits at the LEFT, matching the curve above.
    const x = L + b.k * bw;
    const yTop = yv(b.med);
    svgShelf.appendChild(el("rect", {x: (x + bw * 0.14).toFixed(1), y: yTop.toFixed(1),
      width: (bw * 0.72).toFixed(1), height: Math.max(1, H - B - yTop).toFixed(1),
      fill: "var(--c" + band(b.y) + ")", "data-year": b.y}));
    // a hairline at the 75th percentile, so the bar is not mistaken for the whole story
    svgShelf.appendChild(el("line", {class: "p75", x1: (x + bw * 0.14).toFixed(1),
      y1: yv(b.p75).toFixed(1), x2: (x + bw * 0.86).toFixed(1),
      y2: yv(b.p75).toFixed(1)}));
    const t = D.titles[b.i] || ["?", ""];
    tipShelf.add(x + bw / 2, yTop,
      fmt(b.lo) + " to " + fmt(b.hi) + " years old",
      "median " + fmt(b.med) + " readers a month" + DOT + "upper quartile "
      + fmt(b.p75) + DOT + fmt(b.n) + " books" + DOT + "best known: " + t[0]);
  });
  svgShelf.appendChild(el("line", {class: "g", x1: L, y1: H - B + 4, x2: W - R,
    y2: H - B + 4}));
  svgShelf.appendChild(txt("NEWEST", {class: "axl", x: L + 2, y: H - 10}));
  svgShelf.appendChild(txt("MEDIAN READERS A MONTH, EQUAL-SIZED AGE GROUPS",
    {class: "axl", x: W / 2, y: H - 10, "text-anchor": "middle"}));
  svgShelf.appendChild(txt("OLDEST", {class: "axl", x: W - R - 2, y: H - 10,
    "text-anchor": "end"}));
}
svgShelf.addEventListener("pointermove", function (ev) {
  tipShelf.track(userPos(svgShelf, ev, SH.W, SH.H), SH.W, SH.H, 12, true);
});
svgShelf.addEventListener("pointerleave", function () { tipShelf.hide(); });



/* --------------------------------------------- scatter: zoom, pan and hover */
const SC = {W: 960, H: 470, L: 58, R: 122, T: 26, B: 52};
const HOME = {x0: Math.log10(5), x1: Math.log10(3200),
              y0: Math.log10(60), y1: Math.log10(200000)};
let view = Object.assign({}, HOME);
const svgScatter = document.getElementById("scatter");
const tipScatter = tipper("tip", svgScatter);

const spx = v => SC.L + (v - view.x0) / (view.x1 - view.x0) * (SC.W - SC.L - SC.R);
const spy = v => SC.H - SC.B - (v - view.y0) / (view.y1 - view.y0) * (SC.H - SC.T - SC.B);

function ticks(lo, hi) {
  const out = [];
  for (let e = Math.floor(lo); e <= Math.ceil(hi); e++) {
    [1, 2, 5].forEach(function (m) {
      const v = m * Math.pow(10, e), l = Math.log10(v);
      if (l >= lo && l <= hi) out.push(v);
    });
  }
  return out.length > 9 ? out.filter((_, i) => i % 2 === 0) : out;
}

let scQueued = false;
function scatterSoon() {
  if (scQueued) return;
  scQueued = true;
  requestAnimationFrame(function () { scQueued = false; scatter(); });
}
let ptsG = null;
function buildCloud() {
  /* The cloud is built ONCE and its circles are then repositioned on pan and zoom.
     Recreating 4,800 SVG nodes every frame is what made dragging feel sticky; setting
     two attributes on existing nodes is far cheaper. A group transform would be cheaper
     still, but log-log zoom needs a non-uniform scale, which turns the dots into
     ellipses - so this is the fast option that stays correct. */
  ptsG = el("g", {id: "cloud"});
  D.scatter.points.forEach(function () {
    ptsG.appendChild(el("circle", {class: "pt sp", cx: -99, cy: -99, r: 2.9,
      opacity: 0.5}));
  });
}
function placeCloud() {
  const kids = ptsG.childNodes, pts = D.scatter.points;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], c = kids[i];
    const lx = Math.log10(p.a), ly = Math.log10(p.d);
    if (lx < view.x0 || lx > view.x1 || ly < view.y0 || ly > view.y1 || !inEra(p)) {
      if (c.getAttribute("cx") !== "-99") c.setAttribute("cx", -99);
      continue;
    }
    c.setAttribute("cx", spx(lx).toFixed(1));
    c.setAttribute("cy", spy(ly).toFixed(1));
  }
}
let era = "all", lang = "all", minRead = 0, subj = "all";
function inEra(p) {
  if (p.d < minRead) return false;
  if (subj !== "all" && p.s !== subj) return false;
  if (lang !== "all") {
    if (lang === "other") {
      if (p.l === "en" || p.l === "fr" || p.l === "fi" || p.l === "de") return false;
    } else if (p.l !== lang) return false;
  }
  if (era === "all") return true;
  const y = 2026 - p.a;
  if (era === "anc") return y < 1500;
  if (era === "ear") return y >= 1500 && y < 1800;
  if (era === "c19") return y >= 1800 && y < 1900;
  return y >= 1900;
}
let gridG = null;
let fnQueued = false;
function furnitureSoon() {
  if (fnQueued) return;
  fnQueued = true;
  requestAnimationFrame(function () { fnQueued = false; furniture(); });
}
function furniture() {
  // everything except the cloud, redrawn at the live view so the gridlines follow the
  // data while the axis NUMBERS stay anchored and correct
  const keep = ptsG;
  const drop = [];
  for (let i = 0; i < svgScatter.childNodes.length; i++) {
    if (svgScatter.childNodes[i] !== keep) drop.push(svgScatter.childNodes[i]);
  }
  drop.forEach(function (n) { svgScatter.removeChild(n); });
  gridG = el("g", {id: "grid"});
  svgScatter.insertBefore(gridG, keep || null);
  ticks(view.x0, view.x1).forEach(function (v) {
    const X = spx(Math.log10(v));
    gridG.appendChild(el("line", {class: "g", x1: X, y1: SC.T, x2: X, y2: SC.H - SC.B}));
    gridG.appendChild(txt(fmt(v), {class: "ax", x: X, y: SC.H - SC.B + 18,
      "text-anchor": "middle"}));
  });
  ticks(view.y0, view.y1).forEach(function (v) {
    const Y = spy(Math.log10(v));
    gridG.appendChild(el("line", {class: "g", x1: SC.L, y1: Y, x2: SC.W - SC.R, y2: Y}));
    gridG.appendChild(txt(yLab(v), {class: "ax", x: SC.L - 7, y: Y + 4,
      "text-anchor": "end"}));
  });
  const fp = [];
  D.scatter.points.forEach(function (p) {
    if (inEra(p)) fp.push([Math.log10(p.a), Math.log10(p.d)]);
  });
  drawFit(svgScatter, fitLine(fp), view.x0, view.x1, spx, spy, SC.W - SC.R - 4, SC.T + 4);
  svgScatter.appendChild(txt("AGE IN YEARS", {class: "axl",
    x: (SC.L + (SC.W - SC.R)) / 2, y: SC.H - 8, "text-anchor": "middle"}));
  const m = (SC.T + (SC.H - SC.B)) / 2;
  svgScatter.appendChild(txt("READERS A MONTH", {class: "axl", x: 14, y: m,
    "text-anchor": "middle", transform: "rotate(-90 14 " + m + ")"}));
}
function scatter() {
  clear(svgScatter);
  tipScatter.reset();
  gridG = el("g", {id: "grid"});
  svgScatter.appendChild(gridG);
  ticks(view.x0, view.x1).forEach(function (v) {
    const X = spx(Math.log10(v));
    gridG.appendChild(el("line", {class: "g", x1: X, y1: SC.T, x2: X,
      y2: SC.H - SC.B}));
    gridG.appendChild(txt(fmt(v), {class: "ax", x: X, y: SC.H - SC.B + 18,
      "text-anchor": "middle"}));
  });
  ticks(view.y0, view.y1).forEach(function (v) {
    const Y = spy(Math.log10(v));
    gridG.appendChild(el("line", {class: "g", x1: SC.L, y1: Y, x2: SC.W - SC.R,
      y2: Y}));
    gridG.appendChild(txt(yLab(v), {class: "ax", x: SC.L - 7, y: Y + 4,
      "text-anchor": "end"}));
  });

  if (!ptsG) buildCloud();
  placeCloud();
  svgScatter.appendChild(ptsG);

  let shown = 0;
  D.scatter.points.forEach(function (p) {
    const lx = Math.log10(p.a), ly = Math.log10(p.d);
    if (lx < view.x0 || lx > view.x1 || ly < view.y0 || ly > view.y1) return;
    if (!inEra(p)) return;
    shown++;
    const X = spx(lx), Y = spy(ly);
    tipScatter.add(X, Y, p.t || "?",
      (p.au ? p.au + DOT : "") + fmt(p.a) + " yrs old" + DOT + fmt(p.d)
      + " readers a month");
  });
  const fitPairs = [];
  D.scatter.points.forEach(function (p) {
    if (!inEra(p)) return;
    fitPairs.push([Math.log10(p.a), Math.log10(p.d)]);
  });
  drawFit(svgScatter, fitLine(fitPairs), view.x0, view.x1, spx, spy,
    SC.W - SC.R - 4, SC.T + 4);
  svgScatter.appendChild(txt("AGE IN YEARS", {class: "axl",
    x: (SC.L + (SC.W - SC.R)) / 2, y: SC.H - 8, "text-anchor": "middle"}));
  const mid = (SC.T + (SC.H - SC.B)) / 2;
  svgScatter.appendChild(txt("READERS A MONTH", {class: "axl", x: 14, y: mid,
    "text-anchor": "middle", transform: "rotate(-90 14 " + mid + ")"}));
  const z = (HOME.x1 - HOME.x0) / (view.x1 - view.x0);
  const fc = document.getElementById("fcount");
  if (fc) fc.textContent = fmt(shown) + " of " + fmt(D.scatter.meta.of) + " shown"
    + (z > 1.05 ? DOT + "zoomed " + z.toFixed(1) + "x" : "");
  const note = document.getElementById("scatnote");
  if (note) note.textContent =
    "Every " + D.scatter.meta.stride + "th work, " + fmt(D.scatter.meta.kept) + " of "
    + fmt(D.scatter.meta.of) + DOT + fmt(shown) + " in view"
    + (z > 1.05 ? DOT + "zoomed " + z.toFixed(1) + "x" : "") + ".";
}

svgScatter.addEventListener("wheel", function (ev) {
  ev.preventDefault();
  const u = userPos(svgScatter, ev, SC.W, SC.H);
  const k = ev.deltaY > 0 ? 1.18 : 1 / 1.18;
  const fx = (u.x - SC.L) / (SC.W - SC.L - SC.R);
  const fy = (SC.H - SC.B - u.y) / (SC.H - SC.T - SC.B);
  const ax = view.x0 + fx * (view.x1 - view.x0);
  const ay = view.y0 + fy * (view.y1 - view.y0);
  const maxW = HOME.x1 - HOME.x0, maxH = HOME.y1 - HOME.y0;
  const w = Math.min(maxW, Math.max(maxW / 40, (view.x1 - view.x0) * k));
  const h = Math.min(maxH, Math.max(maxH / 40, (view.y1 - view.y0) * k));
  view = {x0: ax - fx * w, x1: ax + (1 - fx) * w,
          y0: ay - fy * h, y1: ay + (1 - fy) * h};
  scatterSoon();
}, {passive: false});

let dragging = null;
svgScatter.addEventListener("pointerdown", function (ev) {
  ev.preventDefault();                // stops a drag becoming a page text selection
  dragging = {u: userPos(svgScatter, ev, SC.W, SC.H), v: Object.assign({}, view)};
  svgScatter.classList.add("drag");
  svgScatter.setPointerCapture(ev.pointerId);
});
svgScatter.addEventListener("pointerup", function () {
  dragging = null;
  svgScatter.classList.remove("drag");
  if (ptsG) ptsG.setAttribute("transform", "");
  if (gridG) gridG.setAttribute("transform", "");
  scatter();
});
svgScatter.addEventListener("pointermove", function (ev) {
  const u = userPos(svgScatter, ev, SC.W, SC.H);
  if (dragging) {
    const dx = (u.x - dragging.u.x) / (SC.W - SC.L - SC.R)
             * (dragging.v.x1 - dragging.v.x0);
    const dy = (u.y - dragging.u.y) / (SC.H - SC.T - SC.B)
             * (dragging.v.y1 - dragging.v.y0);
    view = {x0: dragging.v.x0 - dx, x1: dragging.v.x1 - dx,
            y0: dragging.v.y0 + dy, y1: dragging.v.y1 + dy};
    // A pan is a pure translation, so shifting the group is exact AND costs one
    // attribute write instead of repositioning every circle. Axes redraw on the frame;
    // the cloud snaps back to real coordinates when the drag ends.
    if (ptsG) ptsG.setAttribute("transform",
      "translate(" + (u.x - dragging.u.x).toFixed(1) + ","
      + (u.y - dragging.u.y).toFixed(1) + ")");
    furnitureSoon();
    tipScatter.hide();
    return;
  }
  tipScatter.track(u, SC.W, SC.H, 14);
});
svgScatter.addEventListener("pointerleave", function () { tipScatter.hide(); });
svgScatter.addEventListener("dblclick", function () {
  view = Object.assign({}, HOME);
  scatter();
});

/* ------------------------------------------------------------------- state */
const ST = D.states[0];
function state() { return ST; }


draw();

/* --------------------------------- the second opinion: Wikipedia pageviews */
const svgWiki = document.getElementById("wiki");
const tipWiki = svgWiki ? tipper("tip5", svgWiki) : null;
const WK = {W: 960, H: 420, L: 66, R: 26, T: 30, B: 52};
let wHome = null, wView = null;
function wiki() {
  const w = D.wiki;
  if (!w || !svgWiki) return;
  clear(svgWiki);
  tipWiki.reset();
  const pts = w.points;
  if (!wHome) {
    wHome = {x0: Math.log10(60), x1: Math.log10(3200),
             y0: Math.log10(Math.max(200, Math.min.apply(null, pts.map(p => p.w)) * 0.7)),
             y1: Math.log10(Math.max.apply(null, pts.map(p => p.w)) * 1.4)};
    wView = Object.assign({}, wHome);
  }
  const x0 = wView.x0, x1 = wView.x1, y0 = wView.y0, y1 = wView.y1;
  const px = v => WK.L + (v - x0) / (x1 - x0) * (WK.W - WK.L - WK.R);
  const py = v => WK.H - WK.B - (v - y0) / (y1 - y0) * (WK.H - WK.T - WK.B);
  ticks(x0, x1).forEach(function (v) {
    const l = Math.log10(v);
    if (l < x0 || l > x1) return;
    svgWiki.appendChild(el("line", {class: "g", x1: px(l), y1: WK.T, x2: px(l),
      y2: WK.H - WK.B}));
    svgWiki.appendChild(txt(fmt(v), {class: "ax", x: px(l), y: WK.H - WK.B + 18,
      "text-anchor": "middle"}));
  });
  ticks(y0, y1).forEach(function (v) {
    const l = Math.log10(v);
    if (l < y0 || l > y1) return;
    svgWiki.appendChild(el("line", {class: "g", x1: WK.L, y1: py(l), x2: WK.W - WK.R,
      y2: py(l)}));
    svgWiki.appendChild(txt(v >= 1000000 ? (v / 1000000) + "M" : yLab(v),
      {class: "ax", x: WK.L - 8, y: py(l) + 4, "text-anchor": "end"}));
  });
  pts.forEach(function (p) {
    const lx = Math.log10(p.a), ly = Math.log10(p.w);
    if (lx < x0 || lx > x1 || ly < y0 || ly > y1) return;
    const X = px(lx), Y = py(ly);
    svgWiki.appendChild(el("circle", {class: "pt", cx: X.toFixed(1), cy: Y.toFixed(1),
      r: 3.4, opacity: 0.6}));
    tipWiki.add(X, Y, p.t, fmt(p.a) + " yrs old" + DOT + fmt(p.w)
      + " Wikipedia views a year" + DOT + fmt(p.d) + " Gutenberg readers a month");
  });
  drawFit(svgWiki, fitLine(pts.map(function (q) {
    return [Math.log10(q.a), Math.log10(q.w)];
  })), x0, x1, px, py, WK.W - WK.R - 4, WK.T + 4);
  svgWiki.appendChild(txt(fmt(w.n) + " of " + fmt(w.tried) + " works matched an article",
    {class: "note", x: WK.L + 8, y: WK.T + 14}));
  svgWiki.appendChild(txt("AGE IN YEARS", {class: "axl",
    x: (WK.L + (WK.W - WK.R)) / 2, y: WK.H - 8, "text-anchor": "middle"}));
  const wmid = (WK.T + (WK.H - WK.B)) / 2;
  svgWiki.appendChild(txt("WIKIPEDIA VIEWS A YEAR, 2016 TO 2026", {class: "axl", x: 14,
    y: wmid, "text-anchor": "middle", transform: "rotate(-90 14 " + wmid + ")"}));
  const set = function (id, v) {
    const n = document.getElementById(id);
    if (n) n.textContent = v;
  };
  set("wn", fmt(w.n));
  set("wt", fmt(w.tried));
  set("wrho", (w.rho_wiki >= 0 ? "+" : "−") + Math.abs(w.rho_wiki).toFixed(3));
  set("wgut", (w.rho_gut >= 0 ? "+" : "−") + Math.abs(w.rho_gut).toFixed(3));
  set("wold", fmt(w.med_old));
  set("wnew", fmt(w.med_new));
  set("wagree", (w.rho_agree >= 0 ? "+" : "−") + Math.abs(w.rho_agree).toFixed(3));
}
if (svgWiki) {
  let wDrag = null;
  svgWiki.addEventListener("wheel", function (ev) {
    ev.preventDefault();
    const u = userPos(svgWiki, ev, WK.W, WK.H);
    const k = ev.deltaY > 0 ? 1.18 : 1 / 1.18;
    const fx = (u.x - WK.L) / (WK.W - WK.L - WK.R);
    const fy = (WK.H - WK.B - u.y) / (WK.H - WK.T - WK.B);
    const ax = wView.x0 + fx * (wView.x1 - wView.x0);
    const ay = wView.y0 + fy * (wView.y1 - wView.y0);
    const mw = wHome.x1 - wHome.x0, mh = wHome.y1 - wHome.y0;
    const ww = Math.min(mw, Math.max(mw / 30, (wView.x1 - wView.x0) * k));
    const hh = Math.min(mh, Math.max(mh / 30, (wView.y1 - wView.y0) * k));
    wView = {x0: ax - fx * ww, x1: ax + (1 - fx) * ww,
             y0: ay - fy * hh, y1: ay + (1 - fy) * hh};
    wiki();
  }, {passive: false});
  svgWiki.addEventListener("pointerdown", function (ev) {
    ev.preventDefault();
    wDrag = {u: userPos(svgWiki, ev, WK.W, WK.H), v: Object.assign({}, wView)};
    svgWiki.classList.add("drag");
    svgWiki.setPointerCapture(ev.pointerId);
  });
  svgWiki.addEventListener("pointerup", function () {
    wDrag = null;
    svgWiki.classList.remove("drag");
  });
  svgWiki.addEventListener("pointermove", function (ev) {
    const u = userPos(svgWiki, ev, WK.W, WK.H);
    if (wDrag) {
      const dx = (u.x - wDrag.u.x) / (WK.W - WK.L - WK.R) * (wDrag.v.x1 - wDrag.v.x0);
      const dy = (u.y - wDrag.u.y) / (WK.H - WK.T - WK.B) * (wDrag.v.y1 - wDrag.v.y0);
      wView = {x0: wDrag.v.x0 - dx, x1: wDrag.v.x1 - dx,
               y0: wDrag.v.y0 + dy, y1: wDrag.v.y1 + dy};
      tipWiki.hide();
      wiki();
      return;
    }
    tipWiki.track(u, WK.W, WK.H, 14);
  });
  svgWiki.addEventListener("pointerleave", function () { tipWiki.hide(); });
  svgWiki.addEventListener("dblclick", function () {
    wView = Object.assign({}, wHome);
    wiki();
  });
}
wiki();

function draw() {
  const st = state();
  shelf(st);
  scatter();
}
draw();

/* the dropdown filters above the dot plot */
[["f-era", function (v) { era = v; }],
 ["f-subj", function (v) { subj = v; }],
 ["f-lang", function (v) { lang = v; }],
 ["f-min", function (v) { minRead = +v; }]].forEach(function (pair) {
  const sel = document.getElementById(pair[0]);
  if (!sel) return;
  sel.addEventListener("change", function () {
    pair[1](sel.value);
    scatter();
  });
});
