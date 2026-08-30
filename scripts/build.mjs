import { copyFile, mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { build } from "esbuild";

const projectRoot = resolve(import.meta.dirname, "..");
const outputDirectory = resolve(projectRoot, "dist");
const packageMetadata = JSON.parse(
  await readFile(resolve(projectRoot, "package.json"), "utf8"),
);
const banner = {
  js: `/*! Catalog3D Embed v${packageMetadata.version} | https://catalog3d.ai */`,
};
const shared = {
  banner,
  bundle: true,
  entryPoints: [resolve(projectRoot, "src/index.ts")],
  legalComments: "none",
  platform: "browser",
};

await mkdir(outputDirectory, { recursive: true });

// The browser tag build. No esbuild `globalName`: the source installs
// `window.Catalog3D` itself and refuses to replace a loader that is already on
// the page, which a `globalName` wrapper assignment would silently undo.
await build({
  ...shared,
  format: "iife",
  minify: true,
  outfile: resolve(outputDirectory, "catalog3d.js"),
  target: ["es2020"],
});

// The npm build. Bundlers and `import` need real module exports; the previous
// package shipped only the IIFE, so `import { mount } from "@catalog3d/embed"`
// failed with "does not provide an export named 'mount'". Left unminified so
// downstream stack traces stay readable; the consumer's bundler minifies it.
await build({
  ...shared,
  format: "esm",
  minify: false,
  outfile: resolve(outputDirectory, "catalog3d.mjs"),
  target: ["es2022"],
});

await copyFile(
  resolve(projectRoot, "src/index.d.ts"),
  resolve(outputDirectory, "index.d.ts"),
);
