import { el } from '../ui/controls';
import { spacetimeDiagram } from './spacetime-diagram';
import type { Sim } from './types';

/**
 * Placeholder for a simulation that hasn't been ported yet. Replace each one
 * with a real module (see spacetime-diagram.ts and the checklist in README.md).
 */
function notPorted(id: string, title: string, blurb: string, oldFile: string): Sim {
  return {
    id,
    title,
    blurb,
    mount(root) {
      root.append(
        el('p', { className: 'todo' },
          'Not ported yet. Source: ',
          el('code', {}, `special-relativity-simulator/src/components/simulations/${oldFile}`)),
      );
      return () => root.replaceChildren();
    },
  };
}

export const sims: Sim[] = [
  spacetimeDiagram,
  notPorted('highway', 'Highway View', 'Place objects and clocks, animate time, and compare frames.', 'HighwayView.tsx'),
  notPorted('time-dilation', 'Time Dilation', 'A light clock in motion ticks slower.', 'TimeDilation.tsx'),
  notPorted('length-contraction', 'Length Contraction', 'Objects shorten along their direction of motion.', 'LengthContraction.tsx'),
  notPorted('velocity-addition', 'Velocity Addition', 'Why u + v never exceeds c.', 'VelocityAddition.tsx'),
  notPorted('lorentz', 'Lorentz Transform', 'Coordinates of one event in two frames.', 'LorentzTransform.tsx'),
  notPorted('twin', 'Twin Paradox', 'The travelling twin comes back younger.', 'TwinParadox.tsx'),
];
