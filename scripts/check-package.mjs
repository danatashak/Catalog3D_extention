import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { JSDOM } from "jsdom";

const projectRoot = resolve(import.meta.dirname, "..");
const packageMetadata = JSON.parse(
  await readFile(resolve(projectRoot, "package.json"), "utf8"),
);

// Import through the package's own public name so Node resolves the `exports`
// map exactly as an installed consumer would.
const moduleSdk = await import("@catalog3d/embed");
assert.equal(typeof moduleSdk.mount, "function");
assert.equal(typeof moduleSdk.Catalog3DError, "function");
assert.equal(moduleSdk.version, packageMetadata.version);

// Execute the checked-in browser artifact twice. The first tag must install the
// global; the second must retain that exact object rather than replacing the
// mounted-target registry hidden behind it.
const browserSource = await readFile(
  resolve(projectRoot, "dist/catalog3d.js"),
  "utf8",
);
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  runScripts: "dangerously",
  url: "https://merchant.example/product",
});
dom.window.eval(browserSource);
const firstGlobal = dom.window.Catalog3D;
assert.equal(typeof firstGlobal?.mount, "function");
assert.equal(firstGlobal?.version, packageMetadata.version);
dom.window.eval(browserSource);
assert.equal(dom.window.Catalog3D, firstGlobal);
dom.window.close();

process.stdout.write(
  `Verified ESM exports and duplicate browser-tag behavior for ${packageMetadata.name}@${packageMetadata.version}.\n`,
);
