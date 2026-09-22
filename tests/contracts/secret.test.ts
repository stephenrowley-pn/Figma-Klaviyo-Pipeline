import { describe, expect, it } from "vitest";
import { Secret } from "../../packages/contracts/src/secret.js";

describe("Secret", () => {
  it("exposes the wrapped value only through .expose()", () => {
    const secret = new Secret("sk_live_super_secret");
    expect(secret.expose()).toBe("sk_live_super_secret");
  });

  it("hides the value from toString()", () => {
    const secret = new Secret("sk_live_super_secret");
    expect(String(secret)).not.toContain("sk_live_super_secret");
    expect(`${secret}`).not.toContain("sk_live_super_secret");
  });

  it("hides the value from JSON.stringify — structured logging cannot leak it", () => {
    const secret = new Secret("sk_live_super_secret");
    const logLine = JSON.stringify({ event: "auth", apiKey: secret });
    expect(logLine).not.toContain("sk_live_super_secret");
  });

  it("hides the value from Node's util.inspect / console formatting", () => {
    const secret = new Secret("sk_live_super_secret");
    const inspectSymbol = Symbol.for("nodejs.util.inspect.custom");
    const inspect = (secret as unknown as Record<symbol, unknown>)[inspectSymbol];
    if (typeof inspect !== "function") {
      throw new Error("Secret does not implement the Node inspect symbol");
    }
    expect(inspect()).not.toContain("sk_live_super_secret");
  });
});
