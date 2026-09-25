"""Fetch everything the eval needs for one Figma frame into this directory.

    FIGMA_PAT=... python3 fetch.py <file_key> <node_id>

Writes data/node.json, layers/<name>.png (names from layers/manifest.json, plus
reference_2x.png for the frame itself) and fonts/. All outputs are gitignored:
they are client design data. The PAT is read from the environment only.
"""

import json
import os
import sys
import urllib.parse
import urllib.request

FONTS_CSS = (
    "https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500;600"
    "&family=Roboto+Condensed:ital,wght@0,600;0,700;1,900&display=swap"
)
# Google serves woff2 only to browsers that advertise support.
BROWSER_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36"


def get(url, headers=None):
    req = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def figma(path, pat):
    return json.loads(get(f"https://api.figma.com/v1/{path}", {"X-Figma-Token": pat}))


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    file_key, node_id = sys.argv[1], sys.argv[2].replace("-", ":")
    pat = os.environ.get("FIGMA_PAT")
    if not pat:
        sys.exit("FIGMA_PAT is not set")

    os.makedirs("data", exist_ok=True)
    os.makedirs("layers", exist_ok=True)
    os.makedirs("fonts", exist_ok=True)

    node = figma(f"files/{file_key}/nodes?ids={urllib.parse.quote(node_id)}", pat)
    with open("data/node.json", "w") as f:
        json.dump(node, f)
    print("wrote data/node.json")

    with open("layers/manifest.json") as f:
        manifest = json.load(f)
    manifest["reference_2x"] = node_id
    ids = ",".join(manifest.values())
    images = figma(
        f"images/{file_key}?ids={urllib.parse.quote(ids)}&scale=2&format=png&use_absolute_bounds=true",
        pat,
    )
    if images.get("err"):
        sys.exit(f"figma image export failed: {images['err']}")
    for name, nid in manifest.items():
        url = images["images"].get(nid)
        if not url:
            sys.exit(f"no export returned for {name} ({nid})")
        with open(f"layers/{name}.png", "wb") as f:
            f.write(get(url))
        print(f"wrote layers/{name}.png")

    css = get(FONTS_CSS, {"User-Agent": BROWSER_UA}).decode()
    with open("fonts/google.css", "w") as f:
        f.write(css)
    for part in css.split("url(")[1:]:
        url = part.split(")")[0]
        local = url.replace("https://fonts.gstatic.com/", "").replace("/", "_")
        with open(f"fonts/{local}", "wb") as f:
            f.write(get(url))
    print("wrote fonts/")


if __name__ == "__main__":
    main()
