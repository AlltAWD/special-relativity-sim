/** Small DOM helpers shared by the simulations. No framework, just elements. */

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

export interface SliderOptions {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  format?: (value: number) => string;
  onInput: (value: number) => void;
}

/** A labelled range input that shows its current value. */
export function slider(opts: SliderOptions): HTMLLabelElement {
  const format = opts.format ?? String;
  const readout = el('output', {}, format(opts.value));
  const input = el('input', {
    type: 'range',
    min: String(opts.min),
    max: String(opts.max),
    step: String(opts.step),
    value: String(opts.value),
  });
  input.addEventListener('input', () => {
    const value = Number(input.value);
    readout.textContent = format(value);
    opts.onInput(value);
  });
  return el('label', { className: 'control' }, el('span', {}, opts.label), input, readout);
}

/** A labelled checkbox. */
export function toggle(label: string, checked: boolean, onChange: (on: boolean) => void): HTMLLabelElement {
  const input = el('input', { type: 'checkbox', checked });
  input.addEventListener('change', () => onChange(input.checked));
  return el('label', { className: 'control toggle' }, input, el('span', {}, label));
}

/**
 * Keep a canvas's pixel buffer matched to its displayed size (times the device
 * pixel ratio) so drawings stay sharp. Calls `draw` after every resize and
 * returns a cleanup function.
 */
export function fitCanvas(canvas: HTMLCanvasElement, draw: () => void): () => void {
  const observer = new ResizeObserver(() => {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(canvas.clientWidth * ratio);
    canvas.height = Math.round(canvas.clientHeight * ratio);
    draw();
  });
  observer.observe(canvas);
  return () => observer.disconnect();
}
