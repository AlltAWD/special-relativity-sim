/**
 * Every simulation is a plain module with this shape. `mount` builds its DOM
 * inside `root` and returns a cleanup function that removes listeners,
 * observers and animation loops when the user switches tabs.
 */
export interface Sim {
  id: string;
  title: string;
  blurb: string;
  mount(root: HTMLElement): () => void;
}
