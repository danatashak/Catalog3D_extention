import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const host = "127.0.0.1";
const port = Number.parseInt(process.env.CATALOG3D_EXAMPLE_PORT || "4174", 10);
const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
]);

// Only the two directories the example actually needs. The previous version
// served the whole project root, which exposed node_modules and package.json to
// anything that could reach the loopback port.
const servedRoots = ["dist", "examples"].map((name) => resolve(projectRoot, name));
const isServable = (filePath) =>
  servedRoots.some(
    (root) => filePath === root || filePath.startsWith(`${root}${sep}`),
  );

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${host}:${port}`);
    const pathname = decodeURIComponent(url.pathname);
    const requestedPath = pathname.endsWith("/") ? `${pathname}index.html` : pathname;
    const filePath = resolve(projectRoot, `.${requestedPath}`);

    if (!isServable(filePath)) {
      response.writeHead(403, {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      });
      response.end("Forbidden");
      return;
    }

    const file = await stat(filePath);
    if (!file.isFile()) throw new Error("Not a file");
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Length": file.size,
      "Content-Type": mimeTypes.get(extname(filePath)) || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404, {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    });
    response.end("Not found");
  }
});

server.listen(port, host, () => {
  process.stdout.write(
    `Catalog3D product-page example: http://${host}:${port}/examples/product-page/\n`,
  );
});
