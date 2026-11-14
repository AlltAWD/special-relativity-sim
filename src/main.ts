import './styles/fonts.css';
import './styles/tokens.css';
import './styles/shell.css';
import './styles/kit.css';
import { sims } from './sims';
import { kit } from './sims/kit';
import type { Sim } from './sims/types';
import { el } from './ui/controls';
import { currentTheme, onThemeChange, setTheme } from './ui/theme';

const SITE = 'Special Relativity Simulator';

// The UI kit page is a tool for porting, so it is listed only in `npm run dev`.
const pages: Sim[] = import.meta.env.DEV ? [...sims, kit] : sims;

const navList = document.querySelector<HTMLElement>('#nav .nav-list')!;
const index = document.querySelector<HTMLElement>('#sim-index')!;
const title = document.querySelector<HTMLElement>('#sim-title')!;
const blurb = document.querySelector<HTMLElement>('#sim-blurb')!;
const stage = document.querySelector<HTMLElement>('#stage')!;
const themeToggle = document.querySelector<HTMLButtonElement>('#theme-toggle')!;

const two = (n: number) => String(n).padStart(2, '0');

// ---------- Navigation ----------

const links = new Map<Sim, HTMLAnchorElement>();
pages.forEach((sim, i) => {
  const link = el('a', { href: `#${sim.id}` },
    el('span', { className: 'nav-num' }, two(i + 1)),
    el('span', { className: 'nav-title' }, sim.title),
  );
  if (sim.soon) link.append(el('span', { className: 'nav-tag' }, 'Soon'));
  if (import.meta.env.DEV && sim === kit) link.append(el('span', { className: 'nav-tag' }, 'Dev'));
  links.set(sim, link);
  navList.append(el('li', {}, link));
});

let current: Sim | null = null;
let unmount: (() => void) | null = null;

/**
 * Show the simulation named in the URL hash (#spacetime). No hash means the
 * first one. A hash that is not a simulation (the skip link's #main) leaves
 * the current one alone, so its state is not thrown away.
 */
function show() {
  const id = location.hash.slice(1);
  const sim = (id ? pages.find((s) => s.id === id) : pages[0]) ?? current ?? pages[0];
  if (sim === current) return;

  unmount?.();
  current = sim;
  index.textContent = `${two(pages.indexOf(sim) + 1)} / ${two(pages.length)}`;
  title.textContent = sim.title;
  blurb.textContent = sim.blurb;
  document.title = `${sim.title} · ${SITE}`;
  for (const [page, link] of links) {
    if (page === sim) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  // On a narrow window the navigation is a scrolling strip: bring the current item into it.
  navList.scrollTo({ left: links.get(sim)!.offsetLeft - navList.offsetLeft - 16 });
  unmount = sim.mount(stage);
}

window.addEventListener('hashchange', show);
show();

// ---------- Theme ----------

function labelThemeToggle() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  themeToggle.setAttribute('aria-label', `Switch to the ${next} theme`);
  themeToggle.title = `Switch to the ${next} theme`;
}

themeToggle.addEventListener('click', () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark'));
onThemeChange(labelThemeToggle);
labelThemeToggle();
