/**
 * The UI kit on one page: every control and readout from src/ui, with the call
 * that makes it. Open it at http://localhost:5173/#kit while building a
 * simulation.
 *
 * It is listed only in `npm run dev` (see main.ts) and is left out of the
 * published site.
 */
import { button, dot, el, iconButton, numberField, segmented, select, slider, swatch, toggle } from '../ui/controls';
import { bench, defs, explain, formula, frac, group, inset, legend, math, note, row, stat, stats, tag } from '../ui/layout';
import { playback } from '../ui/playback';
import type { Sim } from './types';

function mount(root: HTMLElement): () => void {
  const code = (text: string) => el('code', {}, text);

  const log = note('Use a control and its value appears here.');
  const say = (text: string) => { log.textContent = text; };

  const speed = stat(math('v'), { value: '0.60', unit: 'c', tone: 'prime' });
  const lorentz = stat(math('γ'), { value: '1.250' });
  const proper = stat(math('Δτ'), { value: '8.00', unit: 's', tone: 'timelike' });

  const player = playback({
    autoplay: false,
    onStep: (dt) => say(`playback: a frame, ${(dt * 1000).toFixed(1)} ms after the last`),
    onReset: () => say('playback: reset'),
  });

  const sample = el('div', { className: 'figure-message' },
    el('div', {},
      formula('w =', frac('u + v', '1 + uv')),
      el('p', { className: 'note' },
        'The figure takes a canvas: ', code('bench({ figure: [canvas], toolbar, caption, panel })'),
        '. This sample is ', code("formula('w =', frac('u + v', '1 + uv'))"), '.'),
    ),
  );

  root.append(bench({
    figure: [sample],
    toolbar: {
      start: [segmented({
        label: 'View',
        options: [{ value: '2d', label: '2D' }, { value: '3d', label: '3D' }],
        value: '2d',
        onChange: (value) => say(`segmented: ${value}`),
      })],
      end: [player.el],
    },
    caption: ['A caption says how to use the figure and what its units are. ', math('s² = t² − x²'), ' comes from ', code("math('s² = t² − x²')"), '.'],
    panel: [
      group('slider()',
        slider({
          label: 'Velocity', min: -0.95, max: 0.95, step: 0.01, value: 0.6, tone: 'prime',
          format: (x) => `${x.toFixed(2)} c`, marks: [-0.8, 0, 0.8],
          onInput: (x) => { speed.set(x.toFixed(2)); say(`slider: ${x.toFixed(2)}`); },
        }),
        slider({
          label: 'Distance', min: 0, max: 10, step: 0.5, value: 3,
          format: (x) => `${x.toFixed(1)} ly`,
          onInput: (x) => say(`slider: ${x.toFixed(1)}`),
        }),
      ),
      group('toggle()',
        toggle('Light cone', true, (on) => say(`toggle: ${on}`), { swatch: 'dashed', tone: 'light' }),
        toggle('Worldline', false, (on) => say(`toggle: ${on}`), { swatch: 'line', tone: 'timelike' }),
      ),
      group({ title: ['button()'], aside: [iconButton('Remove', 'close', () => say('iconButton'), true)] },
        el('div', { className: 'actions' },
          button('Filled', () => say('filled'), { variant: 'filled' }),
          button('Tonal', () => say('tonal'), { variant: 'tonal', icon: 'add' }),
          button('Outlined', () => say('outlined')),
          button('Text', () => say('text'), { variant: 'text' }),
        ),
        log,
      ),
      group('numberField() and select()',
        row(
          numberField({ label: 'Time', value: 2, step: 0.1, onChange: (x) => say(`numberField: ${x}`) }).el,
          select({
            label: 'Speed',
            options: [{ value: '0.5', label: '0.5×' }, { value: '1', label: '1×' }, { value: '2', label: '2×' }],
            value: '1',
            onChange: (value) => say(`select: ${value}`),
          }),
        ),
      ),
      group({ title: ['stat() in stats()'], aside: [tag('Outbound', 'prime')] }, stats(speed, lorentz, proper)),
      group('inset(), defs(), legend(), explain()',
        inset([dot('var(--cat-3)'), 'Object C'], note('A filled box for editing whatever is selected.')),
        defs(
          [math('γ'), 'the Lorentz factor'],
          [math('Δτ'), 'proper time, read off the moving clock'],
        ),
        legend(
          [swatch('line', 'prime'), 'The moving frame'],
          [swatch('dashed', 'light'), 'Light'],
        ),
        explain('How it works', 'A paragraph of explanation that opens in place.', ['A second one, with ', math('t′ = γ(t − vx)'), '.']),
      ),
    ],
  }));

  return () => {
    player.stop();
    root.replaceChildren();
  };
}

export const kit: Sim = {
  id: 'kit',
  title: 'UI kit',
  blurb: 'Every control and readout the simulations share, with the call that makes each one. This page is only listed in development.',
  icon: 'widgets',
  mount,
};
