// @vitest-environment node

/**
 * The loader ships to merchant pages that server-render (the documented Next.js
 * integration is one). Importing it on the server used to throw
 * `ReferenceError: HTMLElement is not defined` because the custom element class
 * was declared at module scope.
 */

import { describe, expect, it } from "vitest";

describe("server-rendering safety", () => {
  it("imports without a DOM and exposes the public surface", async () => {
    expect(typeof HTMLElement).toBe("undefined");
    const sdk = await import("../src/index");
    expect(typeof sdk.mount).toBe("function");
    expect(typeof sdk.version).toBe("string");
  });

  it("does not install a global when there is no window", async () => {
    const sdk = await import("../src/index");
    expect(sdk).toBeDefined();
    expect((globalThis as { Catalog3D?: unknown }).Catalog3D).toBeUndefined();
  });

  it("rejects a server-side mount with a public error rather than throwing", async () => {
    const { mount } = await import("../src/index");
    await expect(
      mount({ target: "#room", siteId: "catalog3d-demo", productId: "chair" }),
    ).rejects.toEqual(
      expect.objectContaining({
        code: "INVALID_CONFIG",
        message: "Catalog3D requires a browser environment.",
      }),
    );
  });
});
