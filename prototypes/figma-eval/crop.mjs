import fs from "node:fs";
import { PNG } from "pngjs";
// usage: node crop.mjs src.png out.png x y w h [scale]   (coords in 1x units)
const [src, out, x, y, w, h, sc = "2"] = process.argv.slice(2);
const s = Number(sc);
const img = PNG.sync.read(fs.readFileSync(src));
const W = Math.round(Number(w) * s), H = Math.round(Number(h) * s);
const o = new PNG({ width: W, height: H });
PNG.bitblt(img, o, Math.round(Number(x) * s), Math.round(Number(y) * s), W, H, 0, 0);
fs.writeFileSync(out, PNG.sync.write(o));
