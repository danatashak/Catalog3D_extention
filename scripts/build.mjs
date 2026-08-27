import { copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { build } from "esbuild";

const projectRoot = resolve(import.meta.dirname, "..");
const outputDirectory = resolve(projectRoot, "dist");

await mkdir(outputDirectory, { recursive: true });
await build({
  banner: {
    js: "/*! Catalog3D Embed v1.0.0 | https://catalog3d.ai */",
  },
  bundle: true,
  entryPoints: [resolve(projectRoot, "src/index.ts")],
  format: "iife",
  globalName: "Catalog3D",
  legalComments: "none",
  minify: true,
  outfile: resolve(outputDirectory, "catalog3d.js"),
  platform: "browser",
  target: ["es2020"],
});
await copyFile(
  resolve(projectRoot, "src/index.d.ts"),
  resolve(outputDirectory, "index.d.ts"),
);
