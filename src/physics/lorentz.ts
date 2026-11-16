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

/**
 * The classical (Galilean) sum u + v: what everyday intuition predicts. It is
 * here only to be compared with addVelocities, which it agrees with at low
 * speed and overshoots at high speed, past the speed of light.
 */
export function galileanSum(u: number, v: number): number {
  return u + v;
}

/**
 * A light clock: a photon bouncing between two mirrors `height` apart, with
 * the mirrors facing each other across the direction the clock moves in.
 *
 * Returns how far the photon is above the bottom mirror at time t, in the
 * frame where the clock moves at v. The photon starts at the bottom at t = 0.
 * Its speed is always 1, and v of that is spent keeping up with the clock, so
 * it climbs at sqrt(1 - v^2) = 1 / gamma: slower, the faster the clock moves.
 */
export function lightClockHeight(t: number, height: number, v: number): number {
  const climbed = t / gamma(v);
  const period = 2 * height;
  const phase = ((climbed % period) + period) % period; // also right for t < 0
  return phase <= height ? phase : period - phase;
}

/** Round trips a light clock has completed by time t: one tick each time the photon is back at the bottom. */
export function lightClockTicks(t: number, height: number, v: number): number {
  // The tiny tolerance stops 2.5 / 2.5 = 0.9999999999999999 from losing a tick.
  return Math.floor(t / (2 * height * gamma(v)) + 1e-9);
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
  if (Math.abs(v) >= 1) {
    throw new RangeError(`|v| must be < 1 (got ${v})`);
  }
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
  checkLegSpeed(vOut);
  checkLegSpeed(vBack);
  const outLeg = distance / vOut;
  const backLeg = distance / vBack;
  const earthTime = outLeg + backLeg;
  const travellerTime = properTime(outLeg, vOut) + properTime(backLeg, vBack);
  return { earthTime, travellerTime, ageDifference: earthTime - travellerTime };
}

/** A leg of the trip has to get somewhere (speed > 0) and stay below light speed. */
function checkLegSpeed(speed: number): void {
  if (!(speed > 0 && speed < 1)) {
    throw new RangeError(`a leg's speed must be between 0 and 1, exclusive (got ${speed})`);
  }
}

export interface TwinMoment {
  /** Distance of the traveller from Earth, in light-years. */
  x: number;
  /** Time that has passed for the traveller since leaving, in years. */
  travellerTime: number;
  leg: 'outbound' | 'return' | 'home';
}

/**
 * Where the travelling twin is, and how much they have aged, once `earthTime`
 * years have passed on Earth. After the reunion the twins age together, so the
 * gap between them stays what it was when the ship landed.
 */
export function twinAt(trip: TwinTrip, earthTime: number): TwinMoment {
  const { distance, vOut, vBack } = trip;
  const whole = twinParadox(trip); // also checks the speeds
  const outLeg = distance / vOut;
  const t = Math.max(0, earthTime);
  if (t <= outLeg) {
    return { x: vOut * t, travellerTime: properTime(t, vOut), leg: 'outbound' };
  }
  if (t < whole.earthTime) {
    const sinceTurn = t - outLeg;
    return {
      x: distance - vBack * sinceTurn,
      travellerTime: properTime(outLeg, vOut) + properTime(sinceTurn, vBack),
      leg: 'return',
    };
  }
  return { x: 0, travellerTime: whole.travellerTime + (t - whole.earthTime), leg: 'home' };
}

/** Kinetic energy (gamma - 1) m, in units of m c^2. */
export function kineticEnergy(mass: number, v: number): number {
  return (gamma(v) - 1) * mass;
}

/** Momentum gamma m v, in units of m c. */
export function momentum(mass: number, v: number): number {
  return gamma(v) * mass * v;
}
