/**
 * Light and dark themes.
 *
 * The theme is the `data-theme` attribute on <html>; styles/tokens.css defines
 * every colour for both. It follows the system setting until the visitor picks
 * one with the toggle, and that choice is remembered on this device.
 */

export type Theme = 'light' | 'dark';

const KEY = 'theme';
const listeners = new Set<() => void>();
const system = window.matchMedia('(prefers-color-scheme: dark)');

/** The visitor's saved choice, or null if they have never used the toggle. */
function saved(): Theme | null {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null; // storage can be blocked (private windows, strict settings)
  }
}

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function apply(theme: Theme): void {
  if (theme === currentTheme()) return;
  document.documentElement.dataset.theme = theme;
  for (const listener of listeners) listener();
}

/** Switch theme and remember the choice. */
export function setTheme(theme: Theme): void {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Not remembered, but the switch itself still works.
  }
  apply(theme);
}

/**
 * Run `listener` whenever the theme changes. Returns a function that stops it.
 * A canvas does not restyle itself the way HTML does, so anything drawn with
 * theme colours has to be redrawn (fitCanvas in controls.ts does this for you).
 */
export function onThemeChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

system.addEventListener('change', (event) => {
  if (!saved()) apply(event.matches ? 'dark' : 'light');
});

/**
 * Read CSS custom properties as they currently resolve on `node`:
 *
 *   const color = cssVars(canvas);
 *   ctx.strokeStyle = color('--sim-prime');
 *
 * Call it once per frame, not once per colour: it takes a style snapshot.
 */
export function cssVars(node: Element): (name: string) => string {
  const style = getComputedStyle(node);
  return (name) => style.getPropertyValue(name).trim();
}
