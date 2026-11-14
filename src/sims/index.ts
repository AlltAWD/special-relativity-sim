import { el } from '../ui/controls';
import { formula, frac, math } from '../ui/layout';
import { spacetimeDiagram } from './spacetime-diagram';
import type { Sim } from './types';

/** What a placeholder shows until the real simulation exists: its key relation, in words and symbols. */
interface Preview {
  formula: (Node | string)[];
  legend: (Node | string)[];
}

/**
 * Placeholder for a simulation that hasn't been ported yet. Replace each one
 * with a real module (see spacetime-diagram.ts and the checklist in README.md).
 *
 * Visitors see the relation the simulation is about and a note that it is in
 * progress. The path of the old source file is shown only in `npm run dev`.
 */
function notPorted(id: string, title: string, blurb: string, oldFile: string, preview?: Preview): Sim {
  return {
    id,
    title,
    blurb,
    soon: true,
    mount(root) {
      const card = el('div', { className: 'soon' });
      if (preview) {
        card.append(formula(...preview.formula), el('p', { className: 'soon-legend' }, ...preview.legend));
      }
      card.append(
        el('p', { className: 'soon-status' },
          el('span', { className: 'tag' }, 'In progress'),
          'This simulation is being rebuilt.',
          el('a', { href: `#${spacetimeDiagram.id}` }, `Try the ${spacetimeDiagram.title}`),
        ),
      );
      if (import.meta.env.DEV) {
        card.append(
          el('p', { className: 'soon-dev' },
            'Port from ',
            el('code', {}, `special-relativity-simulator/src/components/simulations/${oldFile}`)),
        );
      }
      root.append(el('div', { className: 'bench' }, card));
      return () => root.replaceChildren();
    },
  };
}

export const sims: Sim[] = [
  spacetimeDiagram,
  notPorted('highway', 'Highway View', 'Place objects and clocks, animate time, and compare frames.', 'HighwayView.tsx'),
  notPorted('time-dilation', 'Time Dilation', 'A light clock in motion ticks slower.', 'TimeDilation.tsx', {
    formula: ['Δt = γ Δτ'],
    legend: [
      math('Δτ'), ' is the time between two ticks for someone moving with the clock; ',
      math('Δt'), ' is the time between the same two ticks for someone the clock moves past.',
    ],
  }),
  notPorted('length-contraction', 'Length Contraction', 'Objects shorten along their direction of motion.', 'LengthContraction.tsx', {
    formula: ['L =', frac('L_0', 'γ')],
    legend: [
      math('L_0'), ' is the length of the object at rest; ',
      math('L'), ' is its length, along the direction of motion, for someone it moves past.',
    ],
  }),
  notPorted('velocity-addition', 'Velocity Addition', 'Why u + v never exceeds c.', 'VelocityAddition.tsx', {
    formula: ['w =', frac('u + v', '1 + uv')],
    legend: [
      'An object moves at ', math('u'), ' inside a frame that itself moves at ', math('v'), '. Its speed ',
      math('w'), ' in the original frame never reaches 1, the speed of light.',
    ],
  }),
  notPorted('lorentz', 'Lorentz Transform', 'Coordinates of one event in two frames.', 'LorentzTransform.tsx', {
    formula: ['t′ = γ(t − vx)', el('span', { className: 'formula-gap' }), 'x′ = γ(x − vt)'],
    legend: [
      'The same event has coordinates ', math('(t, x)'), ' in ', math('S'), ' and ', math('(t′, x′)'), ' in ',
      math('S′'), ', the frame moving at ', math('v'), ' along ', math('x'), '.',
    ],
  }),
  notPorted('twin', 'Twin Paradox', 'The travelling twin comes back younger.', 'TwinParadox.tsx', {
    formula: ['τ =', frac('Δt_1', 'γ_1'), '+', frac('Δt_2', 'γ_2')],
    legend: [
      'Each leg of the trip takes time ', math('Δt'), ' on Earth, but only ', math('Δt / γ'), ' on the ship. The traveller’s total, ',
      math('τ'), ', is less than the time that passed at home.',
    ],
  }),
];
