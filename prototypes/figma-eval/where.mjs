// Print DOM box vs Figma box for every data-figma-id element.
import fs from "node:fs";
import { withPage } from "./render.mjs";
const BB = JSON.parse(fs.readFileSync("bb.json", "utf8"));
const file = process.argv[2];
await withPage(async (page) => {
  await page.goto("file://" + process.cwd() + "/" + file, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const rows = await page.evaluate(() => [...document.querySelectorAll("[data-figma-id]")].map((e) => { const r = e.getBoundingClientRect(); return [e.getAttribute("data-figma-id"), r.x, r.y + scrollY, r.width, r.height]; }));
  for (const [id, x, y, w, h] of rows) { const b = BB[id]; if (!b) continue; const d = [x - b.x, y - b.y, w - b.w, h - b.h].map((v) => v.toFixed(2)); if (d.some((v) => Math.abs(v) > 0.01)) console.log(id.padEnd(24), "dx", d[0], "dy", d[1], "dw", d[2], "dh", d[3]); }
  console.log("doc height", await page.evaluate(() => document.documentElement.scrollHeight));
});
