import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/page-lifecycle/index.ts",
    "src/raf-scheduler/index.ts",
    "src/screen/index.ts",
  ],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "es2020",
  external: [/^@idlekitjs\//],
});
