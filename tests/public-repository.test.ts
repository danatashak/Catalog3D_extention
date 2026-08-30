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
      "docs/design-decisions.md",
      "PUBLISHING.md",
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

  // The version string lives in five hand-edited places. Nothing injects it at
  // build time, so this is what keeps a release from shipping a loader that
  // reports a version its own changelog and docs disagree with.
  it("states one consistent version across the package, source, types, and docs", async () => {
    const { version } = JSON.parse(await read("package.json")) as { version: string };
    expect(await read("src/index.ts")).toContain(`export const version = "${version}"`);
    expect(await read("src/index.d.ts")).toContain(`export declare const version = "${version}"`);
    expect(await read("docs/api-reference.md")).toContain(`The current version is \`${version}\``);
    expect(await read("CHANGELOG.md")).toContain(`## ${version} -`);
  });

  it("ships a browser tag build and a module build that stay in step with src", async () => {
    const [browserBuild, moduleBuild, publishedTypes, sourceTypes, packageJson] =
      await Promise.all([
        read("dist/catalog3d.js"),
        read("dist/catalog3d.mjs"),
        read("dist/index.d.ts"),
        read("src/index.d.ts"),
        read("package.json"),
      ]);
    const { version } = JSON.parse(packageJson) as { version: string };

    expect(browserBuild).toContain(`Catalog3D Embed v${version}`);
    expect(moduleBuild).toContain(`Catalog3D Embed v${version}`);
    // `import { mount } from "@catalog3d/embed"` used to fail: the package
    // shipped only the IIFE bundle, which exposes no module exports.
    expect(moduleBuild).toMatch(/export\s*\{[\s\S]*\bmount\b/u);
    expect(publishedTypes).toBe(sourceTypes);
  });
});
