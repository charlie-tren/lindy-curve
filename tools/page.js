"use strict";
/* Inlined into the page by build.py. No innerHTML anywhere - a security hook blocks it,
   and every chart is built with createElementNS and textContent. */
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
const fmt = n => n.toLocaleString("en-AU");
const yLab = v => v >= 1000 ? (v / 1000) + "k" : String(v);
const DOT = " · ";

const tabs = [["t-curve", "v-curve"], ["t-scatter", "v-scatter"], ["t-ridge", "v-ridge"]];
tabs.forEach(([t, v]) => {
  document.getElementById(t).addEventListener("click", () => {
    tabs.forEach(([t2, v2]) => {
      const on = t2 === t;
      document.getElementById(t2).setAttribute("aria-selected", on ? "true" : "false");
      document.getElementById(v2).classList.toggle("on", on);
    });
    draw();
  });
});

/* --------------------------------------------------------------------- shelf */
function shelf(svg, st) {
  clear(svg);
  const W = 960, H = 260, L = 10, R = 10, T = 12, B = 30;
  const bars = st.shelf.bars, slots = st.shelf.slots;
  if (!bars.length) return;
  const top = Math.log10(Math.max.apply(null, bars.map(b => b.d)) * 1.1);
  const bot = Math.log10(Math.max(60, Math.min.apply(null, bars.map(b => b.d)))) * 0.985;
  const bw = (W - L - R) / slots;
  bars.forEach(b => {
    const h = (Math.log10(b.d) - bot) / (top - bot) * (H - T - B);
    // k rises WITH age, so k=0 (newest) must sit at the LEFT to match both this
    // chart's own axis labels and the curve above it. Reversing this put the ancient
    // works under a label reading "newest" - the same inversion the hero had.
    const x = L + b.k * bw;
    const r = el("rect", {x: (x + bw * 0.15).toFixed(1), y: (H - B - h).toFixed(1),
      width: (bw * 0.7).toFixed(1), height: Math.max(1, h).toFixed(1),
      fill: "var(--c" + band(b.y) + ")"});
    const tt = el("title");
    const yr = b.y < 0 ? Math.abs(b.y) + " BC" : String(b.y);
    tt.textContent = b.t + (b.au ? " - " + b.au : "") + DOT + yr + DOT
      + fmt(b.d) + " readers a month";
    r.appendChild(tt);
    svg.appendChild(r);
  });
  svg.appendChild(el("line", {class: "g", x1: L, y1: H - B + 4, x2: W - R, y2: H - B + 4}));
  svg.appendChild(txt("NEWEST", {class: "axl", x: L + 2, y: H - 10}));
  svg.appendChild(txt("HEIGHT = READERS A MONTH", {class: "axl", x: W / 2, y: H - 10,
    "text-anchor": "middle"}));
  svg.appendChild(txt("OLDEST", {class: "axl", x: W - R - 2, y: H - 10,
    "text-anchor": "end"}));
}

/* ------------------------------------------------------ median by century */
function median(svg, st) {
  clear(svg);
  const W = 960, H = 340, L = 66, R = 24, T = 26, B = 62;
  const cs = st.centuries;
  if (!cs.length) return;
  const top = Math.max.apply(null, cs.map(c => c.med)) * 1.15;
  const x = i => L + (cs.length < 2 ? 0 : i / (cs.length - 1)) * (W - L - R);
  const y = v => H - B - v / top * (H - T - B);
  const step = top > 20000 ? 10000 : top > 4000 ? 2000 : top > 1500 ? 500 : 200;
  for (let g = 0; g <= top; g += step) {
    svg.appendChild(el("line", {class: "g", x1: L, y1: y(g), x2: W - R, y2: y(g)}));
    svg.appendChild(txt(fmt(g), {class: "ax", x: L - 8, y: y(g) + 4, "text-anchor": "end"}));
  }
  let d = "";
  cs.forEach((c, i) => {
    d += (i ? " L" : "M") + x(i).toFixed(1) + "," + y(c.med).toFixed(1);
  });
  svg.appendChild(el("path", {class: "med", d: d}));
  cs.forEach((c, i) => {
    svg.appendChild(el("circle", {class: "medpt", cx: x(i).toFixed(1),
      cy: y(c.med).toFixed(1), r: 3.4, fill: "var(--c" + band(c.c) + ")"}));
    if (i % Math.ceil(cs.length / 9) === 0 || i === cs.length - 1) {
      const g = el("g", {transform: "rotate(-42 " + x(i).toFixed(1) + " " + (H - B + 16) + ")"});
      g.appendChild(txt(cLab(c.c), {class: "ax", x: x(i).toFixed(1), y: H - B + 16,
        "text-anchor": "end"}));
      svg.appendChild(g);
    }
    const hit = el("circle", {cx: x(i).toFixed(1), cy: y(c.med).toFixed(1), r: 11,
      fill: "transparent"});
    const tt = el("title");
    tt.textContent = cLab(c.c) + ": median " + fmt(c.med) + ", " + fmt(c.n) + " works";
    hit.appendChild(tt);
    svg.appendChild(hit);
  });
  svg.appendChild(el("line", {class: "g", x1: L, y1: H - B, x2: W - R, y2: H - B}));
  svg.appendChild(txt("MEDIAN READERS A MONTH, BY CENTURY", {class: "axl", x: L, y: T - 10}));
  svg.appendChild(txt("older", {class: "axl", x: L, y: H - 8}));
  svg.appendChild(txt("newer", {class: "axl", x: W - R, y: H - 8, "text-anchor": "end"}));
}

/* ------------------------------------------------------- quartile bands */
function spread(svg, st) {
  clear(svg);
  const W = 960, H = 420, L = 66, R = 26, T = 34, B = 78;
  const cs = st.centuries;
  if (!cs.length) return;
  const lo = Math.log10(Math.max(60, Math.min.apply(null, cs.map(c => c.p25)) * 0.8));
  const hi = Math.log10(Math.max.apply(null, cs.map(c => c.p75)) * 1.25);
  const x = i => L + (cs.length < 2 ? 0 : i / (cs.length - 1)) * (W - L - R);
  const y = v => H - B - (Math.log10(v) - lo) / (hi - lo) * (H - T - B);

  [100, 300, 1000, 3000, 10000, 30000, 100000].forEach(v => {
    if (Math.log10(v) < lo || Math.log10(v) > hi) return;
    svg.appendChild(el("line", {class: "g", x1: L, y1: y(v), x2: W - R, y2: y(v)}));
    svg.appendChild(txt(yLab(v), {class: "ax", x: L - 8, y: y(v) + 4, "text-anchor": "end"}));
  });

  let up = "", dn = "";
  cs.forEach((c, i) => {
    up += (i ? " L" : "M") + x(i).toFixed(1) + "," + y(c.p75).toFixed(1);
  });
  for (let i = cs.length - 1; i >= 0; i--) {
    dn += " L" + x(i).toFixed(1) + "," + y(cs[i].p25).toFixed(1);
  }
  svg.appendChild(el("path", {d: up + dn + " Z", fill: "var(--gilt)",
    "fill-opacity": 0.17, stroke: "none"}));
  let m = "";
  cs.forEach((c, i) => {
    m += (i ? " L" : "M") + x(i).toFixed(1) + "," + y(c.med).toFixed(1);
  });
  svg.appendChild(el("path", {class: "med", d: m}));

  cs.forEach((c, i) => {
    svg.appendChild(el("circle", {class: "medpt", cx: x(i).toFixed(1),
      cy: y(c.med).toFixed(1), r: 3, fill: "var(--c" + band(c.c) + ")"}));
    const g = el("g", {transform: "rotate(-46 " + x(i).toFixed(1) + " " + (H - B + 18) + ")"});
    g.appendChild(txt(cLab(c.c) + "  n=" + fmt(c.n), {class: "ax", x: x(i).toFixed(1),
      y: H - B + 18, "text-anchor": "end"}));
    svg.appendChild(g);
    const hit = el("rect", {x: (x(i) - 8).toFixed(1), y: T, width: 16,
      height: H - T - B, fill: "transparent"});
    const tt = el("title");
    tt.textContent = cLab(c.c) + ": middle half " + fmt(c.p25) + " to " + fmt(c.p75)
      + ", median " + fmt(c.med) + ", " + fmt(c.n) + " works";
    hit.appendChild(tt);
    svg.appendChild(hit);
  });
  svg.appendChild(el("line", {class: "g", x1: L, y1: H - B, x2: W - R, y2: H - B}));
  svg.appendChild(txt("MIDDLE HALF OF EACH CENTURY, READERS A MONTH (LOG)",
    {class: "axl", x: L, y: T - 12}));
  svg.appendChild(txt("oldest", {class: "axl", x: L, y: H - 8}));
  svg.appendChild(txt("newest", {class: "axl", x: W - R, y: H - 8, "text-anchor": "end"}));
}

/* -------------------------------------------- scatter: zoom, pan, hover */
const SC = {W: 960, H: 470, L: 58, R: 122, T: 26, B: 52};
const HOME = {x0: Math.log10(5), x1: Math.log10(3200),
              y0: Math.log10(60), y1: Math.log10(200000)};
let view = Object.assign({}, HOME);
const svgScatter = document.getElementById("scatter");
const tip = document.getElementById("tip");
let drawn = [];

const spx = v => SC.L + (v - view.x0) / (view.x1 - view.x0) * (SC.W - SC.L - SC.R);
const spy = v => SC.H - SC.B - (v - view.y0) / (view.y1 - view.y0) * (SC.H - SC.T - SC.B);

function ticks(lo, hi) {
  const out = [];
  for (let e = Math.floor(lo); e <= Math.ceil(hi); e++) {
    [1, 2, 5].forEach(m => {
      const v = m * Math.pow(10, e), l = Math.log10(v);
      if (l >= lo && l <= hi) out.push(v);
    });
  }
  return out.length > 9 ? out.filter((_, i) => i % 2 === 0) : out;
}

function scatter() {
  clear(svgScatter);
  drawn = [];
  ticks(view.x0, view.x1).forEach(v => {
    const X = spx(Math.log10(v));
    svgScatter.appendChild(el("line", {class: "g", x1: X, y1: SC.T, x2: X,
      y2: SC.H - SC.B}));
    svgScatter.appendChild(txt(fmt(v), {class: "ax", x: X, y: SC.H - SC.B + 18,
      "text-anchor": "middle"}));
  });
  ticks(view.y0, view.y1).forEach(v => {
    const Y = spy(Math.log10(v));
    svgScatter.appendChild(el("line", {class: "g", x1: SC.L, y1: Y, x2: SC.W - SC.R, y2: Y}));
    svgScatter.appendChild(txt(yLab(v), {class: "ax", x: SC.L - 7, y: Y + 4,
      "text-anchor": "end"}));
  });

  const floor = state().floor;
  let shown = 0;
  D.scatter.points.forEach(p => {
    const lx = Math.log10(p.a), ly = Math.log10(p.d);
    if (lx < view.x0 || lx > view.x1 || ly < view.y0 || ly > view.y1) return;
    const on = p.d >= floor;
    if (on) shown++;
    const X = spx(lx), Y = spy(ly);
    svgScatter.appendChild(el("circle", {class: "pt sp" + (on ? "" : " lo"),
      cx: X.toFixed(1), cy: Y.toFixed(1), r: on ? 2.4 : 1.4, opacity: on ? 0.5 : 0.16}));
    drawn.push({x: X, y: Y, p: p});
  });
  D.callouts.forEach(c => {
    const lx = Math.log10(c.a), ly = Math.log10(c.d);
    if (lx < view.x0 || lx > view.x1 || ly < view.y0 || ly > view.y1) return;
    const X = spx(lx), Y = spy(ly);
    svgScatter.appendChild(el("circle", {class: "hi", cx: X.toFixed(1), cy: Y.toFixed(1),
      r: 4}));
    svgScatter.appendChild(txt(c.n, {class: "lbl", x: (X + 7).toFixed(1),
      y: (Y + 3.5).toFixed(1)}));
    drawn.push({x: X, y: Y, p: {t: c.t, au: c.au, a: c.a, d: c.d}});
  });
  svgScatter.appendChild(txt("AGE IN YEARS", {class: "axl", x: SC.L, y: SC.H - 6}));
  svgScatter.appendChild(txt("READERS A MONTH", {class: "axl", x: SC.L, y: SC.T - 8}));
  const z = (HOME.x1 - HOME.x0) / (view.x1 - view.x0);
  document.getElementById("scatnote").textContent =
    "Every " + D.scatter.meta.stride + "th work by catalogue number - " +
    fmt(D.scatter.meta.kept) + " of " + fmt(D.scatter.meta.of) +
    ", one uniform stride so the density you see is the real density. " + fmt(shown) +
    " above the threshold" + (z > 1.05 ? ", zoomed " + z.toFixed(1) + "x" : "") + ".";
}

function toUser(ev) {
  const r = svgScatter.getBoundingClientRect();
  return {x: (ev.clientX - r.left) / r.width * SC.W,
          y: (ev.clientY - r.top) / r.height * SC.H};
}

svgScatter.addEventListener("wheel", ev => {
  ev.preventDefault();
  const u = toUser(ev);
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
svgScatter.addEventListener("pointerdown", ev => {
  dragging = {u: toUser(ev), v: Object.assign({}, view)};
  svgScatter.classList.add("drag");
  svgScatter.setPointerCapture(ev.pointerId);
});
svgScatter.addEventListener("pointerup", () => {
  dragging = null;
  svgScatter.classList.remove("drag");
});
svgScatter.addEventListener("pointermove", ev => {
  const u = toUser(ev);
  if (dragging) {
    const dx = (u.x - dragging.u.x) / (SC.W - SC.L - SC.R)
             * (dragging.v.x1 - dragging.v.x0);
    const dy = (u.y - dragging.u.y) / (SC.H - SC.T - SC.B)
             * (dragging.v.y1 - dragging.v.y0);
    view = {x0: dragging.v.x0 - dx, x1: dragging.v.x1 - dx,
            y0: dragging.v.y0 + dy, y1: dragging.v.y1 + dy};
    scatter();
    tip.classList.remove("on");
    return;
  }
  let best = null, bd = 225;
  for (const d of drawn) {
    const q = (d.x - u.x) * (d.x - u.x) + (d.y - u.y) * (d.y - u.y);
    if (q < bd) { bd = q; best = d; }
  }
  if (!best) { tip.classList.remove("on"); return; }
  clear(tip);
  const b = document.createElement("b");
  b.textContent = best.p.t || "?";
  const sp = document.createElement("span");
  sp.textContent = (best.p.au ? best.p.au + DOT : "") + fmt(best.p.a) + " yrs old"
    + DOT + fmt(best.p.d) + " readers a month";
  tip.appendChild(b);
  tip.appendChild(sp);
  const r = svgScatter.getBoundingClientRect();
  tip.style.left = Math.min(r.width - 260, best.x / SC.W * r.width + 12) + "px";
  tip.style.top = Math.max(0, best.y / SC.H * r.height - 46) + "px";
  tip.classList.add("on");
});
svgScatter.addEventListener("pointerleave", () => tip.classList.remove("on"));
svgScatter.addEventListener("dblclick", () => {
  view = Object.assign({}, HOME);
  scatter();
});

/* ----------------------------------------------------------------- state */
const slider = document.getElementById("floor");
function state() { return D.states[Math.min(slider.value, D.states.length - 1)]; }

function draw() {
  const st = state();
  shelf(document.getElementById("shelf"), st);
  median(document.getElementById("medchart"), st);
  spread(document.getElementById("spread"), st);
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
  .forEach(s2 => {
    const b = document.createElement("span");
    b.textContent = fmt(s2.floor);
    tk.appendChild(b);
  });
slider.max = String(D.states.length - 1);
slider.addEventListener("input", () => { readout(); draw(); });
readout();
draw();
