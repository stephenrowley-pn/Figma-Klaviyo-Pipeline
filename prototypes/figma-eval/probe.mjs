import { withPage } from "./render.mjs";
const [file, sel] = process.argv.slice(2);
await withPage(async (page) => {
  await page.goto("file://" + process.cwd() + "/" + file, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  console.log(await page.evaluate((sel) => {
    let e = document.querySelector(sel); const out = [];
    for (let i = 0; e && i < 8; i++, e = e.parentElement) { const r = e.getBoundingClientRect(); out.push(`${e.tagName} y=${(r.y + scrollY).toFixed(3)} h=${r.height.toFixed(3)} ${e.getAttribute("style")?.slice(0, 60) ?? ""}`); }
    return out.join("\n");
  }, sel));
}, { scale: 2 });
