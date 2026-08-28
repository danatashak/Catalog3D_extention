import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFile(resolve(root, path), "utf8");

describe("public repository documentation and examples", () => {
  it("ships every authoritative documentation page linked from the README", async () => {
    const documents = [
      "docs/integration-guide.md",
      "docs/api-reference.md",
      "docs/events-and-errors.md",
      "docs/appearance.md",
      "docs/frameworks.md",
      "docs/security-and-privacy.md",
      "docs/versioning.md",
      "examples/minimal-html/index.html",
      "examples/product-page/index.html",
      "examples/product-page/README.md",
      "LICENSE",
      "CHANGELOG.md",
    ];
    await expect(Promise.all(documents.map((path) => access(resolve(root, path))))).resolves.toBeDefined();
  });

  it("keeps the product-page example on the deliberately small public boundary", async () => {
    const source = (await Promise.all([
      read("examples/product-page/index.html"),
      read("examples/product-page/app.js"),
      read("examples/product-page/catalog3d-host.js"),
    ])).join("\n");
    const forbidden = [
      "WidgetPreviewClient",
      "authToken",
      "apiBase",
      "assetUrl",
      "jobId",
      "revisionId",
      "sceneItems",
      "setProduct(",
      "setItems(",
      "addItem(",
      "removeItem(",
      "loadRoom(",
      "openRoomPicker(",
      "setMode(",
    ];
    forbidden.forEach((term) => expect(source).not.toContain(term));
    expect(source).toContain("catalog3d.mount");
    expect(source).toContain("requestRemoval({ description })");
    expect(source).toContain("catalog3d:room-ready");
  });

  it("documents the complete public handle and the intentionally absent APIs", async () => {
    const apiReference = await read("docs/api-reference.md");
    expect(apiReference).toContain("destroy(): void");
    expect(apiReference).toContain("requestRemoval(request: { description: string })");
    expect(apiReference).toContain("Public v1 has no `setProduct`");
  });
});
