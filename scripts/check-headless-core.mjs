#!/usr/bin/env node
/**
 * Headless-core guard.
 *
 * Fails if `packages/core/src` references a browser global in executable code.
 * `@idlekitjs/core` is headless: browser drivers live in `@idlekitjs/dom` and
 * `@idlekitjs/plugins`. Comments/JSDoc are ignored so the boundary can still be
 * documented in prose.
 *
 * Usage: `node scripts/check-headless-core.mjs` (npm run check:headless-core).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "packages", "core", "src");

const FORBIDDEN = [
  "document",
  "window",
  "HTMLElement",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "localStorage",
  "navigator",
];
const TOKEN_RE = new RegExp(`\\b(${FORBIDDEN.join("|")})\\b`);

/** Recursively collect .ts files under `dir`. */
function collect(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collect(full));
    } else if (entry.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Strip comments so only executable code is scanned:
 * - block comments `/* ... *\/` (including JSDoc), even multi-line;
 * - full-line `//` and JSDoc-continuation `*` lines;
 * - trailing `// ...` on a code line.
 */
function stripComments(source) {
  const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//g, "");
  return withoutBlocks
    .split("\n")
    .map((line) => {
      const trimmed = line.trimStart();
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) return "";
      return line.replace(/\/\/.*$/, "");
    })
    .join("\n");
}

const violations = [];
for (const file of collect(SRC)) {
  const code = stripComments(readFileSync(file, "utf8"));
  code.split("\n").forEach((line, i) => {
    const match = TOKEN_RE.exec(line);
    if (match) {
      violations.push({
        file: relative(ROOT, file),
        line: i + 1,
        token: match[1],
        text: line.trim(),
      });
    }
  });
}

if (violations.length > 0) {
  console.error("✗ headless-core guard: browser globals found in packages/core/src:\n");
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  [${v.token}]  ${v.text}`);
  }
  console.error(
    "\n@idlekitjs/core must stay headless. Move browser code to @idlekitjs/dom or a plugin.",
  );
  process.exit(1);
}

console.log(`✓ headless-core guard: no browser globals in packages/core/src (${FORBIDDEN.length} tokens checked).`);
