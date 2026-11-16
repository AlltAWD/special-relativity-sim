import { highway } from './highway';
import { lengthContraction } from './length-contraction';
import { lorentzTransform } from './lorentz-transform';
import { spacetimeDiagram } from './spacetime-diagram';
import { timeDilation } from './time-dilation';
import { twinParadox } from './twin-paradox';
import type { Sim } from './types';
import { velocityAddition } from './velocity-addition';

/** The simulations, in the order the navigation lists them. */
export const sims: Sim[] = [
  spacetimeDiagram,
  highway,
  timeDilation,
  lengthContraction,
  velocityAddition,
  lorentzTransform,
  twinParadox,
];
