/**
 * A 2D / 3D switch for a figure. The 2D view is the simulation's canvas; the
 * 3D view is a three.js scene (ui/stage3d.ts) that is only downloaded the
 * first time someone asks for it.
 */
import { el, segmented } from './controls';
import type { Stage3D, Stage3DHandle, Stage3DOptions } from './stage3d';

export type { Stage3D };

export interface DualViewOptions extends Stage3DOptions {
  /** The 2D canvas. It is hidden while the 3D view is showing. */
  canvas: HTMLCanvasElement;
  /** Called after each switch, so the simulation can redraw. */
  onChange?(mode: '2d' | '3d'): void;
}

export interface DualView {
  /** The 2D / 3D buttons, for the figure's toolbar. */
  switcher: HTMLElement;
  /** Holds the 3D scene. Put it in the figure next to the canvas. */
  layer: HTMLElement;
  readonly mode: '2d' | '3d';
  /** Free the 3D scene. Call this from the function `mount` returns. */
  stop(): void;
}

export function dualView(opts: DualViewOptions): DualView {
  let mode: '2d' | '3d' = '2d';
  let handle: Stage3DHandle | null = null;
  let stopped = false;

  const message = el('p', { className: 'figure-message', hidden: true });
  const layer = el('div', { className: 'stage3d', hidden: true }, message);

  const say = (text: string) => {
    message.textContent = text;
    message.hidden = text === '';
  };

  const show = (next: '2d' | '3d') => {
    mode = next;
    opts.canvas.hidden = mode === '3d';
    layer.hidden = mode === '2d';
    if (mode === '3d' && !handle) {
      say('Loading the 3D view…');
      import('./stage3d')
        .then(({ createStage3D }) => {
          if (stopped || handle) return;
          handle = createStage3D(layer, opts);
          say('');
        })
        .catch(() => say('The 3D view needs WebGL, which is not available in this browser.'));
    }
    opts.onChange?.(mode);
  };

  const switcher = segmented({
    label: 'View',
    options: [{ value: '2d', label: '2D' }, { value: '3d', label: '3D' }],
    value: mode,
    onChange: show,
  });

  return {
    switcher,
    layer,
    get mode() {
      return mode;
    },
    stop() {
      stopped = true;
      handle?.dispose();
      handle = null;
    },
  };
}
