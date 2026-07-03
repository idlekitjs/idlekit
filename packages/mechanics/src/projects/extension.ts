import type { Extension } from "@idlekitjs/types";
import { ProjectManager } from "./manager";
import type { Project } from "./project";

/** Coerce an arbitrary value (badly-implemented getCompleted) into a list of IDs. */
function asIdList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
}

export interface ProjectsOptions<T extends object> {
  projects: Project<T>[];
  /** Read the completed project IDs from the state. */
  getCompleted: (state: T) => string[];
  /** Write the completed project IDs into the state. */
  setCompleted: (state: T, ids: string[]) => void;
  /** Notified when a project was just purchased (e.g. to trigger a save). */
  onComplete?: (id: string, state: T) => void;
}

export interface ProjectsExtension<T extends object> extends Extension<T> {
  /** Underlying project manager (for rendering on the game side). */
  manager: ProjectManager<T>;
  /** Try to buy a project and persist the progress into the state. */
  buy(id: string, state: T): boolean;
}

/**
 * Projects: owns the `ProjectManager`, restores progress on load (`loaded`
 * event) and keeps the completed projects in sync within the state. Rendering
 * stays on the game side and consumes `plugin.manager`.
 */
export function projects<T extends object>(options: ProjectsOptions<T>): ProjectsExtension<T> {
  const manager = new ProjectManager<T>(options.projects);
  return {
    id: "projects",
    manager,
    setup(engine) {
      engine.events.on("loaded", () => {
        manager.restore(asIdList(options.getCompleted(engine.state)));
      });
    },
    buy(id, state) {
      if (!manager.complete(id, state)) {
        return false;
      }
      options.setCompleted(state, manager.completedIds());
      options.onComplete?.(id, state);
      return true;
    },
  };
}
