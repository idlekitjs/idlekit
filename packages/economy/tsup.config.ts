import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/accessors/index.ts", "src/cost-curves/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "es2020",
  external: [/^@idlekitjs\//],
});
