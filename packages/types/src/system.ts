/** A system advances the state by one time step `dt` (in seconds). */
export type System<T extends object> = (state: T, dt: number) => void;
