/**
 * Layout pieces shared by the simulations: the workbench (figure beside a
 * control panel), panel groups, readouts, and typeset mathematics.
 */
import { el, type Tone } from './controls';

type Child = Node | string;

// ---------- Workbench ----------

export interface BenchParts {
  /** What goes in the figure area: usually one canvas, plus any overlays. */
  figure: Child[];
  /** A line under the figure: how to use it, what the units are. */
  caption?: Child[];
  /** Groups of controls and readouts, beside the figure (below it on a phone). */
  panel?: HTMLElement[];
}

/**
 * The frame every simulation lives in. On a wide window the figure fills the
 * height of the screen with the panel next to it, so changing a control and
 * reading the result never needs scrolling.
 */
export function bench(parts: BenchParts): HTMLElement {
  const figure = el('figure', { className: 'figure' }, el('div', { className: 'figure-frame' }, ...parts.figure));
  if (parts.caption) figure.append(el('figcaption', {}, ...parts.caption));
  const root = el('div', { className: 'bench' }, figure);
  if (parts.panel?.length) {
    root.classList.add('bench--split');
    const panel = el('div', { className: 'panel' }, ...parts.panel);
    panel.setAttribute('role', 'group');
    panel.setAttribute('aria-label', 'Controls and readouts');
    root.append(panel);
  }
  return root;
}

export interface GroupHead {
  title: Child[];
  /** Shown at the right of the title: a button or two, or a count. */
  aside: Child[];
}

/**
 * A titled section of the panel.
 *
 *   group('Show', toggleA, toggleB)
 *   group({ title: ['Events'], aside: [addButton] }, table)
 */
export function group(head: Child | Child[] | GroupHead, ...children: Child[]): HTMLElement {
  // A Node also has a `title` property, so rule that out before reading the head as options.
  const isHead = (value: typeof head): value is GroupHead =>
    typeof value === 'object' && !Array.isArray(value) && !(value instanceof Node);
  const { title, aside } = isHead(head) ? head : { title: Array.isArray(head) ? head : [head], aside: [] };
  const header = el('div', { className: 'group-head' }, el('h2', { className: 'group-title' }, ...title));
  if (aside.length) header.append(el('div', { className: 'group-aside' }, ...aside));
  return el('section', { className: 'group' }, header, ...children);
}

/** Put a few controls side by side, sharing the width. */
export function row(...children: Child[]): HTMLDivElement {
  return el('div', { className: 'row' }, ...children);
}

/** Secondary explanatory text. */
export function note(...children: Child[]): HTMLParagraphElement {
  return el('p', { className: 'note' }, ...children);
}

/** A two-column list of terms and what they mean. */
export function defs(...rows: [term: Child, meaning: Child][]): HTMLDListElement {
  const list = el('dl', { className: 'defs' });
  for (const [term, meaning] of rows) list.append(el('dt', {}, term), el('dd', {}, meaning));
  return list;
}

/** A key for the figure: each row is a marker and what it stands for. */
export function legend(...rows: [marker: Node, ...meaning: Child[]][]): HTMLUListElement {
  const list = el('ul', { className: 'legend' });
  for (const [marker, ...meaning] of rows) list.append(el('li', {}, marker, el('span', {}, ...meaning)));
  return list;
}

/** Text that screen readers announce but that is not shown. */
export function srOnly(text: string): HTMLSpanElement {
  return el('span', { className: 'sr-only' }, text);
}

// ---------- Readouts ----------

export interface Stat {
  el: HTMLElement;
  /** Show a new value. */
  set(value: string): void;
}

/** One number the simulation reports, with its name above it. */
export function stat(label: Child, value = '', tone?: Tone): Stat {
  const output = el('output', { className: 'stat-value' }, value);
  const root = el('div', { className: 'stat' }, el('span', { className: 'stat-label' }, label), output);
  if (tone) root.dataset.tone = tone;
  return {
    el: root,
    set(next) {
      output.textContent = next;
    },
  };
}

/** A row of stats that share the width evenly. */
export function stats(...items: Stat[]): HTMLElement {
  return el('div', { className: 'stats' }, ...items.map((item) => item.el));
}

// ---------- Mathematics ----------

/** Latin and lowercase Greek letters are variables (italic); a prime belongs to its letter. */
const isVariable = (ch: string) => /[A-Za-zα-ω′]/.test(ch);

/**
 * Typeset a short formula the way a textbook does: variables in italic,
 * numbers, operators and capital Greek upright.
 *
 *   math('t′ = γ(t − vx)')
 *   math('L = L_0 / γ')        _x and ^x set one character; _{...} and ^{...} a group
 *
 * Use a real minus sign (−) and prime (′), not a hyphen and an apostrophe.
 */
export function math(source: string): HTMLSpanElement {
  return el('span', { className: 'math' }, ...typeset(source));
}

function typeset(source: string): Node[] {
  const nodes: Node[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (ch === '_' || ch === '^') {
      let body: string;
      if (source[i + 1] === '{') {
        const close = source.indexOf('}', i);
        const end = close === -1 ? source.length : close;
        body = source.slice(i + 2, end);
        i = end + 1;
      } else {
        body = source[i + 1] ?? '';
        i += 2;
      }
      nodes.push(el(ch === '_' ? 'sub' : 'sup', {}, ...typeset(body)));
      continue;
    }
    // Take the longest run of the same kind: all variable letters, or all upright text.
    const variable = isVariable(ch);
    let j = i + 1;
    while (j < source.length && source[j] !== '_' && source[j] !== '^' && isVariable(source[j]) === variable) j++;
    const run = source.slice(i, j);
    nodes.push(variable ? el('var', {}, run) : document.createTextNode(run));
    i = j;
  }
  return nodes;
}

/** A stacked fraction. Strings are typeset with math(). */
export function frac(numerator: Child, denominator: Child): HTMLSpanElement {
  const part = (child: Child) => (typeof child === 'string' ? math(child) : child);
  return el('span', { className: 'frac' },
    el('span', { className: 'frac-num' }, part(numerator)),
    srOnly(' over '),
    el('span', { className: 'frac-den' }, part(denominator)),
  );
}

/** A formula set large on its own line. Strings are typeset with math(). */
export function formula(...parts: Child[]): HTMLDivElement {
  return el('div', { className: 'formula' }, ...parts.map((part) => (typeof part === 'string' ? math(part) : part)));
}
