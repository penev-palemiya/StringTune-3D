import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    outExtension: ({ format }) => (format === "esm" ? { js: ".mjs" } : { js: ".cjs" }),
    clean: true,
    minify: true,
    sourcemap: true,
  },
  {
    entry: ["src/index.ts"],
    format: ["iife"],
    globalName: "StringTune3D",
    outExtension: () => ({ js: ".js" }),
    minify: true,
    sourcemap: true,
  },
]);
