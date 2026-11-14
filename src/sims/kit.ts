/**
 * The UI kit on one page: every control and readout from src/ui, with the call
 * that makes it. Open it at http://localhost:5173/#kit while porting.
 *
 * It is listed only in `npm run dev` (see main.ts) and is left out of the
 * published site.
 */
import { button, el, icon, segmented, slider, swatch, toggle } from '../ui/controls';
import { bench, defs, formula, frac, group, legend, math, note, stat, stats } from '../ui/layout';
import type { Sim } from './types';

function mount(root: HTMLElement): () => void {
  const code = (text: string) => el('code', {}, text);

  const log = note('Use a control and its value appears here.');
  const say = (text: string) => { log.textContent = text; };

  const speed = stat(math('v'), '0.60', 'prime');
  const lorentz = stat(math('γ'), '1.250');
  const proper = stat(math('Δτ'), '8.00', 'timelike');

  let playing = false;
  const playButton = button('Play', () => {
    playing = !playing;
    playButton.replaceChildren(icon(playing ? 'pause' : 'play'), playing ? 'Pause' : 'Play');
    say(playing ? 'Playing' : 'Paused');
  }, { icon: 'play', primary: true });

  const sample = el('div', { className: 'soon' },
    formula('w =', frac('u + v', '1 + uv')),
    el('p', { className: 'soon-legend' },
      'The figure area takes a canvas: ', code("bench({ figure: [canvas], caption: [...], panel: [...] })"),
      '. This sample shows ', code("formula('w =', frac('u + v', '1 + uv'))"), '.'),
  );

  root.append(bench({
    figure: [sample],
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
        toggle('Plain', true, (on) => say(`toggle: ${on}`)),
      ),
      group('button() and segmented()',
        el('div', { className: 'actions' },
          playButton,
          button('Reset', () => say('Reset'), { icon: 'reset' }),
          button('Remove', () => say('Remove'), { icon: 'close', iconOnly: true }),
        ),
        segmented({
          label: 'View',
          options: [{ value: '2d', label: '2D' }, { value: '3d', label: '3D' }],
          value: '2d',
          onChange: (value) => say(`segmented: ${value}`),
        }),
        log,
      ),
      group('stat() in stats()', stats(speed, lorentz, proper)),
      group('defs() and legend()',
        defs(
          [math('γ'), 'the Lorentz factor'],
          [math('Δτ'), 'proper time, read off the moving clock'],
        ),
        legend(
          [swatch('line', 'prime'), 'The moving frame'],
          [swatch('dashed', 'light'), 'Light'],
          [swatch('line', 'spacelike'), 'A spacelike interval'],
        ),
      ),
    ],
  }));

  return () => root.replaceChildren();
}

export const kit: Sim = {
  id: 'kit',
  title: 'UI kit',
  blurb: 'Every control and readout the simulations share, with the call that makes each one. This page is only listed in development.',
  mount,
};
