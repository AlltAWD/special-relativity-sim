/**
 * Controls shared by the simulations: sliders, switches, buttons, fields and
 * canvas sizing. No framework, just elements. Their looks live in
 * styles/kit.css, and `npm run dev` shows every one of them at
 * http://localhost:5173/#kit.
 */
import { ICON_PATHS, type IconName } from './icons';
import { onThemeChange } from './theme';

export type { IconName };

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node, props);
  node.append(...children);
  return node;
}

/**
 * Which physical thing a control or readout belongs to. It sets the colour, so
 * the slider that moves S' is the same green as the S' axes it moves.
 */
export type Tone = 'prime' | 'light' | 'timelike' | 'spacelike' | 'lightlike';

let nextId = 0;
const uniqueId = (prefix: string) => `${prefix}-${++nextId}`;

// ---------- Icons ----------

/** A Material Symbols icon. The names are the ones in ui/icons.ts. */
export function icon(name: IconName): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 -960 960 960');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('icon');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', ICON_PATHS[name]);
  svg.append(path);
  return svg;
}

// ---------- Slider ----------

export interface SliderOptions {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  format?: (value: number) => string;
  onInput: (value: number) => void;
  /** Colour the slider after the thing it controls. */
  tone?: Tone;
  /** Values to print under the track. Clicking one jumps to it. */
  marks?: number[];
}

/** How to move a slider from code, kept per slider element. See setSlider(). */
const sliderSetters = new WeakMap<HTMLElement, (value: number) => void>();

/**
 * A labelled range input that shows its current value. If the range spans
 * zero (a velocity from -0.95 to 0.95, say) the track fills outward from zero,
 * so the direction is visible at a glance.
 */
export function slider(opts: SliderOptions): HTMLElement {
  const format = opts.format ?? String;
  const id = uniqueId('slider');
  const fraction = (value: number) => (value - opts.min) / (opts.max - opts.min);

  const readout = el('output', {}, format(opts.value));
  readout.setAttribute('for', id);
  const input = el('input', {
    id,
    type: 'range',
    min: String(opts.min),
    max: String(opts.max),
    step: String(opts.step),
    value: String(opts.value),
  });
  const root = el('div', { className: 'slider' },
    el('div', { className: 'slider-head' }, el('label', { htmlFor: id }, opts.label), readout),
    input,
  );
  if (opts.tone) root.dataset.tone = opts.tone;

  // --p is the handle position and --o where the fill starts, both from 0 to 1.
  const origin = opts.min < 0 && opts.max > 0 ? fraction(0) : 0;
  root.style.setProperty('--o', String(origin));
  const paint = () => {
    const value = Number(input.value);
    root.style.setProperty('--p', String(fraction(value)));
    readout.textContent = format(value);
  };
  paint();
  sliderSetters.set(root, (value) => {
    input.value = String(value);
    paint();
  });

  input.addEventListener('input', () => {
    paint();
    opts.onInput(Number(input.value));
  });

  if (opts.marks?.length) {
    const marks = el('div', { className: 'slider-marks' });
    marks.setAttribute('aria-hidden', 'true'); // a pointer shortcut; the keyboard has the arrow keys
    for (const mark of opts.marks) {
      const jump = el('button', { type: 'button', tabIndex: -1 }, String(mark).replace('-', '−'));
      jump.style.setProperty('--at', String(fraction(mark)));
      jump.addEventListener('click', () => {
        if (input.disabled) return;
        input.value = String(mark);
        input.dispatchEvent(new Event('input'));
      });
      marks.append(jump);
    }
    root.append(marks);
  }

  return root;
}

/** Move a slider from code. This does not call its onInput. */
export function setSlider(root: HTMLElement, value: number): void {
  sliderSetters.get(root)?.(value);
}

/** Grey a slider out, or bring it back. */
export function enableSlider(root: HTMLElement, enabled: boolean): void {
  const input = root.querySelector('input');
  if (input) input.disabled = !enabled;
}

// ---------- Switch ----------

/** A small sample of what a switch shows or hides, drawn next to its label. */
export type Swatch = 'line' | 'dashed' | 'grid';

export interface ToggleOptions {
  swatch?: Swatch;
  tone?: Tone;
}

/** A labelled on/off switch. */
export function toggle(
  label: string,
  checked: boolean,
  onChange: (on: boolean) => void,
  opts: ToggleOptions = {},
): HTMLLabelElement {
  const input = el('input', { type: 'checkbox', checked });
  input.setAttribute('role', 'switch');
  input.addEventListener('change', () => onChange(input.checked));
  const root = el('label', { className: 'toggle' }, input, el('span', { className: 'toggle-track' }));
  if (opts.tone) root.dataset.tone = opts.tone;
  if (opts.swatch) root.append(swatch(opts.swatch));
  root.append(el('span', { className: 'toggle-label' }, label));
  return root;
}

/** A line, dashed line or grid sample in the current tone. Also useful in legends. */
export function swatch(kind: Swatch, tone?: Tone): HTMLSpanElement {
  const node = el('span', { className: 'swatch' });
  node.dataset.kind = kind;
  if (tone) node.dataset.tone = tone;
  node.setAttribute('aria-hidden', 'true');
  return node;
}

/** A filled dot. `color` is any CSS colour, such as 'var(--cat-1)'. */
export function dot(color: string): HTMLSpanElement {
  const node = el('span', { className: 'dot' });
  node.style.setProperty('--dot', color);
  node.setAttribute('aria-hidden', 'true');
  return node;
}

// ---------- Buttons ----------

export interface ButtonOptions {
  icon?: IconName;
  /** Show only the icon. The label is still what screen readers announce. */
  iconOnly?: boolean;
  /**
   * How much the button stands out: 'filled' for the one main action,
   * 'tonal' for a secondary one, 'outlined' (the default) and 'text' for the rest.
   */
  variant?: 'outlined' | 'filled' | 'tonal' | 'text';
  /** A more compact button, for a group's title row. */
  small?: boolean;
}

export function button(label: string, onClick: () => void, opts: ButtonOptions = {}): HTMLButtonElement {
  const node = el('button', { type: 'button', className: 'btn' });
  if (opts.variant && opts.variant !== 'outlined') node.classList.add(`btn--${opts.variant}`);
  if (opts.small) node.classList.add('btn--small');
  if (opts.icon) node.append(icon(opts.icon));
  if (opts.iconOnly) {
    node.classList.add('btn--icon');
    node.setAttribute('aria-label', label);
    node.title = label;
  } else {
    node.append(label);
  }
  node.addEventListener('click', onClick);
  return node;
}

/** A round button that is only an icon, with no outline: for quiet actions such as "remove". */
export function iconButton(label: string, name: IconName, onClick: () => void, small = false): HTMLButtonElement {
  const node = el('button', { type: 'button', className: 'icon-btn', title: label }, icon(name));
  if (small) node.classList.add('icon-btn--small');
  node.setAttribute('aria-label', label);
  node.addEventListener('click', onClick);
  return node;
}

export interface SegmentedOptions<T extends string> {
  /** Announced by screen readers; not shown. */
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  small?: boolean;
}

/** A row of mutually exclusive choices, such as a 2D / 3D view switch. */
export function segmented<T extends string>(opts: SegmentedOptions<T>): HTMLElement {
  const name = uniqueId('segmented');
  const root = el('div', { className: 'segmented' });
  if (opts.small) root.classList.add('segmented--small');
  root.setAttribute('role', 'radiogroup');
  root.setAttribute('aria-label', opts.label);
  for (const option of opts.options) {
    const input = el('input', { type: 'radio', name, value: option.value, checked: option.value === opts.value });
    input.addEventListener('change', () => {
      if (input.checked) opts.onChange(option.value);
    });
    root.append(el('label', {}, input, el('span', {}, icon('check'), option.label)));
  }
  return root;
}

// ---------- Fields ----------

export interface NumberFieldOptions {
  /** Shown above the field. Leave it out in a table, and give `name` instead. */
  label?: string;
  /** What screen readers announce when there is no visible label. */
  name?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  /** Called with a valid number each time the visitor changes the field. */
  onChange: (value: number) => void;
  small?: boolean;
}

export interface NumberField {
  el: HTMLElement;
  /** Show a new value. This does not call onChange. */
  set(value: number): void;
}

/** A box for typing a number. Out-of-range input is brought back into range. */
export function numberField(opts: NumberFieldOptions): NumberField {
  const input = el('input', { type: 'number', value: String(opts.value) });
  if (opts.min !== undefined) input.min = String(opts.min);
  if (opts.max !== undefined) input.max = String(opts.max);
  input.step = String(opts.step ?? 'any');
  if (opts.name) input.setAttribute('aria-label', opts.name);
  input.addEventListener('input', () => {
    const value = input.valueAsNumber;
    if (!Number.isFinite(value)) return; // half-typed, such as "-" or ""
    opts.onChange(Math.min(opts.max ?? Infinity, Math.max(opts.min ?? -Infinity, value)));
  });
  const root = el('label', { className: 'field' });
  if (opts.small) root.classList.add('field--small');
  if (opts.label) root.append(el('span', { className: 'field-label' }, opts.label));
  root.append(input);
  return {
    el: root,
    set(value) {
      // Leave the field alone while it is being typed in.
      if (document.activeElement !== input) input.value = String(value);
    },
  };
}

export interface SelectOptions<T extends string> {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  small?: boolean;
}

/** A menu of choices: for more options than fit in a segmented button. */
export function select<T extends string>(opts: SelectOptions<T>): HTMLElement {
  const menu = el('select', {}, ...opts.options.map((option) =>
    el('option', { value: option.value, selected: option.value === opts.value }, option.label)));
  menu.addEventListener('change', () => opts.onChange(menu.value as T));
  const root = el('label', { className: 'field' }, el('span', { className: 'field-label' }, opts.label), menu);
  if (opts.small) root.classList.add('field--small');
  return root;
}

// ---------- Canvas ----------

/** Draws one frame. Sizes are in CSS pixels; the context is already scaled for the screen. */
export type Draw = (ctx: CanvasRenderingContext2D, width: number, height: number) => void;

export interface CanvasView {
  /** Draw again now. Call this after changing anything the drawing depends on. */
  redraw(): void;
  /** Stop watching the canvas. Call this from the function `mount` returns. */
  stop(): void;
}

/**
 * Keep a canvas sharp and current. Its pixel buffer follows its displayed size
 * times the device pixel ratio, and `draw` runs again whenever the result
 * would look different: the canvas is resized, the page is zoomed or moved to
 * another screen, the theme changes, or a web font finishes loading.
 */
export function fitCanvas(canvas: HTMLCanvasElement, draw: Draw): CanvasView {
  const ctx = canvas.getContext('2d');
  let width = 0;
  let height = 0;

  const redraw = () => {
    if (!ctx || width === 0 || height === 0) return;
    const ratio = window.devicePixelRatio || 1;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw(ctx, width, height);
  };

  const fit = () => {
    const ratio = window.devicePixelRatio || 1;
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    redraw();
  };

  const observer = new ResizeObserver(fit);
  observer.observe(canvas);

  // A media query that stops matching as soon as the pixel ratio changes.
  let density: MediaQueryList | null = null;
  const onDensityChange = () => {
    watchDensity();
    fit();
  };
  const watchDensity = () => {
    density?.removeEventListener('change', onDensityChange);
    density = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    density.addEventListener('change', onDensityChange);
  };
  watchDensity();

  const stopTheme = onThemeChange(redraw);
  document.fonts.addEventListener('loadingdone', redraw);

  return {
    redraw,
    stop() {
      observer.disconnect();
      density?.removeEventListener('change', onDensityChange);
      stopTheme();
      document.fonts.removeEventListener('loadingdone', redraw);
    },
  };
}
