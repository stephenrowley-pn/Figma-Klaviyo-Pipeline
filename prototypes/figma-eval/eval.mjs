// Fidelity eval: rendered email vs Figma's own 2x render of frame 8485:12367.
//
//   node eval.mjs <email.html> [--json out.json]
//
// 1. Visual: pixelmatch (threshold 0.1, anti-aliasing detection on) over the full 600x3896 frame
//    and per section, at 2x. A height mismatch counts every missing/extra row as failed pixels.
// 2. Per node, for every visible TEXT node and every exported image layer in the spec:
//    - present: an element with data-figma-id=<id> exists in the rendered DOM
//    - style:   computed font-family/size/weight/style/line-height, letter-spacing, text-transform
//               and colour equal the spec values
//    - offset:  the (dx, dy) shift, searched to +/-8px, that best aligns the rendered crop with the
//               reference crop of the node's box. 0,0 means it sits where Figma put it.
//    - match:   pixelmatch inside the node's box at zero shift
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { withPage } from "./render.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const SCALE = 2;
const FRAME = { w: 600, h: 3896 };
const SECTIONS = [
  ["header", 0, 105],
  ["hero_top", 105, 725],
  ["hero_copy", 725, 1154],
  ["lifestyle", 1154, 2059],
  ["section", 2059, 2811],
  ["shop", 2811, 3161],
  ["usps", 3161, 3586],
  ["footer", 3586, 3896],
];
const PASS = { overall: 99.0, section: 97.0, offset: 1.0, node: 95.0 };

const spec = JSON.parse(fs.readFileSync(path.join(here, "spec.json"), "utf8"));
const S = Object.fromEntries(spec.map((n) => [n.id, n]));
const BB = JSON.parse(fs.readFileSync(path.join(here, "bb.json"), "utf8"));
const manifest = JSON.parse(fs.readFileSync(path.join(here, "layers/manifest.json"), "utf8"));

const htmlFile = path.resolve(process.argv[2] ?? path.join(here, "out/email.sim.html"));
const jsonOut = process.argv.includes("--json") ? process.argv[process.argv.indexOf("--json") + 1] : null;
const renderFile = htmlFile.replace(/\.html$/, "") + "_2x.png";

// Nodes to check: every visible text node with visible ancestors, plus every exported layer.
const hidden = new Set(["I8485:12402;6020:1532"]); // social icons: black on black, invisible in the design
const TEXT_IDS = spec.filter((n) => n.type === "TEXT" && n.visible && !hidden.has(n.id) && n.id !== "8485:12379").map((n) => n.id);
const IMAGE_IDS = Object.entries(manifest).filter(([k]) => k !== "reference_2x" && !["hero_gradient", "section_black", "section_white", "banner", "diagram", "section_photo", "usps_photo"].includes(k)).map(([, v]) => v);

const { dom, height } = await withPage(
  async (page, { blocked }) => {
    await page.goto(`file://${htmlFile}`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: renderFile, fullPage: true });
    if (blocked.length) console.log("BLOCKED requests (eval not hermetic):", blocked);
    const dom = await page.evaluate(() => {
      const out = {};
      for (const el of document.querySelectorAll("[data-figma-id]")) {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        out[el.getAttribute("data-figma-id")] = {
          x: r.x, y: r.y + window.scrollY, w: r.width, h: r.height,
          family: cs.fontFamily, size: cs.fontSize, weight: cs.fontWeight, style: cs.fontStyle,
          lh: cs.lineHeight, ls: cs.letterSpacing, transform: cs.textTransform, color: cs.color,
          text: el.innerText,
        };
      }
      return out;
    });
    return { dom, height: await page.evaluate(() => document.documentElement.scrollHeight) };
  },
  { scale: SCALE },
);

const ref = PNG.sync.read(fs.readFileSync(path.join(here, "layers/reference_2x.png")));
const got0 = PNG.sync.read(fs.readFileSync(renderFile));
// Normalise the render onto the reference canvas: crop or pad (magenta, never matches) to 1200x7792.
const got = new PNG({ width: ref.width, height: ref.height });
for (let i = 0; i < got.data.length; i += 4) { got.data[i] = 255; got.data[i + 1] = 0; got.data[i + 2] = 255; got.data[i + 3] = 255; }
PNG.bitblt(got0, got, 0, 0, Math.min(got0.width, ref.width), Math.min(got0.height, ref.height), 0, 0);

function crop(png, x, y, w, h) {
  const X = Math.max(0, Math.round(x * SCALE)), Y = Math.max(0, Math.round(y * SCALE));
  const W = Math.min(png.width - X, Math.round(w * SCALE)), H = Math.min(png.height - Y, Math.round(h * SCALE));
  const o = new PNG({ width: W, height: H });
  PNG.bitblt(png, o, X, Y, W, H, 0, 0);
  return o;
}
function match(a, b, diffOut) {
  const d = diffOut ?? new PNG({ width: a.width, height: a.height });
  const n = pixelmatch(a.data, b.data, d.data, a.width, a.height, { threshold: 0.1 });
  return { pct: (1 - n / (a.width * a.height)) * 100, n, d };
}

// ── visual ──────────────────────────────────────────────────────────────────────
const full = match(ref, got);
fs.writeFileSync(htmlFile.replace(/\.html$/, "") + "_diff.png", PNG.sync.write(full.d));
const sections = SECTIONS.map(([name, y0, y1]) => {
  const m = match(crop(ref, 0, y0, 600, y1 - y0), crop(got, 0, y0, 600, y1 - y0));
  return { name, y0, y1, pct: m.pct, n: m.n };
});

// ── per node ────────────────────────────────────────────────────────────────────
const lum = (png) => {
  const L = new Float32Array(png.width * png.height);
  for (let i = 0; i < L.length; i++) L[i] = 0.299 * png.data[i * 4] + 0.587 * png.data[i * 4 + 1] + 0.114 * png.data[i * 4 + 2];
  return L;
};
const REF_L = lum(ref), GOT_L = lum(got);
function sad(bx, by, bw, bh, dx, dy) {
  // sum |ref(x,y) - got(x+dx, y+dy)| over the box, device px
  let s = 0, n = 0;
  for (let y = by; y < by + bh; y++) {
    const gy = y + dy;
    if (y < 0 || y >= ref.height || gy < 0 || gy >= ref.height) continue;
    for (let x = bx; x < bx + bw; x++) {
      const gx = x + dx;
      if (x < 0 || x >= ref.width || gx < 0 || gx >= ref.width) continue;
      s += Math.abs(REF_L[y * ref.width + x] - GOT_L[gy * ref.width + gx]); n++;
    }
  }
  return n ? s / n : 1e9;
}
function bestShift(b) {
  const bx = Math.round(b.x * SCALE), by = Math.round(b.y * SCALE), bw = Math.round(b.w * SCALE), bh = Math.round(b.h * SCALE);
  const R = 8 * SCALE;
  let best = { dx: 0, dy: 0, s: sad(bx, by, bw, bh, 0, 0) };
  const zero = best.s;
  for (let pass = 0; pass < 2; pass++) {
    for (let dy = -R; dy <= R; dy++) { const s = sad(bx, by, bw, bh, best.dx, dy); if (s < best.s - 1e-9) best = { ...best, dy, s }; }
    for (let dx = -R; dx <= R; dx++) { const s = sad(bx, by, bw, bh, dx, best.dy); if (s < best.s - 1e-9) best = { ...best, dx, s }; }
  }
  // Positive = the render sits right/below the reference by that many CSS px.
  return { dx: best.dx / SCALE, dy: best.dy / SCALE, sadZero: zero, sadBest: best.s };
}

const hex = (rgb) => {
  const m = rgb.match(/\d+(\.\d+)?/g).map(Number);
  return `#${m.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
};
function styleIssues(id, d) {
  const t = S[id].text;
  const issues = [];
  if (!t.overrides?.length) {
    const fam = d.family.split(",")[0].replaceAll(/["']/g, "").trim();
    if (fam !== t.family && !(t.family === "Century Gothic" && fam === "Jost")) issues.push(`family ${fam}≠${t.family}`);
    if (Math.abs(parseFloat(d.size) - t.size) > 0.01) issues.push(`size ${d.size}≠${t.size}`);
    if (Number(d.weight) !== t.weight) issues.push(`weight ${d.weight}≠${t.weight}`);
    if ((d.style === "italic") !== !!t.italic) issues.push(`style ${d.style}`);
    const lsWant = t.letterSpacing ?? 0;
    const lsGot = d.ls === "normal" ? 0 : parseFloat(d.ls);
    if (Math.abs(lsGot - lsWant) > 0.01) issues.push(`letter-spacing ${d.ls}≠${lsWant}`);
    const col = S[id].fills[0][1];
    if (hex(d.color) !== col.toLowerCase()) issues.push(`colour ${hex(d.color)}≠${col}`);
  }
  if ((t.case === "UPPER") !== (d.transform === "uppercase")) issues.push(`text-transform ${d.transform}≠${t.case}`);
  const want = t.chars.replaceAll(" ", "\n").replaceAll(" ", " ").replace(/\s+/g, " ").trim().toLowerCase();
  const gotText = d.text.replaceAll(" ", " ").replace(/\s+/g, " ").trim().toLowerCase();
  if (want !== gotText) issues.push(`text "${gotText.slice(0, 40)}"≠"${want.slice(0, 40)}"`);
  return issues;
}

const nodes = [...TEXT_IDS, ...IMAGE_IDS].map((id) => {
  const b = BB[id];
  const d = dom[id];
  const m = match(crop(ref, b.x, b.y, b.w, b.h), crop(got, b.x, b.y, b.w, b.h));
  const sh = bestShift(b);
  const issues = d ? (S[id].type === "TEXT" ? styleIssues(id, d) : []) : ["MISSING from DOM"];
  if (Math.abs(sh.dx) > PASS.offset || Math.abs(sh.dy) > PASS.offset) issues.push(`offset dx=${sh.dx} dy=${sh.dy}`);
  if (m.pct < PASS.node) issues.push(`match ${m.pct.toFixed(1)}%`);
  return { id, name: S[id].name, type: S[id].type, pct: m.pct, ...sh, issues };
});

// ── report ──────────────────────────────────────────────────────────────────────
const fmt = (v) => v.toFixed(2).padStart(6);
console.log(`\nrender ${got0.width / SCALE}x${got0.height / SCALE} vs Figma ${FRAME.w}x${FRAME.h}  (${htmlFile.split("/").slice(-2).join("/")})`);
console.log(`\nOVERALL pixel match  ${fmt(full.pct)}%   (${full.n} of ${ref.width * ref.height} device px differ; pass ≥ ${PASS.overall}%)`);
console.log("\nsection        y-range      match");
for (const s of sections) console.log(`  ${s.name.padEnd(12)} ${String(s.y0).padStart(4)}–${String(s.y1).padEnd(4)}  ${fmt(s.pct)}%  ${s.pct >= PASS.section ? "" : "  <-- below " + PASS.section}`);
const failing = nodes.filter((n) => n.issues.length);
console.log(`\nnodes: ${nodes.length - failing.length}/${nodes.length} pass (present, style exact, offset ≤ ${PASS.offset}px, masked match ≥ ${PASS.node}%)`);
for (const n of nodes) {
  const flag = n.issues.length ? "FAIL" : " ok ";
  console.log(`  ${flag} ${n.id.padEnd(24)} ${n.name.slice(0, 26).padEnd(26)} match ${fmt(n.pct)}%  shift (${n.dx}, ${n.dy})  ${n.issues.join("; ")}`);
}
const pass = full.pct >= PASS.overall && sections.every((s) => s.pct >= PASS.section) && failing.length === 0 && got0.height / SCALE === FRAME.h;
console.log(`\nRESULT: ${pass ? "PASS" : "FAIL"}`);
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ overall: full.pct, height: got0.height / SCALE, sections, nodes, pass }, null, 2));
