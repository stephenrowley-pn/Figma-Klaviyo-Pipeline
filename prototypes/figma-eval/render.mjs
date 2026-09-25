import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const CHROME = process.env.CHROME_PATH ?? (fs.existsSync(DEFAULT_CHROME) ? DEFAULT_CHROME : undefined);

// Published CDN URL -> local file, so the eval renders exactly the HTML that ships
// without depending on live network access.
function loadAssetMap() {
  const p = path.join(here, "asset-map.json");
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : {};
}

function contentType(file) {
  if (file.endsWith(".png")) return "image/png";
  if (file.endsWith(".woff2")) return "font/woff2";
  if (file.endsWith(".css")) return "text/css";
  return "application/octet-stream";
}

export async function withPage(fn, { width = 600, scale = 1 } = {}) {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width, height: 800 }, deviceScaleFactor: scale });
  const assetMap = loadAssetMap();
  const blocked = [];

  await page.route("**/*", async (route) => {
    const url = route.request().url();
    const serve = (file) =>
      route.fulfill({ status: 200, contentType: contentType(file), body: fs.readFileSync(file) });

    if (url.startsWith("file://") || url.startsWith("data:")) return route.continue();
    if (url.startsWith("https://fonts.googleapis.com/css2")) return serve(path.join(here, "fonts/google.css"));
    if (url.startsWith("https://fonts.gstatic.com/")) {
      const local = path.join(here, "fonts", url.replace("https://fonts.gstatic.com/", "").replaceAll("/", "_"));
      if (fs.existsSync(local)) return serve(local);
    }
    if (url.startsWith("https://assets.local/")) {
      const local = path.join(here, url.replace("https://assets.local/", ""));
      if (fs.existsSync(local)) return serve(local);
    }
    if (assetMap[url] && fs.existsSync(path.join(here, assetMap[url]))) {
      return serve(path.join(here, assetMap[url]));
    }
    blocked.push(url);
    return route.abort();
  });

  try {
    return await fn(page, { blocked });
  } finally {
    await browser.close();
  }
}

export async function renderToPng(htmlFile, outFile, opts = {}) {
  return withPage(
    async (page, { blocked }) => {
      await page.goto(`file://${path.resolve(htmlFile)}`, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: outFile, fullPage: true });
      const size = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      }));
      return { size, blocked };
    },
    opts,
  );
}
