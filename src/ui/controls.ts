/**
 * Controls shared by the simulations: sliders, switches, buttons and canvas
 * sizing. No framework, just elements. Their looks live in styles/kit.css, and
 * `npm run dev` shows every one of them at http://localhost:5173/#kit.
 */
import { onThemeChange } from './theme';

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

const ICONS = {
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>',
  pause: '<path d="M8.5 5.5v13M15.5 5.5v13"/>',
  reset: '<path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5M4.5 4.5V9H9"/>',
  plus: '<path d="M12 5.5v13M5.5 12h13"/>',
  close: '<path d="m6.5 6.5 11 11M17.5 6.5l-11 11"/>',
} as const;

export type IconName = keyof typeof ICONS;

export function icon(name: IconName): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('icon');
  svg.innerHTML = ICONS[name];
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

  // --p is the thumb position and --o where the fill starts, both from 0 to 1.
  const origin = opts.min < 0 && opts.max > 0 ? fraction(0) : 0;
  root.style.setProperty('--o', String(origin));
  const paint = () => {
    const value = Number(input.value);
    root.style.setProperty('--p', String(fraction(value)));
    readout.textContent = format(value);
  };
  paint();

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
        input.value = String(mark);
        input.dispatchEvent(new Event('input'));
      });
      marks.append(jump);
    }
    root.append(marks);
  }

  return root;
}

// ---------- Toggle ----------

/** A small sample of what a toggle shows or hides, drawn next to its label. */
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

// ---------- Buttons ----------

export interface ButtonOptions {
  icon?: IconName;
  /** Show only the icon. The label is still what screen readers announce. */
  iconOnly?: boolean;
  /** The main action of a group: filled instead of outlined. */
  primary?: boolean;
  /** A more compact button, for a group's title row. */
  small?: boolean;
}

export function button(label: string, onClick: () => void, opts: ButtonOptions = {}): HTMLButtonElement {
  const node = el('button', { type: 'button', className: 'btn' });
  if (opts.primary) node.classList.add('btn--primary');
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

export interface SegmentedOptions<T extends string> {
  /** Announced by screen readers; not shown. */
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/** A row of mutually exclusive choices, such as a 2D / 3D view switch. */
export function segmented<T extends string>(opts: SegmentedOptions<T>): HTMLElement {
  const name = uniqueId('segmented');
  const root = el('div', { className: 'segmented' });
  root.setAttribute('role', 'radiogroup');
  root.setAttribute('aria-label', opts.label);
  for (const option of opts.options) {
    const input = el('input', { type: 'radio', name, value: option.value, checked: option.value === opts.value });
    input.addEventListener('change', () => {
      if (input.checked) opts.onChange(option.value);
    });
    root.append(el('label', {}, input, el('span', {}, option.label)));
  }
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
