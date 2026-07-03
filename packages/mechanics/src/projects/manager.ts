import type { Project } from "./project";

/**
 * Manages the lifecycle of a set of projects: visibility, purchase, and
 * tracking of completed projects (serializable for saving).
 *
 * Generic and decoupled from the state shape: all the business logic lives in
 * the `Project<T>` definitions provided by the game.
 */
export class ProjectManager<T> {
  private readonly byId = new Map<string, Project<T>>();
  private readonly completed = new Set<string>();

  constructor(projects: Project<T>[]) {
    for (const project of projects) {
      this.byId.set(project.id, project);
    }
  }

  /** Currently visible projects (triggered and not completed). */
  available(state: T): Project<T>[] {
    const result: Project<T>[] = [];
    for (const project of this.byId.values()) {
      const done = !project.repeatable && this.completed.has(project.id);
      if (!done && project.trigger(state)) {
        result.push(project);
      }
    }
    return result;
  }

  isCompleted(id: string): boolean {
    return this.completed.has(id);
  }

  /**
   * Try to purchase a project: check affordability, apply the effect and mark
   * the project as completed (unless it is repeatable).
   * Returns `true` if the purchase succeeded.
   */
  complete(id: string, state: T): boolean {
    const project = this.byId.get(id);
    if (!project) {
      return false;
    }
    if (!project.repeatable && this.completed.has(id)) {
      return false;
    }
    if (!project.affordable(state)) {
      return false;
    }
    project.effect(state);
    if (!project.repeatable) {
      this.completed.add(id);
    }
    return true;
  }

  /** Identifiers of completed projects (for saving). */
  completedIds(): string[] {
    return [...this.completed];
  }

  /** Restore completed projects from a save. */
  restore(ids: readonly string[]): void {
    this.completed.clear();
    for (const id of ids) {
      if (this.byId.has(id)) {
        this.completed.add(id);
      }
    }
  }
}
