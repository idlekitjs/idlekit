/**
 * @idlekitjs/utils - framework-agnostic helpers shared across @idlekitjs packages.
 *
 * Pure, platform-agnostic functions and tiny stateful meters, with no dependency
 * on the engine or the browser, so any package or game can use them freely.
 * Browser/display helpers (e.g. devicePixelRatio) live in @idlekitjs/browser.
 */
export { clamp, finiteOr, positiveOr } from "./num";
export { FrameRateMeter } from "./frameRate";
