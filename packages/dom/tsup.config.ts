import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/bind-each/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "es2020",
  external: [/^@idlekitjs\//],
});
