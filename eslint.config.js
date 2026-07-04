import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/dev-dist/**",
      "**/node_modules/**",
      "_legacy/**",
      "coverage/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Node tooling scripts (not part of the TS project).
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: { console: "readonly", process: "readonly" },
    },
  },
  {
    // Package boundary: @idlekitjs/react is a framework binding layer over
    // @idlekitjs/core only (the React sibling of @idlekitjs/dom). It must not
    // pull in game, storage, plugin, or browser-runtime packages.
    files: ["packages/react/src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@idlekitjs/browser",
                "@idlekitjs/browser/*",
                "@idlekitjs/dom",
                "@idlekitjs/dom/*",
                "@idlekitjs/storage",
                "@idlekitjs/storage/*",
                "@idlekitjs/plugins",
                "@idlekitjs/plugins/*",
                "@idlekitjs/economy",
                "@idlekitjs/economy/*",
                "@idlekitjs/mechanics",
                "@idlekitjs/mechanics/*",
                "@idlekitjs/utils",
              ],
              message:
                "@idlekitjs/react may only depend on @idlekitjs/core: it is a React binding layer, not a game/storage/browser package.",
            },
          ],
        },
      ],
    },
  },
  prettier,
);
