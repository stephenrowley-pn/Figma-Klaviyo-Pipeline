import { describe, expect, it } from "vitest";
import { BlockSchema, DesignIRSchema, IR_VERSION } from "../../packages/contracts/src/design-ir.js";

const validDesignIR = {
  irVersion: IR_VERSION,
  figmaFileKey: "abc123",
  figmaFileVersion: "42",
  rootFigmaNodeId: "1:1",
  widthPx: 600,
  sections: [
    {
      figmaNodeId: "1:2",
      rows: [
        {
          figmaNodeId: "1:3",
          columnLayout: "1-column",
          columns: [
            {
              figmaNodeId: "1:4",
              widthFraction: 1,
              blocks: [
                {
                  type: "Text",
                  figmaNodeId: "1:5",
                  style: {},
                  runs: [{ text: "Hello" }],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
  unresolved: [],
};

describe("DesignIRSchema", () => {
  it("accepts a well-formed document", () => {
    expect(DesignIRSchema.parse(validDesignIR)).toEqual(validDesignIR);
  });

  it("rejects a width other than 600px — the canvas is a lint, not a runtime discovery", () => {
    const invalid = { ...validDesignIR, widthPx: 640 };
    expect(() => DesignIRSchema.parse(invalid)).toThrow();
  });

  it("rejects an unknown top-level field (strict object)", () => {
    const invalid = { ...validDesignIR, html: "<div>smuggled</div>" };
    expect(() => DesignIRSchema.parse(invalid)).toThrow();
  });

  it("records nodes the normaliser could not place, rather than dropping them", () => {
    const withUnresolved = {
      ...validDesignIR,
      unresolved: [{ figmaNodeId: "1:99", reason: "rotated element" }],
    };
    const parsed = DesignIRSchema.parse(withUnresolved);
    expect(parsed.unresolved).toHaveLength(1);
  });
});

describe("BlockSchema", () => {
  it("rejects a block type outside the closed vocabulary", () => {
    expect(() =>
      BlockSchema.parse({
        type: "Video",
        figmaNodeId: "1:5",
        style: {},
      }),
    ).toThrow();
  });

  it("rejects an Image block whose src is a figma.com URL", () => {
    expect(() =>
      BlockSchema.parse({
        type: "Image",
        figmaNodeId: "1:5",
        style: {},
        src: "https://figma.com/renders/abc.png",
        altText: "",
        widthPx: 100,
        heightPx: 100,
      }),
    ).toThrow();
  });

  it("accepts an Image block re-hosted off figma.com", () => {
    const image = BlockSchema.parse({
      type: "Image",
      figmaNodeId: "1:5",
      style: {},
      src: "https://cdn.example.com/abc.png",
      altText: "A product photo",
      widthPx: 100,
      heightPx: 100,
    });
    expect(image.type).toBe("Image");
  });

  // A Text block is one or more runs, and one run in the middle of a
  // paragraph can carry its own link — this is what an inline hyperlink
  // from Figma's styleOverrideTable (e.g. an unsubscribe link inside a
  // footer sentence) actually needs, and a flat `text: string` could not
  // represent.
  it("accepts a Text block with a link on one run in the middle of a paragraph", () => {
    const block = BlockSchema.parse({
      type: "Text",
      figmaNodeId: "1:5",
      style: {},
      runs: [
        { text: "No longer want to hear from us? " },
        { text: "Unsubscribe", href: "https://cdn.example.com/unsubscribe" },
        { text: ". Terms and conditions apply." },
      ],
    });
    expect(block.type === "Text" && block.runs).toHaveLength(3);
  });

  it("rejects a Text block with no runs", () => {
    expect(() =>
      BlockSchema.parse({
        type: "Text",
        figmaNodeId: "1:5",
        style: {},
        runs: [],
      }),
    ).toThrow();
  });

  it("rejects a Text run whose href is a figma.com URL", () => {
    expect(() =>
      BlockSchema.parse({
        type: "Text",
        figmaNodeId: "1:5",
        style: {},
        runs: [{ text: "Unsubscribe", href: "https://figma.com/whoops" }],
      }),
    ).toThrow();
  });
});
