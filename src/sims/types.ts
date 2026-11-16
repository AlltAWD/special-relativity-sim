import type { IconName } from '../ui/icons';

/**
 * Every simulation is a plain module with this shape. `mount` builds its DOM
 * inside `root` and returns a cleanup function that removes listeners,
 * observers and animation loops when the user switches to another simulation.
 */
export interface Sim {
  id: string;
  title: string;
  blurb: string;
  /** Shown next to the title in the navigation. */
  icon: IconName;
  mount(root: HTMLElement): () => void;
}
