// side-by-side: reference | render | diff, for a 1x-coordinate box
import fs from "node:fs";
import { PNG } from "pngjs";
const [x, y, w, h, out, base = "out/email.sim"] = process.argv.slice(2);
const S = 2, X = Math.round(x * S), Y = Math.round(y * S), W = Math.round(w * S), H = Math.round(h * S);
const imgs = ["layers/reference_2x.png", `${base}_2x.png`, `${base}_diff.png`].map((f) => PNG.sync.read(fs.readFileSync(f)));
const o = new PNG({ width: W * 3 + 20, height: H });
o.data.fill(128);
imgs.forEach((im, i) => PNG.bitblt(im, o, X, Y, Math.min(W, im.width - X), Math.min(H, im.height - Y), i * (W + 10), 0));
fs.writeFileSync(out, PNG.sync.write(o));
