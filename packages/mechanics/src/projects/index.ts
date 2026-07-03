/**
 * `projects` mechanic: one-shot/repeatable purchases (@idlekitjs/mechanics/projects).
 *
 * `ProjectManager` is a public helper of this mechanic: it is surfaced only
 * through this module, never as its own subpath.
 */
export { projects } from "./extension";
export type { ProjectsOptions, ProjectsExtension } from "./extension";
export type { Project } from "./project";
export { ProjectManager } from "./manager";
