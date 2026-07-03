/**
 * Error thrown by @idlekitjs/economy for *programming errors only*: invalid
 * wiring (bad ids, duplicate registrations, malformed curves) and misuse of the
 * direct code path (`get`/`add`/`spend`/`pay` on unknown resources or with
 * invalid amounts).
 *
 * Content-shaped failures (a transaction the player cannot afford, a
 * requirement that is not met) never throw: `preview`/`execute` report them as
 * `TransactionFailure` diagnostics instead.
 */
export class EconomyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EconomyError";
  }
}
