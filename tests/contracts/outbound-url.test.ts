import { describe, expect, it } from "vitest";
import { OutboundUrlSchema } from "../../packages/contracts/src/outbound-url.js";

describe("OutboundUrlSchema", () => {
  it("rejects a figma.com URL", () => {
    expect(() => OutboundUrlSchema.parse("https://figma.com/renders/abc.png")).toThrow();
  });

  it("rejects a figma.com subdomain", () => {
    expect(() => OutboundUrlSchema.parse("https://www.figma.com/file/abc")).toThrow();
  });

  it("accepts a re-hosted, content-addressed URL", () => {
    expect(OutboundUrlSchema.parse("https://cdn.example.com/assets/abc123.png")).toBe(
      "https://cdn.example.com/assets/abc123.png",
    );
  });

  // Known gap, documented in ADR 0004 and outbound-url.ts: Figma's S3 render
  // hosts are not caught. This test asserts the current (incomplete) state
  // rather than silently widening the deny list — flip this assertion, not
  // the deny list, when the S3 hosts are added at M2.
  it("does not yet catch Figma's S3 render hosts (tracked gap, not a passing guarantee)", () => {
    expect(() =>
      OutboundUrlSchema.parse("https://s3-alpha-sig.figma.com/img/abc/def.png"),
    ).toThrow(); // this one happens to match *.figma.com and IS caught
    // A genuinely different S3-owned hostname is NOT caught — this is the gap:
    expect(
      OutboundUrlSchema.parse("https://figma-alpha-api.s3.us-west-2.amazonaws.com/img.png"),
    ).toBe("https://figma-alpha-api.s3.us-west-2.amazonaws.com/img.png");
  });
});
