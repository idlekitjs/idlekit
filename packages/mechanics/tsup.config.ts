import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/producers/index.ts",
    "src/producers/economy/index.ts",
    "src/modifiers/index.ts",
    "src/collections/index.ts",
    "src/collections/economy/index.ts",
    "src/projects/index.ts",
    "src/projects/economy/index.ts",
    "src/crafting/index.ts",
    "src/crafting/economy/index.ts",
    "src/boosts/index.ts",
    "src/boosts/economy/index.ts",
    "src/containers/index.ts",
    "src/containers/economy/index.ts",
    "src/timers/index.ts",
    "src/pickups/index.ts",
    "src/pickups/economy/index.ts",
  ],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "es2020",
  external: [/^@idlekitjs\//],
});
