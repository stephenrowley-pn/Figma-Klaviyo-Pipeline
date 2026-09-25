// Strongway reference email: spec.json (Figma geometry/typography) -> USER_DRAGGABLE HTML.
// Every coordinate, size, font and colour is read from the spec; the only hand decisions are
// which nodes share a row/region, and the TUNE constants below (Figma-vs-Chromium text metrics),
// each of which was measured against the Figma render, not guessed.
//
//   node gen.mjs            -> out/email.source.html (what we upload) + out/email.sim.html
//                              (the same email as Klaviyo re-serialises it: region wrappers with
//                              9px/18px padding, wrapper div style replaced, Klaviyo's injected CSS)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const S = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(here, "spec.json"), "utf8")).map((n) => [n.id, n]));
// cdn.json maps layer name -> re-hosted Klaviyo URL. Without it, images point at the eval
// harness's local asset host, which is enough to build and score locally.
const CDN_FILE = path.join(here, "cdn.json");
const CDN = fs.existsSync(CDN_FILE)
  ? JSON.parse(fs.readFileSync(CDN_FILE, "utf8"))
  : new Proxy({}, { get: (_, name) => `https://assets.local/layers/${String(name)}.png` });
const MANIFEST = JSON.parse(fs.readFileSync(path.join(here, "layers/manifest.json"), "utf8"));
const KLAVIYO_CSS = fs.readFileSync(path.join(here, "klaviyo-injected.css"), "utf8");
const TUNE = JSON.parse(fs.readFileSync(path.join(here, "tune.json"), "utf8"));

const KPAD = { t: 9, r: 18, b: 9, l: 18 }; // observed on Klaviyo read-back of template WTnJpV
const HOME = "https://www.strongway.co.uk"; // CTA placeholder: no link exists in the Figma file (cta/missing-link)

const r2 = (v) => Math.round(v * 1000) / 1000;
const px = (v) => `${r2(v)}px`;
const esc = (s) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

// Exact bounding box (spec is 1dp; manifest layers use exact bb from the raw node dump).
const BB = JSON.parse(fs.readFileSync(path.join(here, "bb.json"), "utf8"));
const box = (id) => BB[id] ?? { x: S[id].x, y: S[id].y, w: S[id].w, h: S[id].h };

// Layer PNGs are exported at 2x with pixel-rounded dimensions; show them at exactly half size.
function layer(name) {
  const png = PNG.sync.read(fs.readFileSync(path.join(here, `layers/${name}.png`)));
  const b = box(MANIFEST[name]);
  return { name, id: MANIFEST[name], url: CDN[name], x: b.x, y: b.y, w: png.width / 2, h: png.height / 2 };
}

const FONT = {
  Jost: "Jost,'Century Gothic',Arial,sans-serif",
  "Roboto Condensed": "'Roboto Condensed','Arial Narrow',Arial,sans-serif",
};

function textCss(t) {
  return [
    "margin:0",
    "padding:0",
    `font-family:${FONT[t.family]}`,
    `font-size:${px(t.size)}`,
    `font-weight:${t.weight}`,
    t.italic && "font-style:italic",
    `line-height:${px(t.lh)}`,
    "mso-line-height-rule:exactly",
    `letter-spacing:${px(t.ls ?? 0)}`,
    t.upper && "text-transform:uppercase",
    `text-align:${t.align ?? "left"}`,
    `color:${t.color}`,
    t.decoration && t.decoration !== "none" && `text-decoration:${t.decoration}`,
  ]
    .filter(Boolean)
    .join(";");
}

function fromSpec(id, over = {}) {
  const n = S[id];
  const t = n.text;
  return {
    family: t.family,
    weight: t.weight,
    size: t.size,
    lh: t.lineHeightPx,
    ls: t.letterSpacing,
    upper: t.case === "UPPER",
    align: t.align.toLowerCase(),
    color: n.fills[0][1],
    italic: t.italic,
    decoration: t.decoration === "UNDERLINE" ? "underline" : "none",
    ...over,
  };
}

function fromOverride(id, key, over = {}) {
  const base = fromSpec(id);
  const o = S[id].text.overrideTable[key];
  const c = o.fills?.[0]?.color;
  const hex = c
    ? `#${[c.r, c.g, c.b].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("")}`
    : base.color;
  return {
    ...base,
    family: o.fontFamily ?? base.family,
    weight: o.fontWeight ?? base.weight,
    size: o.fontSize ?? base.size,
    upper: o.textCase ? o.textCase === "UPPER" : base.upper,
    italic: o.italic ?? base.italic,
    decoration: o.textDecoration === "UNDERLINE" ? "underline" : base.decoration,
    color: hex,
    ...over,
  };
}

const TABLE = 'role="presentation" border="0" cellpadding="0" cellspacing="0"';
const table = (w, rows, style = "") =>
  `<table ${TABLE} width="${Math.round(w)}" style="width:${px(w)};border-collapse:collapse;${style}">${rows}</table>`;

function spacer(h) {
  if (h <= 0) return "";
  return `<tr><td height="${Math.round(h)}" style="height:${px(h)};font-size:0;line-height:0;mso-line-height-rule:exactly;">&nbsp;</td></tr>`;
}

// A horizontal row of fixed-width cells, height h. cells: [width, html, extraStyle?]
function row(h, cells, attrs = "") {
  const sum = cells.reduce((a, c) => a + c[0], 0);
  if (Math.abs(sum - 600) > 0.01) throw new Error(`row widths sum to ${sum}`);
  const tds = cells
    .map(
      ([w, html, st = ""]) =>
        `<td width="${Math.round(w)}" valign="top" style="width:${px(w)};vertical-align:top;padding:0;${html ? "" : "font-size:0;line-height:0;"}${st}">${html || ""}</td>`,
    )
    .join("");
  return `<tr><td ${attrs} style="padding:0;"><table ${TABLE} width="600" style="width:600px;border-collapse:collapse;"><tr${h ? ` style="height:${px(h)}"` : ""}>${tds}</tr></table></td></tr>`;
}

// Editable region. `inner` must be block-level with complete inline styles: Klaviyo discards the
// klaviyo-text-block div's own style and wraps the content in its own 14px Arial div.
function region(w, inner) {
  const td = `data-klaviyo-region="true" data-klaviyo-region-width-pixels="${Math.round(w)}"`;
  if (CUR === "source") {
    return table(w, `<tr><td ${td} valign="top" style="padding:0;"><div class="klaviyo-block klaviyo-text-block">${inner}</div></td></tr>`);
  }
  const wrapped =
    `<div class="kl-column" style=""><div class="mj-column-per-100 mj-outlook-group-fix component-wrapper" style="font-size:0px;text-align:left;direction:ltr;vertical-align:top;width:100%;">` +
    `<table border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;" width="100%"><tbody><tr>` +
    `<td class="" style="vertical-align:top;padding-top:${KPAD.t}px;padding-right:${KPAD.r}px;padding-bottom:${KPAD.b}px;padding-left:${KPAD.l}px;">` +
    `<table border="0" cellpadding="0" cellspacing="0" role="presentation" style="" width="100%"><tbody><tr>` +
    `<td align="left" class="kl-text" style="font-size:0px;padding:0px;padding-top:0px;padding-right:0px;padding-bottom:0px;padding-left:0px;word-break:break-word;">` +
    `<div style="font-family:Arial;font-size:14px;font-style:normal;font-weight:400;letter-spacing:0px;line-height:1.3;text-align:left;color:#000000;">${inner}</div>` +
    `</td></tr></tbody></table></td></tr></tbody></table></div></div>`;
  return table(w, `<tr><td ${td} valign="top" style="padding:0;">${wrapped}</td></tr>`);
}

function img(name, alt, extra = "") {
  const l = layer(name);
  return `<img data-figma-id="${l.id}" src="${l.url}" width="${Math.round(l.w)}" height="${Math.round(l.h)}" alt="${esc(alt)}" style="display:block;width:${px(l.w)};height:${px(l.h)};border:0;outline:none;text-decoration:none;${extra}">`;
}

// Stack background layers (bottom first) as nested single-background elements, positioned in
// band coordinates. One background per element survives more clients than comma-separated lists.
function layered(bandY, bandH, bg, names, inner, id) {
  const ls = names.map(layer);
  const bgStyle = (l) =>
    `background-image:url('${l.url}');background-repeat:no-repeat;background-position:${px(l.x)} ${px(l.y - bandY)};background-size:${px(l.w)} ${px(l.h)};`;
  let html = inner;
  for (const l of ls.slice(1).reverse()) html = `<div style="${bgStyle(l)}">${html}</div>`;
  return `<tr><td data-figma-id="${id}" bgcolor="${bg}" valign="top" style="padding:0;height:${px(bandH)};background-color:${bg};${bgStyle(ls[0])}">${html}</td></tr>`;
}

const MODE = process.argv[2] ?? "all";
let CUR = "source";

function build() {
  const out = [];

  // ── Header 0–105 ──────────────────────────────────────────────────────────────
  const logo = layer("logo_header");
  out.push(
    `<tr><td data-figma-id="8485:12368" bgcolor="#ffffff" style="background-color:#ffffff;padding:${px(logo.y)} 0 ${px(105 - logo.y - logo.h)} ${px(logo.x)};">${img("logo_header", "Strongway")}</td></tr>`,
  );

  // ── Hero top 105–1154: diagram + gradient + banner behind live copy ───────────
  {
    const Y = 105;
    const H = 1154 - Y;
    const h1 = box("8485:12373");
    const sub = box("8485:12376");
    const btn = box("8485:12375");
    const cta = box("I8485:12375;1:897");
    const grip = box("8485:12374");
    const t1 = TUNE["8485:12373"] ?? 0;
    const tSub = TUNE["8485:12376"] ?? 0;
    const tGrip = TUNE["8485:12374"] ?? 0;
    const tCta = TUNE["I8485:12375;1:897"] ?? 0;

    const r1Top = h1.y + t1 - KPAD.t;
    const r1W = sub.w + KPAD.l + KPAD.r;
    const r1X = sub.x - KPAD.l;
    const heroCopy =
      `<h1 data-figma-id="8485:12373" style="${textCss(fromSpec("8485:12373"))};margin:0 ${px(h1.x - sub.x)} 0 ${px(sub.x + sub.w - h1.x - h1.w)};">${esc(S["8485:12373"].text.chars)}</h1>` +
      `<div data-figma-id="8485:12376" style="${textCss(fromSpec("8485:12376"))};margin:${px(sub.y + tSub - (h1.y + t1 + h1.h))} 0 0 0;">${esc(S["8485:12376"].text.chars)}</div>`;
    const r1H = KPAD.t + h1.h + (sub.y + tSub - (h1.y + t1 + h1.h)) + sub.h + KPAD.b;

    const gripTop = grip.y + tGrip - KPAD.t;
    const gripW = grip.w + KPAD.l + KPAD.r;

    const inner = table(
      600,
      `<!--[if mso]><tr><td style="padding:0;">${img("diagram", "Anatomical diagram of the gripping forearm muscles")}${img("banner", "Your hands give out", `margin-left:${px(layer("banner").x)};`)}</td></tr><![endif]-->` +
        `<!--[if !mso]><!-->${spacer(r1Top - Y)}<!--<![endif]-->` +
        row(0, [[r1X, ""], [r1W, region(r1W, heroCopy)], [600 - r1X - r1W, ""]]) +
        spacer(btn.y - (r1Top + r1H)) +
        row(btn.h, [[btn.x, ""], [btn.w, button("8485:12375", "I8485:12375;1:897", tCta)], [600 - btn.x - btn.w, ""]]) +
        spacer(gripTop - (btn.y + btn.h)) +
        row(0, [
          [grip.x - KPAD.l, ""],
          [gripW, region(gripW, `<h2 data-figma-id="8485:12374" style="${textCss(fromSpec("8485:12374"))}">${esc(S["8485:12374"].text.chars)}</h2>`)],
          [600 - grip.x - grip.w - KPAD.r, ""],
        ]) +
        spacer(1154 - (gripTop + KPAD.t + grip.h + KPAD.b)),
    );
    out.push(
      // Banner is a background layer: give assistive tech its words without adding height.
      `<tr><td style="padding:0;font-size:0;line-height:0;"><div style="max-height:0;overflow:hidden;font-size:0;line-height:0;color:#080808;mso-hide:all;">Your hands give out</div></td></tr>`,
    );
    out.push(layered(Y, H, "#080808", ["diagram", "hero_gradient", "banner"], inner, "8485:12370"));
  }

  // ── Lifestyle rows 1154–2059 ──────────────────────────────────────────────────
  {
    const rows = [
      { img: "life_deadlift", text: "8485:12388", alt: "Woman performing a deadlift" },
      { img: "life_pullups", text: "8485:12392", alt: "Man doing pull ups" },
      { img: "life_everyday", text: "8485:12396", alt: "Couple carrying grocery bags" },
    ];
    let cursor = 1154;
    let html = "";
    for (const r of rows) {
      const im = layer(r.img);
      const tb = box(r.text);
      const tt = TUNE[r.text] ?? { title: 0, gap: 10, lhTitle: 30, lhBody: 22 };
      const chars = S[r.text].text.chars;
      const [title, body] = chars.split("\n");
      const copy =
        `<div data-figma-id="${r.text}" style="margin:0;padding:0;width:${px(tb.w)};">` +
        `<h3 style="${textCss(fromOverride(r.text, "49", { lh: tt.lhTitle, align: "left" }))}">${esc(title)}</h3>` +
        `<div style="${textCss(fromOverride(r.text, "48", { lh: tt.lhBody, align: "left" }))};margin:${px(tt.gap)} 0 0 0;">${esc(body)}</div>` +
        `</div>`;
      const regW = tb.w + KPAD.l + KPAD.r;
      const textCell = [regW, region(regW, copy), `padding-top:${px(tb.y + tt.title - KPAD.t - im.y)};`];
      html += spacer(im.y - cursor);
      if (im.x < tb.x) {
        html += row(im.h, [[im.x, ""], [im.w, img(r.img, r.alt)], [tb.x - KPAD.l - im.x - im.w, ""], textCell, [600 - (tb.x - KPAD.l) - regW, ""]]);
      } else {
        html += row(im.h, [[tb.x - KPAD.l, ""], textCell, [im.x - (tb.x - KPAD.l) - regW, ""], [im.w, img(r.img, r.alt)], [600 - im.x - im.w, ""]]);
      }
      cursor = im.y + im.h;
    }
    html += spacer(2059 - cursor);
    out.push(`<tr><td bgcolor="#080808" style="padding:0;background-color:#080808;">${table(600, html)}</td></tr>`);
  }

  // ── Section 2059–2811: photo + diagonals behind copy and CTA ─────────────────
  {
    const Y = 2059;
    const H = 2811 - Y;
    const hd = box("8485:12384");
    const para = box("8485:12386");
    const btn = box("8485:12385");
    const tHd = TUNE["8485:12384"] ?? { top: -6, lh: 44 };
    const tPara = TUNE["8485:12386"] ?? 0;
    const hdTop = hd.y + tHd.top; // leading-trimmed box -> CSS line box top
    const hdH = 2 * tHd.lh;
    const regTop = hdTop - KPAD.t;
    const regW = para.w + KPAD.l + KPAD.r;
    const copy =
      `<h2 data-figma-id="8485:12384" style="${textCss(fromSpec("8485:12384", { lh: tHd.lh }))};width:${px(hd.w)};">${esc(S["8485:12384"].text.chars)}</h2>` +
      `<div data-figma-id="8485:12386" style="${textCss(fromSpec("8485:12386"))};margin:${px(para.y + tPara - (hdTop + hdH))} 0 0 0;">${esc(S["8485:12386"].text.chars)}</div>`;
    const inner = table(
      600,
      spacer(regTop - Y) +
        row(btn.y - regTop, [[para.x - KPAD.l, ""], [regW, region(regW, copy)], [600 - (para.x - KPAD.l) - regW, ""]]) +
        row(btn.h, [[btn.x, ""], [btn.w, button("8485:12385", "I8485:12385;1:897", TUNE["I8485:12385;1:897"] ?? 0)], [600 - btn.x - btn.w, ""]]) +
        spacer(Y + H - (btn.y + btn.h)),
    );
    out.push(layered(Y, H, "#080808", ["section_photo", "section_black", "section_white"], inner, "8485:12380"));
  }

  // ── Shop by Category 2811–3161 ────────────────────────────────────────────────
  {
    const Y = 2811;
    const title = box("I8485:12400;8008:529");
    const tt = fromSpec("I8485:12400;8008:529");
    const tTitle = TUNE["I8485:12400;8008:529"] ?? 0;
    const lineTop = title.y + (title.h - tt.lh) / 2 + tTitle; // textAlignVertical CENTER
    const regW = title.w + KPAD.l + KPAD.r;
    const titleHtml =
      `<h2 data-figma-id="I8485:12400;8008:529" style="${textCss(tt)}">` +
      `<span style="${textCss(fromOverride("I8485:12400;8008:529", "4"))};display:inline;">Shop by </span>` +
      `<span style="${textCss(fromOverride("I8485:12400;8008:529", "3"))};display:inline;">Category</span></h2>`;
    const tiles = [
      [["I8485:12400;8004:120", "I8485:12400;8004:121"], ["I8485:12400;8004:129", "I8485:12400;8004:130"]],
      [["I8485:12400;8004:126", "I8485:12400;8004:127"]],
      [["I8485:12400;8004:123", "I8485:12400;8004:124"], ["I8485:12400;8004:132", "I8485:12400;8004:133"]],
    ];
    let html = spacer(lineTop - KPAD.t - Y);
    html += row(0, [[title.x - KPAD.l, ""], [regW, region(regW, titleHtml)], [600 - (title.x - KPAD.l) - regW, ""]]);
    let cursor = lineTop + tt.lh + KPAD.b;
    for (const tr of tiles) {
      const first = box(tr[0][0]);
      html += spacer(first.y - cursor);
      const cells = [];
      let x = 0;
      for (const [rectId, textId] of tr) {
        const rb = box(rectId);
        const fill = S[rectId].fills[0][1];
        const stroke = S[rectId].strokes[0];
        const tb = box(textId);
        const ts = fromSpec(textId);
        const tTile = TUNE.tile ?? { dy: 0, dx: 0 };
        const lt = tb.y + (tb.h - ts.lh) / 2 + tTile.dy; // CENTER-aligned text line top
        // Centre on the text node's own box (not the tile); CSS letter-spacing also trails the
        // last glyph, which tTile.dx (= letter-spacing) cancels.
        const shift = 2 * (tb.x + tb.w / 2 - (rb.x + rb.w / 2)) + tTile.dx;
        const inner = `<div data-figma-id="${textId}" style="${textCss(ts)};padding:0 ${px(Math.max(0, -shift))} 0 ${px(Math.max(0, shift))};white-space:nowrap;">${esc(S[textId].text.chars)}</div>`;
        const sw = S[rectId].strokeWeight;
        const tile = `<table ${TABLE} width="${Math.round(rb.w)}" data-figma-id="${rectId}" style="width:${px(rb.w)};height:${px(rb.h)};border-collapse:separate;background-color:${fill};box-shadow:inset 0 0 0 ${px(sw)} ${stroke};" bgcolor="${fill}"><tr><td valign="top" style="padding:${px(lt - KPAD.t - rb.y)} 0 0 0;height:${px(rb.h - (lt - KPAD.t - rb.y))};vertical-align:top;">${region(rb.w, inner)}</td></tr></table>`;
        cells.push([rb.x - x, ""], [rb.w, tile]);
        x = rb.x + rb.w;
      }
      cells.push([600 - x, ""]);
      html += row(first.h, cells.filter((c) => c[0] > 0));
      cursor = first.y + first.h;
    }
    html += spacer(3161 - cursor);
    out.push(`<tr><td data-figma-id="8485:12400" bgcolor="#ffffff" style="padding:0;background-color:#ffffff;">${table(600, html)}</td></tr>`);
  }

  // ── USPs 3161–3586: greyscale photo behind four cards ─────────────────────────
  {
    const Y = 3161;
    const H = 3586 - Y;
    const cards = [
      [
        { card: "I8485:12401;8008:344", icon: "icon_trustpilot", title: "I8485:12401;8008:231", sub: "I8485:12401;8008:235", alt: "Trustpilot star" },
        { card: "I8485:12401;8008:411", icon: "icon_warranty", title: "I8485:12401;8008:412", sub: "I8485:12401;8008:413", alt: "Warranty shield" },
      ],
      [
        { card: "I8485:12401;8008:435", icon: "icon_steel", title: "I8485:12401;8008:436", sub: "I8485:12401;8008:437", alt: "Weight plates" },
        { card: "I8485:12401;8008:447", icon: "icon_delivery", title: "I8485:12401;8008:448", sub: "I8485:12401;8008:449", alt: "Delivery van" },
      ],
    ];
    let html = "";
    let cursor = Y;
    const tU = TUNE.usp ?? { title: 0, sub: 0, border: "rgba(0,0,0,0.5)" };
    for (const cr of cards) {
      const first = box(cr[0].card);
      html += spacer(first.y - cursor);
      const cells = [];
      let x = 0;
      for (const c of cr) {
        const cb = box(c.card);
        const ic = layer(c.icon);
        const tb = box(c.title);
        const sb = box(c.sub);
        const regX = tb.x - KPAD.l - cb.x; // region cell starts here within the card
        const regW = cb.w - regX;
        const copy =
          `<div data-figma-id="${c.title}" style="${textCss(fromSpec(c.title))};width:${px(tb.w)};">${esc(S[c.title].text.chars).replace(" ", "<br>")}</div>` +
          `<div data-figma-id="${c.sub}" style="${textCss(fromSpec(c.sub))};width:${px(sb.w)};margin:${px(sb.y + tU.sub - (tb.y + tU.title + tb.h))} ${px(regW - KPAD.l - KPAD.r - sb.w)} 0 0;">${esc(S[c.sub].text.chars)}</div>`;
        const card =
          `<table ${TABLE} width="${Math.round(cb.w)}" data-figma-id="${c.card}" bgcolor="#ffffff" style="width:${px(cb.w)};height:${px(cb.h)};border-collapse:separate;background-color:#ffffff;border-radius:${px(S[c.card].cornerRadius)};box-shadow:inset 0 0 0 0.5px ${tU.border};"><tr>` +
          `<td width="${Math.round(regX)}" valign="top" style="width:${px(regX)};padding:${px(ic.y - cb.y)} 0 0 ${px(ic.x - cb.x)};vertical-align:top;">${img(c.icon, c.alt)}</td>` +
          `<td width="${Math.round(regW)}" valign="top" style="width:${px(regW)};padding:${px(tb.y + tU.title - KPAD.t - cb.y)} 0 0 0;vertical-align:top;">${region(regW, copy)}</td>` +
          `</tr></table>`;
        cells.push([cb.x - x, ""], [cb.w, card]);
        x = cb.x + cb.w;
      }
      cells.push([600 - x, ""]);
      html += row(first.h, cells);
      cursor = first.y + first.h;
    }
    html += spacer(Y + H - cursor);
    out.push(layered(Y, H, "#ffffff", ["usps_photo"], table(600, html), "8485:12401"));
  }

  // ── Footer 3586–3896 ──────────────────────────────────────────────────────────
  {
    const Y = 3586;
    const lg = layer("logo_footer");
    const url = box("I8485:12402;8004:94");
    const line = { x: 26, y: 3733.5, w: 547 }; // render bounds of Line 4 (0.5px, centre stroke)
    const legal = box("I8485:12402;6020:1535");
    const tF = TUNE.footer ?? { url: 0, legal: 0, legalLh: 17 };
    const urlRegX = url.x - KPAD.l;
    const urlRegW = url.w + KPAD.l + KPAD.r;
    const lt = fromSpec("I8485:12402;6020:1535", { family: "Jost", lh: tF.legalLh });
    const bold = fromOverride("I8485:12402;6020:1535", "83", { lh: tF.legalLh });
    const link = fromOverride("I8485:12402;6020:1535", "84", { lh: tF.legalLh });
    const legalHtml =
      `<div data-figma-id="I8485:12402;6020:1535" style="${textCss(lt)};padding-left:${px(legal.x + legal.w / 2 - 300)};">` +
      `No longer want to hear from us?&nbsp;<a href="{% unsubscribe_link %}" style="${textCss(link)};display:inline;">Unsubscribe</a>` +
      `<span style="${textCss(bold)};display:inline;">.</span><br>` +
      `Terms and conditions apply. While stocks last. E&amp;OE.<br><br>` +
      `Unit 3, Wellessbourne Distribution Park<br>13 Loxley Rd, Wellesbourne<br>Warwick CV35 9JY</div>`;
    let html = spacer(lg.y - Y);
    html += row(lg.h, [
      [lg.x, ""],
      [lg.w, img("logo_footer", "Strongway")],
      [urlRegX - lg.x - lg.w, ""],
      [
        urlRegW,
        region(
          urlRegW,
          `<div data-figma-id="I8485:12402;8004:94" style="${textCss(fromSpec("I8485:12402;8004:94"))}"><a href="${HOME}" style="${textCss(fromSpec("I8485:12402;8004:94"))};text-decoration:none;display:inline;">${esc(S["I8485:12402;8004:94"].text.chars)}</a></div>`,
        ),
        `padding-top:${px(url.y + tF.url - KPAD.t - lg.y)};`,
      ],
      [600 - urlRegX - urlRegW, ""],
    ]);
    // Table rows snap to whole pixels, so the half-pixel line sits inside a 1px row.
    const lineRowY = Math.floor(line.y);
    html += spacer(lineRowY - (lg.y + lg.h));
    html += row(1, [[line.x, ""], [line.w, `<div data-figma-id="I8485:12402;8004:116" style="height:0.5px;margin-top:${px(line.y - lineRowY)};background-color:#ffffff;font-size:0;line-height:0;"></div>`, "height:1px;font-size:0;line-height:0;"], [600 - line.x - line.w, ""]]);
    const legalTop = legal.y + tF.legal - KPAD.t;
    html += spacer(legalTop - (lineRowY + 1));
    html += row(0, [[600, region(600, legalHtml)]]);
    html += spacer(3896 - (legalTop + KPAD.t + 6 * tF.legalLh + KPAD.b));
    out.push(`<tr><td data-figma-id="8485:12402" bgcolor="#000000" style="padding:0;background-color:#000000;">${table(600, html)}</td></tr>`);
  }

  return out.join("\n");
}

function button(btnId, textId, tune) {
  const b = box(btnId);
  const t = box(textId);
  const fill = S[btnId].fills[0][1];
  const top = t.y + tune - b.y; // CTA text box top within the button
  const inner = `<div style="margin:0;padding:0;text-align:center;"><a data-figma-id="${textId}" href="${HOME}" target="_blank" style="${textCss(fromSpec(textId, { lh: t.h }))};text-decoration:none;display:block;padding:${px(top - KPAD.t)} 0 ${px(b.h - top - t.h - KPAD.b)} 0;">${esc(S[textId].text.chars)}</a></div>`;
  return `<table ${TABLE} width="${Math.round(b.w)}" data-figma-id="${btnId}" bgcolor="${fill}" style="width:${px(b.w)};height:${px(b.h)};border-collapse:collapse;background-color:${fill};"><tr><td valign="top" style="padding:0;vertical-align:top;">${region(b.w, inner)}</td></tr></table>`;
}

function page(body, sim) {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>The muscle you cannot see but definitely need</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<style>body, table, td, div, h1, h2, h3, a, span { font-family: Arial, Helvetica, sans-serif !important; }</style>
<![endif]-->
${sim ? `<style>${KLAVIYO_CSS}</style>` : ""}
<style>
@import url('https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500;600&family=Roboto+Condensed:ital,wght@0,600;0,700;1,900&display=swap');
body { margin:0; padding:0; width:100% !important; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
table, td { border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt; }
img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
a[x-apple-data-detectors] { color:inherit !important; text-decoration:none !important; }
</style>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Your hands give out before your back does. Grip strength quietly limits every pulling movement you do.&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table ${TABLE} width="100%" style="width:100%;border-collapse:collapse;background-color:#ffffff;" bgcolor="#ffffff">
<tr><td align="center" style="padding:0;">
<!--[if mso]><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600"><tr><td><![endif]-->
<table ${TABLE} width="600" style="width:600px;max-width:600px;border-collapse:collapse;margin:0 auto;">
${body}
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>
`;
}

fs.mkdirSync(path.join(here, "out"), { recursive: true });
for (const m of MODE === "all" ? ["source", "sim"] : [MODE]) {
  CUR = m;
  const html = page(build(), m === "sim");
  fs.writeFileSync(path.join(here, `out/email.${m}.html`), html);
  console.log(`wrote out/email.${m}.html  ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB`);
}
