# figma-eval — reference prototype

**Not production code.** Plain `.mjs`, outside the pnpm workspace, excluded
from Biome. It exists as evidence and as the reference the real packages are
rebuilt against (see `claude/specs/designer-review-app.md`). Do not import
from it.

What it proved on the Strongway reference frame (`NHJGtwm6DDJyf8voe0BM9o`,
node `8485:12367`), 25 September 2026: a `USER_DRAGGABLE` template whose
Klaviyo-saved **and** Klaviyo-rendered HTML scores 99.63% pixel match against
Figma's own 2x render, all eight sections ≥ 98.84%, 35/35 nodes passing, height
exact. Negative controls: a blank `#080808` page scores 54.05% (fail); the same
email with one section moved 3px scores 98.25% with 14/35 nodes (fail).

## Run it

```sh
npm install
FIGMA_PAT=... python3 fetch.py NHJGtwm6DDJyf8voe0BM9o 8485-12367   # data/, layers/, fonts/
python3 extract_spec.py                                              # spec.json, bb.json, rb.json
node gen.mjs                    # out/email.source.html (upload) + out/email.sim.html (as Klaviyo saves it)
node eval.mjs out/email.sim.html
```

`gen.mjs` points images at the harness's local asset host unless a `cdn.json`
(layer name → re-hosted Klaviyo URL) is present; `eval.mjs` maps those URLs
back to `layers/` via `asset-map.json`. Both files are gitignored. Set
`CHROME_PATH` if Chromium is not at the Claude Code sandbox path.

## Files

| File | Role |
| --- | --- |
| `fetch.py` | Figma node tree, 2x layer exports (`layers/manifest.json`), Google Fonts |
| `extract_spec.py` | Flattens the node tree to `spec.json` + exact boxes |
| `gen.mjs` | Spec → HTML. Section composition is hand-written; every number comes from the spec |
| `tune.json` | Measured Figma-vs-Chromium text offsets (see below) |
| `klaviyo-injected.css` | CSS Klaviyo injects on save, captured from a real read-back |
| `render.mjs` | Hermetic Playwright harness: fonts and images served locally, all else blocked |
| `eval.mjs` | Full-page + per-section pixelmatch, per-node style/offset/masked-match |
| `sbs.mjs`, `where.mjs`, `probe.mjs`, `crop.mjs`, `rows.mjs` | Debug helpers |

## What this taught us (carry into the real packages)

- **`layoutMode: NONE` frames:** JSON child order is paint order, not reading
  order. Sort by `absoluteBoundingBox.y`.
- **Figma "auto" line height is not CSS `normal`.** Jost 18px in an Inter-base
  text node pitched at 22px; legal copy at 17px. `tune.json` holds measured
  values. The real normaliser needs a font-metrics model, not guesses.
- **Layer exports are pixel-rounded** (banner 524.9×61.8 → 1050×124 at 2x).
  Display at exactly half the PNG size from the bounding-box origin.
- **Headless Chromium snaps fills to whole CSS pixels even at 2x**, so a 0.5px
  hairline cannot match in the harness (≈0.15% of the footer).
- **Klaviyo, observed on read-back:**
  - Region content survives only inside `class="klaviyo-block klaviyo-text-block"`;
    `klaviyo-text-block` alone is emptied to `kl-column empty-column-placeholder`.
  - Each region is rewrapped with `padding: 9px 18px` and a 14px Arial wrapper
    div. Children must carry every style inline.
  - `<link>` in `<head>` is stripped; `@import` and `@font-face` in `<style>` survive.
  - `{% unsubscribe_url %}` is **not** a valid tag (render API 400).
    `{% unsubscribe_link %}` renders to `[unsubscribe_tag]` and keeps the
    link's inline styles; `{% unsubscribe 'x' %}` renders an unstyled `<a>`.
  - Uploads via `import_from_url` are stored byte-identical.
- **Not covered by this eval:** Gmail/Outlook rendering (web fonts, stacked CSS
  backgrounds, the MSO fallbacks), mobile widths, image weight (~6MB of PNG).
