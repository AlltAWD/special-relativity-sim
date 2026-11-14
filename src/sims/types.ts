/**
 * Every simulation is a plain module with this shape. `mount` builds its DOM
 * inside `root` and returns a cleanup function that removes listeners,
 * observers and animation loops when the user switches to another simulation.
 */
export interface Sim {
  id: string;
  title: string;
  blurb: string;
  /** Set on placeholders: the navigation marks the simulation as not ready yet. */
  soon?: boolean;
  mount(root: HTMLElement): () => void;
}
