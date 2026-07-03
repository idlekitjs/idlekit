/**
 * @idlekitjs/dom - DOM renderer and declarative bindings for @idlekitjs games.
 *
 * `@idlekitjs/core` is headless: it never depends on this package. The dependency
 * only ever flows `@idlekitjs/dom -> @idlekitjs/core`. Games create a `Renderer`
 * here and inject it into the engine via `createEngine({ ..., renderer })`.
 *
 * Strictly DOM rendering: browser runtime bridges (rAF frame scheduler, page
 * lifecycle, screen helpers) live in `@idlekitjs/browser`.
 */
export { Renderer } from "./renderer";
export { bindText, bindClass, bindVisible, bindDisabled } from "./bind";
export { bindEach } from "./bind-each";
export type { BindEachOptions } from "./bind-each";
export type { Binding } from "@idlekitjs/types";
