---
"@idlekitjs/core": patch
"@idlekitjs/economy": patch
"@idlekitjs/mechanics": patch
"@idlekitjs/storage": patch
"@idlekitjs/plugins": patch
"@idlekitjs/browser": patch
"@idlekitjs/dom": patch
"@idlekitjs/types": patch
"@idlekitjs/utils": patch
---

Docs: refresh package READMEs to match the current API and the documentation
site, and point each `homepage` at `https://idlekitjs.github.io/packages/<name>`.

No runtime or API changes. Highlights: `@idlekitjs/utils` now documents
`finiteOr`; `@idlekitjs/core` covers `parseNumber` / `SUFFIXES` /
`formatDurationSeconds` and the seconds-vs-`*Ms` duration convention;
`@idlekitjs/mechanics` documents the crafting speed/yield modifiers,
`yieldRounding`, and the container transfer helpers. Every README gains
Documentation and Repository links.
