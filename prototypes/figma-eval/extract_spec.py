import json

with open("data/node.json") as f:
    data = json.load(f)
root = next(iter(data["nodes"].values()))["document"]
RX, RY = root["absoluteBoundingBox"]["x"], root["absoluteBoundingBox"]["y"]

def hexc(c, opacity=None):
    a = c.get("a", 1) if opacity is None else opacity * c.get("a", 1)
    s = "#%02x%02x%02x" % (round(c["r"] * 255), round(c["g"] * 255), round(c["b"] * 255))
    return s if a >= 0.999 else f"{s}@{a:.2f}"

def fills(n):
    out = []
    for f in n.get("fills") or []:
        if f.get("visible") is False:
            continue
        t = f["type"]
        if t == "SOLID":
            out.append(("SOLID", hexc(f["color"], f.get("opacity"))))
        elif t.startswith("GRADIENT"):
            out.append((t, [(hexc(s["color"]), round(s["position"], 2)) for s in f["gradientStops"]]))
        elif t == "IMAGE":
            out.append(("IMAGE", f.get("scaleMode")))
    return out

specs = []
def walk(n, depth, parent_clips):
    b = n.get("absoluteBoundingBox") or {}
    item = {
        "id": n["id"], "name": n.get("name"), "type": n["type"], "depth": depth,
        "x": round(b.get("x", 0) - RX, 1), "y": round(b.get("y", 0) - RY, 1),
        "w": round(b.get("width", 0), 1), "h": round(b.get("height", 0), 1),
        "visible": n.get("visible", True), "opacity": n.get("opacity", 1),
        "rotation": round(n.get("rotation", 0) or 0, 3),
        "fills": fills(n), "effects": [e["type"] + ("" if e.get("visible", True) else "(off)") + (f" r={e.get('radius')}" if "radius" in e else "") for e in n.get("effects") or []],
        "cornerRadius": n.get("cornerRadius"), "strokes": [hexc(s["color"]) for s in n.get("strokes") or [] if s.get("type") == "SOLID"],
        "strokeWeight": n.get("strokeWeight") if n.get("strokes") else None,
        "clips": n.get("clipsContent"), "layoutMode": n.get("layoutMode"),
        "isMask": n.get("isMask", False),
    }
    if n["type"] == "TEXT":
        s = n.get("style", {})
        item["text"] = {
            "chars": n.get("characters"), "family": s.get("fontFamily"), "weight": s.get("fontWeight"),
            "size": s.get("fontSize"), "lineHeightPx": round(s.get("lineHeightPx", 0), 2),
            "letterSpacing": round(s.get("letterSpacing", 0), 2), "case": s.get("textCase"),
            "align": s.get("textAlignHorizontal"), "italic": s.get("italic", False),
            "decoration": s.get("textDecoration"),
            "overrides": n.get("characterStyleOverrides"),
            "overrideTable": {k: {kk: vv for kk, vv in v.items() if kk in ("fontFamily","fontWeight","fontSize","italic","textCase","textDecoration","fills","hyperlink")} for k, v in (n.get("styleOverrideTable") or {}).items()},
        }
    specs.append(item)
    for c in n.get("children") or []:
        walk(c, depth + 1, n.get("clipsContent"))

walk(root, 0, False)
with open("spec.json", "w") as f:
    json.dump(specs, f, indent=1)
print(len(specs), "nodes written to spec.json")


# Exact absolute bounding / render boxes relative to the root frame (spec.json is rounded to 1dp).
def walk(n):
    yield n
    for c in n.get("children", []):
        yield from walk(c)


def rel(b):
    return {"x": round(b["x"] - RX, 3), "y": round(b["y"] - RY, 3), "w": round(b["width"], 3), "h": round(b["height"], 3)}


bb = {n["id"]: rel(n["absoluteBoundingBox"]) for n in walk(root) if n.get("absoluteBoundingBox")}
rb = {n["id"]: rel(n["absoluteRenderBounds"]) for n in walk(root) if n.get("absoluteRenderBounds")}
with open("bb.json", "w") as f:
    json.dump(bb, f)
with open("rb.json", "w") as f:
    json.dump(rb, f)
