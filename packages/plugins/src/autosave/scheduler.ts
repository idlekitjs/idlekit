import type { SaveManager } from "@idlekitjs/core";

export interface SaveSchedulerOptions<T extends object> {
  /** Save manager to drive. */
  manager: SaveManager<T>;
  /** Provides the current state to save. */
  getState: () => T;
  /** Periodic autosave interval in milliseconds. 0 to disable. */
  intervalMs?: number;
}

/**
 * Triggers saving at the right points of the application lifecycle:
 *
 * - periodic autosave (safety net),
 * - going to the background (`visibilitychange` -> `hidden`): crucial on mobile,
 *   where the OS suspends JS and may kill the app without further notice,
 * - close / navigation (`pagehide`): more reliable than `beforeunload`,
 *   notably on mobile Safari.
 *
 * Since `localStorage` is synchronous, the write completes before the page is
 * actually unloaded.
 */
export class SaveScheduler<T extends object> {
  private intervalId: number | null = null;
  private attached = false;

  private readonly onVisibilityChange = (): void => {
    if (document.visibilityState === "hidden") {
      void this.save();
    }
  };

  private readonly onPageHide = (): void => {
    void this.save();
  };

  constructor(private readonly options: SaveSchedulerOptions<T>) {}

  /** Enable periodic autosave and the lifecycle listeners. */
  start(): void {
    if (this.attached) {
      return;
    }
    this.attached = true;

    const intervalMs = this.options.intervalMs ?? 0;
    if (intervalMs > 0) {
      this.intervalId = window.setInterval(() => void this.save(), intervalMs);
    }
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    window.addEventListener("pagehide", this.onPageHide);
  }

  /** Disable autosave and remove the listeners. */
  stop(): void {
    if (!this.attached) {
      return;
    }
    this.attached = false;

    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    window.removeEventListener("pagehide", this.onPageHide);
  }

  /** Immediate save, to call after an important action. */
  save(): Promise<void> {
    return this.options.manager.save(this.options.getState());
  }
}
