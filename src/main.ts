import './style.css';
import { sims } from './sims';
import { el } from './ui/controls';

const nav = document.querySelector<HTMLElement>('#tabs')!;
const title = document.querySelector<HTMLElement>('#sim-title')!;
const blurb = document.querySelector<HTMLElement>('#sim-blurb')!;
const stage = document.querySelector<HTMLElement>('#stage')!;

let unmount: (() => void) | null = null;

/** Show the simulation named in the URL hash (#spacetime), defaulting to the first. */
function show() {
  const sim = sims.find((s) => `#${s.id}` === location.hash) ?? sims[0];
  unmount?.();
  title.textContent = sim.title;
  blurb.textContent = sim.blurb;
  for (const link of nav.querySelectorAll('a')) {
    link.setAttribute('aria-current', String(link.hash === `#${sim.id}`));
  }
  unmount = sim.mount(stage);
}

nav.append(...sims.map((s) => el('a', { href: `#${s.id}` }, s.title)));
window.addEventListener('hashchange', show);
show();
