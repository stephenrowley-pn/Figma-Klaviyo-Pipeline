import fs from "node:fs";
import { PNG } from "pngjs";
// Print ink row runs in a 1x-coordinate box: rows where any pixel differs from bg by > tol.
const [src, x, y, w, h, sc = "2", tol = "60"] = process.argv.slice(2);
const s = Number(sc), T = Number(tol);
const img = PNG.sync.read(fs.readFileSync(src));
const X0 = Math.round(x * s), Y0 = Math.round(y * s), X1 = Math.round((+x + +w) * s), Y1 = Math.round((+y + +h) * s);
const px = (X, Y) => { const i = (Y * img.width + X) * 4; return [img.data[i], img.data[i + 1], img.data[i + 2]]; };
const bg = px(X0, Y0);
let runs = [], cur = null;
for (let Y = Y0; Y < Y1; Y++) {
  let ink = false, minX = 1e9, maxX = -1;
  for (let X = X0; X < X1; X++) {
    const p = px(X, Y);
    if (Math.abs(p[0] - bg[0]) + Math.abs(p[1] - bg[1]) + Math.abs(p[2] - bg[2]) > T) { ink = true; minX = Math.min(minX, X); maxX = Math.max(maxX, X); }
  }
  if (ink) { if (!cur) cur = { y0: Y, y1: Y, minX, maxX }; else { cur.y1 = Y; cur.minX = Math.min(cur.minX, minX); cur.maxX = Math.max(cur.maxX, maxX); } }
  else if (cur) { runs.push(cur); cur = null; }
}
if (cur) runs.push(cur);
for (const r of runs) console.log(`ink y ${(r.y0 / s).toFixed(1)}–${((r.y1 + 1) / s).toFixed(1)} (h ${((r.y1 - r.y0 + 1) / s).toFixed(1)})  x ${(r.minX / s).toFixed(1)}–${((r.maxX + 1) / s).toFixed(1)}`);
