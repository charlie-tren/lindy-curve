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
    track: function (u, W, H, radius) {
      let best = null, bd = radius * radius;
      for (const h of hits) {
        const q = (h.x - u.x) * (h.x - u.x) + (h.y - u.y) * (h.y - u.y);
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
      tip.style.left = Math.min(Math.max(0, r.width - 268),
                                best.x / W * r.width + 12) + "px";
      tip.style.top = Math.max(0, best.y / H * r.height - 48) + "px";
      tip.classList.add("on");
    }
  };
}
function userPos(svg, ev, W, H) {
  const r = svg.getBoundingClientRect();
  return {x: (ev.clientX - r.left) / r.width * W, y: (ev.clientY - r.top) / r.height * H};
}

/* -------------------------------------------------------------------- tabs */
const tabs = [["t-curve", "v-curve"], ["t-scatter", "v-scatter"], ["t-ridge", "v-ridge"]];
tabs.forEach(function (pair) {
  document.getElementById(pair[0]).addEventListener("click", function () {
    tabs.forEach(function (p2) {
      const on = p2[0] === pair[0];
      document.getElementById(p2[0]).setAttribute("aria-selected", on ? "true" : "false");
      document.getElementById(p2[1]).classList.toggle("on", on);
    });
    draw();
  });
});

/* ------------------------------------------------------------------- shelf */
const svgShelf = document.getElementById("shelf");
const tipShelf = tipper("tip3", svgShelf);
const SH = {W: 960, H: 260};
function shelf(st) {
  clear(svgShelf);
  tipShelf.reset();
  const W = SH.W, H = SH.H, L = 10, R = 10, T = 12, B = 30;
  const bars = st.shelf.bars, slots = st.shelf.slots;
  if (!bars.length) return;
  const top = Math.log10(Math.max.apply(null, bars.map(b => b.d)) * 1.1);
  const bot = Math.log10(Math.max(60, Math.min.apply(null, bars.map(b => b.d)))) * 0.985;
  const bw = (W - L - R) / slots;
  bars.forEach(function (b) {
    const h = (Math.log10(b.d) - bot) / (top - bot) * (H - T - B);
    // k rises WITH age, so k=0 (newest) sits at the LEFT, matching this chart's own
    // labels and the curve above it. Reversing it put ancient works under "newest".
    const x = L + b.k * bw;
    const t = D.titles[b.i] || ["?", ""];
    svgShelf.appendChild(el("rect", {x: (x + bw * 0.15).toFixed(1),
      y: (H - B - h).toFixed(1), width: (bw * 0.7).toFixed(1),
      height: Math.max(1, h).toFixed(1), fill: "var(--c" + band(b.y) + ")",
      "data-year": b.y}));
    tipShelf.add(x + bw / 2, H - B - h / 2, t[0],
      (t[1] ? t[1] + DOT : "") + yrLab(b.y) + DOT + fmt(b.d) + " readers a month");
  });
  svgShelf.appendChild(el("line", {class: "g", x1: L, y1: H - B + 4, x2: W - R,
    y2: H - B + 4}));
  svgShelf.appendChild(txt("NEWEST", {class: "axl", x: L + 2, y: H - 10}));
  svgShelf.appendChild(txt("HEIGHT = READERS A MONTH", {class: "axl", x: W / 2, y: H - 10,
    "text-anchor": "middle"}));
  svgShelf.appendChild(txt("OLDEST", {class: "axl", x: W - R - 2, y: H - 10,
    "text-anchor": "end"}));
}
svgShelf.addEventListener("pointermove", function (ev) {
  tipShelf.track(userPos(svgShelf, ev, SH.W, SH.H), SH.W, SH.H, 22);
});
svgShelf.addEventListener("pointerleave", function () { tipShelf.hide(); });

/* -------------------------------------------------------- median by century */
const svgMed = document.getElementById("medchart");
const tipMed = tipper("tip4", svgMed);
const MD = {W: 960, H: 340};
function median(st) {
  clear(svgMed);
  tipMed.reset();
  const W = MD.W, H = MD.H, L = 66, R = 24, T = 26, B = 62;
  const cs = st.centuries;
  if (!cs.length) return;
  const top = Math.max.apply(null, cs.map(c => c.med)) * 1.15;
  const x = i => L + (cs.length < 2 ? 0 : i / (cs.length - 1)) * (W - L - R);
  const y = v => H - B - v / top * (H - T - B);
  const step = top > 20000 ? 10000 : top > 4000 ? 2000 : top > 1500 ? 500 : 200;
  for (let g = 0; g <= top; g += step) {
    svgMed.appendChild(el("line", {class: "g", x1: L, y1: y(g), x2: W - R, y2: y(g)}));
    svgMed.appendChild(txt(fmt(g), {class: "ax", x: L - 8, y: y(g) + 4,
      "text-anchor": "end"}));
  }
  let d = "";
  cs.forEach(function (c, i) {
    d += (i ? " L" : "M") + x(i).toFixed(1) + "," + y(c.med).toFixed(1);
  });
  svgMed.appendChild(el("path", {class: "med", d: d}));
  const every = Math.ceil(cs.length / 9);
  cs.forEach(function (c, i) {
    svgMed.appendChild(el("circle", {class: "medpt", cx: x(i).toFixed(1),
      cy: y(c.med).toFixed(1), r: 3.4, fill: "var(--c" + band(c.c) + ")"}));
    if (i % every === 0 || i === cs.length - 1) {
      const g = el("g", {transform: "rotate(-42 " + x(i).toFixed(1) + " "
        + (H - B + 16) + ")"});
      g.appendChild(txt(cLab(c.c), {class: "ax", x: x(i).toFixed(1), y: H - B + 16,
        "text-anchor": "end"}));
      svgMed.appendChild(g);
    }
    tipMed.add(x(i), y(c.med), cLab(c.c),
      fmt(c.n) + " works" + DOT + "median " + fmt(c.med) + DOT + "middle half "
      + fmt(c.p25) + " to " + fmt(c.p75));
  });
  svgMed.appendChild(el("line", {class: "g", x1: L, y1: H - B, x2: W - R, y2: H - B}));
  svgMed.appendChild(txt("MEDIAN READERS A MONTH, BY CENTURY", {class: "axl", x: L,
    y: T - 10}));
  svgMed.appendChild(txt("older", {class: "axl", x: L, y: H - 8}));
  svgMed.appendChild(txt("newer", {class: "axl", x: W - R, y: H - 8,
    "text-anchor": "end"}));
}
svgMed.addEventListener("pointermove", function (ev) {
  tipMed.track(userPos(svgMed, ev, MD.W, MD.H), MD.W, MD.H, 26);
});
svgMed.addEventListener("pointerleave", function () { tipMed.hide(); });

/* ------------------------------------------ quartile bands, hover and pannable */
const svgSpread = document.getElementById("spread");
const tipSpread = tipper("tip2", svgSpread);
const SP = {W: 960, H: 420, L: 66, R: 26, T: 34, B: 62};
let win = null;
function spread(st) {
  clear(svgSpread);
  tipSpread.reset();
  const cs = st.centuries;
  if (!cs.length) return;
  if (!win || win[1] > cs.length - 1) win = [0, cs.length - 1];
  const i0 = Math.max(0, Math.round(win[0]));
  const i1 = Math.min(cs.length - 1, Math.round(win[1]));
  const vis = cs.slice(i0, i1 + 1);
  if (vis.length < 2) return;
  const W = SP.W, H = SP.H, L = SP.L, R = SP.R, T = SP.T, B = SP.B;
  const lo = Math.log10(Math.max(60, Math.min.apply(null, vis.map(c => c.p25)) * 0.8));
  const hi = Math.log10(Math.max.apply(null, vis.map(c => c.p75)) * 1.3);
  const x = i => L + i / (vis.length - 1) * (W - L - R);
  const y = v => H - B - (Math.log10(v) - lo) / (hi - lo) * (H - T - B);

  [100, 300, 1000, 3000, 10000, 30000, 100000].forEach(function (v) {
    if (Math.log10(v) < lo || Math.log10(v) > hi) return;
    svgSpread.appendChild(el("line", {class: "g", x1: L, y1: y(v), x2: W - R, y2: y(v)}));
    svgSpread.appendChild(txt(yLab(v), {class: "ax", x: L - 8, y: y(v) + 4,
      "text-anchor": "end"}));
  });

  let up = "", dn = "";
  vis.forEach(function (c, i) {
    up += (i ? " L" : "M") + x(i).toFixed(1) + "," + y(c.p75).toFixed(1);
  });
  for (let i = vis.length - 1; i >= 0; i--) {
    dn += " L" + x(i).toFixed(1) + "," + y(vis[i].p25).toFixed(1);
  }
  svgSpread.appendChild(el("path", {d: up + dn + " Z", fill: "var(--gilt)",
    "fill-opacity": 0.17, stroke: "none"}));
  let m = "";
  vis.forEach(function (c, i) {
    m += (i ? " L" : "M") + x(i).toFixed(1) + "," + y(c.med).toFixed(1);
  });
  svgSpread.appendChild(el("path", {class: "med", d: m}));

  // The axis was unreadable with a century AND a count on every tick. Counts moved into
  // the tooltip, and labels thin out as more centuries come into view.
  const every = vis.length > 14 ? 2 : 1;
  vis.forEach(function (c, i) {
    svgSpread.appendChild(el("circle", {class: "medpt", cx: x(i).toFixed(1),
      cy: y(c.med).toFixed(1), r: 3, fill: "var(--c" + band(c.c) + ")"}));
    if (i % every === 0 || i === vis.length - 1) {
      const g = el("g", {transform: "rotate(-42 " + x(i).toFixed(1) + " "
        + (H - B + 16) + ")"});
      g.appendChild(txt(cLab(c.c), {class: "ax", x: x(i).toFixed(1), y: H - B + 16,
        "text-anchor": "end"}));
      svgSpread.appendChild(g);
    }
    tipSpread.add(x(i), y(c.med), cLab(c.c),
      fmt(c.n) + " works" + DOT + "median " + fmt(c.med) + DOT + "middle half "
      + fmt(c.p25) + " to " + fmt(c.p75));
  });
  svgSpread.appendChild(el("line", {class: "g", x1: L, y1: H - B, x2: W - R, y2: H - B}));
  svgSpread.appendChild(txt("MIDDLE 50% OF EACH CENTURY, READERS A MONTH (LOG)",
    {class: "axl", x: L, y: T - 12}));
  svgSpread.appendChild(txt("oldest", {class: "axl", x: L, y: H - 8}));
  svgSpread.appendChild(txt("newest", {class: "axl", x: W - R, y: H - 8,
    "text-anchor": "end"}));
  if ((i1 - i0) < cs.length - 1) {
    svgSpread.appendChild(txt(vis.length + " of " + cs.length
      + " centuries - double-click to reset", {class: "axl", x: W - R, y: T - 12,
      "text-anchor": "end"}));
  }
}
let spDrag = null;
svgSpread.addEventListener("wheel", function (ev) {
  ev.preventDefault();
  const cs = state().centuries;
  const u = userPos(svgSpread, ev, SP.W, SP.H);
  const f = Math.min(1, Math.max(0, (u.x - SP.L) / (SP.W - SP.L - SP.R)));
  const span = win[1] - win[0];
  const anchor = win[0] + f * span;
  const next = Math.min(cs.length - 1, Math.max(3, span * (ev.deltaY > 0 ? 1.25 : 0.8)));
  win = [anchor - f * next, anchor + (1 - f) * next];
  if (win[0] < 0) win = [0, next];
  if (win[1] > cs.length - 1) win = [cs.length - 1 - next, cs.length - 1];
  spread(state());
}, {passive: false});
svgSpread.addEventListener("pointerdown", function (ev) {
  ev.preventDefault();
  spDrag = {u: userPos(svgSpread, ev, SP.W, SP.H), w: win.slice()};
  svgSpread.classList.add("drag");
  svgSpread.setPointerCapture(ev.pointerId);
});
svgSpread.addEventListener("pointerup", function () {
  spDrag = null;
  svgSpread.classList.remove("drag");
});
svgSpread.addEventListener("pointermove", function (ev) {
  const u = userPos(svgSpread, ev, SP.W, SP.H);
  if (spDrag) {
    const cs = state().centuries;
    const span = spDrag.w[1] - spDrag.w[0];
    const d = (u.x - spDrag.u.x) / (SP.W - SP.L - SP.R) * span;
    let a = spDrag.w[0] - d, b = spDrag.w[1] - d;
    if (a < 0) { b -= a; a = 0; }
    if (b > cs.length - 1) { a -= b - (cs.length - 1); b = cs.length - 1; }
    win = [Math.max(0, a), b];
    tipSpread.hide();
    spread(state());
    return;
  }
  tipSpread.track(u, SP.W, SP.H, 30);
});
svgSpread.addEventListener("pointerleave", function () { tipSpread.hide(); });
svgSpread.addEventListener("dblclick", function () { win = null; spread(state()); });

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

function scatter() {
  clear(svgScatter);
  tipScatter.reset();
  ticks(view.x0, view.x1).forEach(function (v) {
    const X = spx(Math.log10(v));
    svgScatter.appendChild(el("line", {class: "g", x1: X, y1: SC.T, x2: X,
      y2: SC.H - SC.B}));
    svgScatter.appendChild(txt(fmt(v), {class: "ax", x: X, y: SC.H - SC.B + 18,
      "text-anchor": "middle"}));
  });
  ticks(view.y0, view.y1).forEach(function (v) {
    const Y = spy(Math.log10(v));
    svgScatter.appendChild(el("line", {class: "g", x1: SC.L, y1: Y, x2: SC.W - SC.R,
      y2: Y}));
    svgScatter.appendChild(txt(yLab(v), {class: "ax", x: SC.L - 7, y: Y + 4,
      "text-anchor": "end"}));
  });

  const floor = state().floor;
  let shown = 0;
  D.scatter.points.forEach(function (p) {
    const lx = Math.log10(p.a), ly = Math.log10(p.d);
    if (lx < view.x0 || lx > view.x1 || ly < view.y0 || ly > view.y1) return;
    const on = p.d >= floor;
    if (on) shown++;
    const X = spx(lx), Y = spy(ly);
    // ONE radius for every dot. Two radii read as a distinction in the data that does
    // not exist - above and below the threshold differ in opacity only.
    svgScatter.appendChild(el("circle", {class: "pt sp" + (on ? "" : " lo"),
      cx: X.toFixed(1), cy: Y.toFixed(1), r: 2.2, opacity: on ? 0.5 : 0.13}));
    tipScatter.add(X, Y, p.t || "?",
      (p.au ? p.au + DOT : "") + fmt(p.a) + " yrs old" + DOT + fmt(p.d)
      + " readers a month");
  });
  D.callouts.forEach(function (c) {
    const lx = Math.log10(c.a), ly = Math.log10(c.d);
    if (lx < view.x0 || lx > view.x1 || ly < view.y0 || ly > view.y1) return;
    const X = spx(lx), Y = spy(ly);
    svgScatter.appendChild(el("circle", {class: "hi", cx: X.toFixed(1), cy: Y.toFixed(1),
      r: 4}));
    svgScatter.appendChild(txt(c.n, {class: "lbl", x: (X + 7).toFixed(1),
      y: (Y + 3.5).toFixed(1)}));
    tipScatter.add(X, Y, c.t, (c.au ? c.au + DOT : "") + fmt(c.a) + " yrs old" + DOT
      + fmt(c.d) + " readers a month");
  });
  svgScatter.appendChild(txt("AGE IN YEARS", {class: "axl", x: SC.L, y: SC.H - 6}));
  svgScatter.appendChild(txt("READERS A MONTH", {class: "axl", x: SC.L, y: SC.T - 8}));
  const z = (HOME.x1 - HOME.x0) / (view.x1 - view.x0);
  document.getElementById("scatnote").textContent =
    "Every " + D.scatter.meta.stride + "th work, " + fmt(D.scatter.meta.kept) + " of "
    + fmt(D.scatter.meta.of) + DOT + fmt(shown) + " above the threshold"
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
  scatter();
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
    scatter();
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
const slider = document.getElementById("floor");
function state() { return D.states[Math.min(slider.value, D.states.length - 1)]; }

function draw() {
  const st = state();
  shelf(st);
  median(st);
  spread(st);
  scatter();
}

function readout() {
  const st = state(), r = st.rho;
  const box = document.getElementById("rho");
  box.textContent = (r >= 0 ? "+" : "−") + Math.abs(r).toFixed(3);
  box.className = "rho " + (Math.abs(r) < 0.03 ? "nil" : r > 0 ? "pos" : "neg");
  document.getElementById("verdict").textContent =
    Math.abs(r) < 0.03 ? "no relationship at all"
      : r > 0 ? "older works read slightly more" : "older works read slightly less";
  document.getElementById("flab").textContent = st.floor === 0
    ? "Counting every work in the corpus"
    : "Ignoring works read fewer than " + fmt(st.floor) + " times a month";
  document.getElementById("nread").textContent =
    fmt(st.n) + " works" + DOT + "median " + fmt(st.med) + " a month";
}

const tk = document.getElementById("ticks");
[D.states[0], D.states[Math.floor(D.states.length / 2)], D.states[D.states.length - 1]]
  .forEach(function (s2) {
    const b = document.createElement("span");
    b.textContent = fmt(s2.floor);
    tk.appendChild(b);
  });
slider.max = String(D.states.length - 1);
// Redraw on the next frame, so dragging the slider fast does not queue 25 full redraws.
let queued = false;
slider.addEventListener("input", function () {
  readout();
  if (queued) return;
  queued = true;
  requestAnimationFrame(function () { queued = false; draw(); });
});
readout();
draw();
