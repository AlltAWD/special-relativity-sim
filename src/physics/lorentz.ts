/**
 * Special relativity in natural units: c = 1, so every velocity is a fraction
 * of c (beta) and times and distances share a unit (seconds and light-seconds,
 * or years and light-years).
 *
 * Everything here is a pure function of numbers, with no DOM and no drawing, so
 * the whole module is unit-tested in lorentz.test.ts.
 */

/** Lorentz factor gamma = 1 / sqrt(1 - v^2). Throws for |v| >= 1. */
export function gamma(v: number): number {
  if (Math.abs(v) >= 1) {
    throw new RangeError(`|v| must be < 1 (got ${v})`);
  }
  return 1 / Math.sqrt(1 - v * v);
}

/** A moving clock ticks slower: coordinate time t passes, the clock shows t / gamma. */
export function properTime(coordinateTime: number, v: number): number {
  return coordinateTime / gamma(v);
}

/** A moving rod is shorter along its motion: L = L0 / gamma. */
export function contractedLength(properLength: number, v: number): number {
  return properLength / gamma(v);
}

/**
 * Relativistic velocity addition: an object moves at u inside frame S',
 * which moves at v relative to S. Its velocity in S is (u + v) / (1 + uv),
 * which never reaches 1 when |u|, |v| < 1.
 */
export function addVelocities(u: number, v: number): number {
  return (u + v) / (1 + u * v);
}

export interface Event2D {
  t: number;
  x: number;
}

/** Coordinates of an event in S', the frame moving at +v along x relative to S. */
export function boost(event: Event2D, v: number): Event2D {
  const g = gamma(v);
  return {
    t: g * (event.t - v * event.x),
    x: g * (event.x - v * event.t),
  };
}

/** Inverse of boost: a boost by -v undoes a boost by +v. */
export function unboost(event: Event2D, v: number): Event2D {
  return boost(event, -v);
}

/** Invariant interval s^2 = dt^2 - dx^2 (signature +,-). The same in every frame. */
export function interval(dt: number, dx: number): number {
  return dt * dt - dx * dx;
}

export type IntervalKind = 'timelike' | 'lightlike' | 'spacelike';

/**
 * Classify an interval. An exact float comparison with 0 would almost never
 * say "lightlike" for an event clicked on the light cone, so allow a tolerance.
 */
export function classifyInterval(s2: number, tolerance = 1e-9): IntervalKind {
  if (Math.abs(s2) <= tolerance) return 'lightlike';
  return s2 > 0 ? 'timelike' : 'spacelike';
}

/**
 * Longitudinal Doppler factor f_observed / f_source.
 * v > 0 means the source recedes (redshift, factor < 1).
 */
export function dopplerFactor(v: number): number {
  return Math.sqrt((1 - v) / (1 + v));
}

export interface TwinTrip {
  /** One-way distance to the turnaround point, in light-years. */
  distance: number;
  /** Outbound speed, 0 < vOut < 1. */
  vOut: number;
  /** Return speed, 0 < vBack < 1. */
  vBack: number;
}

export interface TwinResult {
  earthTime: number;
  travellerTime: number;
  ageDifference: number;
}

/**
 * Twin paradox with an instantaneous turnaround. Each leg takes Earth time
 * distance / speed, and the traveller's clock runs slow by that leg's gamma.
 *
 * (The old version split the Earth time evenly between the two legs, which is
 * only right when vOut == vBack.)
 */
export function twinParadox({ distance, vOut, vBack }: TwinTrip): TwinResult {
  const outLeg = distance / vOut;
  const backLeg = distance / vBack;
  const earthTime = outLeg + backLeg;
  const travellerTime = properTime(outLeg, vOut) + properTime(backLeg, vBack);
  return { earthTime, travellerTime, ageDifference: earthTime - travellerTime };
}

/** Kinetic energy (gamma - 1) m, in units of m c^2. */
export function kineticEnergy(mass: number, v: number): number {
  return (gamma(v) - 1) * mass;
}

/** Momentum gamma m v, in units of m c. */
export function momentum(mass: number, v: number): number {
  return gamma(v) * mass * v;
}
