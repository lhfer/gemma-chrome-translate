import { mkdir, cp } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, "dist");

await mkdir(dist, { recursive: true });

await esbuild.build({
  entryPoints: {
    background: path.join(root, "src/background/index.ts"),
    content: path.join(root, "src/content/index.ts"),
    popup: path.join(root, "src/popup/index.ts")
  },
  outdir: dist,
  bundle: true,
  minify: false,
  sourcemap: true,
  target: "chrome114",
  platform: "browser",
  format: "iife"
});

await cp(path.join(root, "public"), dist, { recursive: true });
