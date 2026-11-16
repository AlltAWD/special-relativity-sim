import { describe, expect, it } from 'vitest';
import {
  addVelocities,
  boost,
  classifyInterval,
  contractedLength,
  dopplerFactor,
  galileanSum,
  gamma,
  interval,
  lightClockHeight,
  lightClockTicks,
  properTime,
  twinAt,
  twinParadox,
  unboost,
} from './lorentz';

describe('gamma', () => {
  it('is 1 at rest and 1.25 at 0.6c (the 3-4-5 triangle)', () => {
    expect(gamma(0)).toBe(1);
    expect(gamma(0.6)).toBeCloseTo(1.25, 12);
    expect(gamma(-0.6)).toBeCloseTo(1.25, 12);
  });

  it('rejects |v| >= 1', () => {
    expect(() => gamma(1)).toThrow(RangeError);
    expect(() => gamma(-1.2)).toThrow(RangeError);
  });

  it('drives time dilation and length contraction', () => {
    expect(properTime(10, 0.6)).toBeCloseTo(8, 12);
    expect(contractedLength(10, 0.6)).toBeCloseTo(8, 12);
  });
});

describe('velocity addition', () => {
  it('stays below c', () => {
    expect(addVelocities(0.9, 0.9)).toBeCloseTo(1.8 / 1.81, 12);
    expect(addVelocities(0.9, 0.9)).toBeLessThan(1);
  });

  it('leaves c unchanged: light is light in every frame', () => {
    expect(addVelocities(1, 0.5)).toBe(1);
    expect(addVelocities(1, -0.99)).toBeCloseTo(1, 12);
  });

  it('reduces to u + v at low speed', () => {
    expect(addVelocities(1e-4, 2e-4)).toBeCloseTo(3e-4, 10);
  });
});

describe('boost', () => {
  const events = [
    { t: 0, x: 0 },
    { t: 3, x: 1 },
    { t: -2, x: 5 },
    { t: 4, x: -4 },
  ];

  it('is undone by unboost', () => {
    for (const e of events) {
      for (const v of [-0.9, -0.3, 0.5, 0.99]) {
        const back = unboost(boost(e, v), v);
        expect(back.t).toBeCloseTo(e.t, 9);
        expect(back.x).toBeCloseTo(e.x, 9);
      }
    }
  });

  it('preserves the interval', () => {
    for (const e of events) {
      const p = boost(e, 0.7);
      expect(interval(p.t, p.x)).toBeCloseTo(interval(e.t, e.x), 9);
    }
  });

  it('breaks simultaneity: events at t = 0 get different t\' in S\'', () => {
    // In S' (moving at +0.6), the event at x = +5 happens earlier than the one at x = 0.
    expect(boost({ t: 0, x: 0 }, 0.6).t).toBe(0);
    expect(boost({ t: 0, x: 5 }, 0.6).t).toBeCloseTo(-1.25 * 0.6 * 5, 12);
  });
});

describe('classifyInterval', () => {
  it('classifies by sign, with a tolerance for the light cone', () => {
    expect(classifyInterval(interval(2, 1))).toBe('timelike');
    expect(classifyInterval(interval(1, 2))).toBe('spacelike');
    expect(classifyInterval(interval(0.1 + 0.2, 0.3))).toBe('lightlike');
  });
});

describe('dopplerFactor', () => {
  it('halves the frequency of a source receding at 0.6c and doubles it approaching', () => {
    expect(dopplerFactor(0.6)).toBeCloseTo(0.5, 12);
    expect(dopplerFactor(-0.6)).toBeCloseTo(2, 12);
  });
});

describe('twinParadox', () => {
  it('matches t / gamma when both legs are at the same speed', () => {
    const r = twinParadox({ distance: 3, vOut: 0.6, vBack: 0.6 });
    expect(r.earthTime).toBeCloseTo(10, 12);
    expect(r.travellerTime).toBeCloseTo(8, 12);
  });

  it('handles different speeds out and back', () => {
    // Out at 0.6c: 5 y on Earth, 4 y aboard. Back at 0.8c (gamma 5/3): 3.75 y on Earth, 2.25 y aboard.
    const r = twinParadox({ distance: 3, vOut: 0.6, vBack: 0.8 });
    expect(r.earthTime).toBeCloseTo(8.75, 12);
    expect(r.travellerTime).toBeCloseTo(6.25, 12);
    expect(r.ageDifference).toBeCloseTo(2.5, 12);
  });
});

describe('input guards', () => {
  it('rejects a Doppler source at or beyond the speed of light', () => {
    expect(() => dopplerFactor(1)).toThrow(RangeError);
    expect(() => dopplerFactor(-1.5)).toThrow(RangeError);
  });

  it('rejects a twin who stands still or outruns light', () => {
    expect(() => twinParadox({ distance: 3, vOut: 0, vBack: 0.5 })).toThrow(RangeError);
    expect(() => twinParadox({ distance: 3, vOut: 0.5, vBack: 1 })).toThrow(RangeError);
    expect(() => twinParadox({ distance: 3, vOut: -0.5, vBack: 0.5 })).toThrow(RangeError);
  });
});

describe('galileanSum', () => {
  it('breaks the light barrier where the relativistic sum does not', () => {
    expect(galileanSum(0.6, 0.7)).toBeCloseTo(1.3, 12);
    expect(addVelocities(0.6, 0.7)).toBeLessThan(1);
  });

  it('agrees with the relativistic sum at everyday speeds', () => {
    // They differ by a factor 1 + uv = 1 + 2e-10: six parts in 10^15 here.
    expect(addVelocities(1e-5, 2e-5)).toBeCloseTo(galileanSum(1e-5, 2e-5), 12);
  });
});

describe('light clock', () => {
  it('at rest, reaches the top mirror at t = L and is back at t = 2L', () => {
    expect(lightClockHeight(0, 1, 0)).toBe(0);
    expect(lightClockHeight(0.25, 1, 0)).toBeCloseTo(0.25, 12);
    expect(lightClockHeight(1, 1, 0)).toBeCloseTo(1, 12);
    expect(lightClockHeight(1.5, 1, 0)).toBeCloseTo(0.5, 12);
    expect(lightClockHeight(2, 1, 0)).toBeCloseTo(0, 12);
  });

  it('moving at 0.6c, takes gamma = 1.25 times as long to reach the top', () => {
    expect(lightClockHeight(1, 1, 0.6)).toBeCloseTo(0.8, 12);
    expect(lightClockHeight(1.25, 1, 0.6)).toBeCloseTo(1, 12);
    expect(lightClockHeight(2.5, 1, 0.6)).toBeCloseTo(0, 12);
  });

  it('keeps its photon at the speed of light whatever the clock is doing', () => {
    // The photon moves sideways with the clock (v dt) and up or down (the change in height).
    const dt = 1e-6;
    for (const v of [0, 0.3, 0.6, 0.95]) {
      const dy = lightClockHeight(0.2 + dt, 1, v) - lightClockHeight(0.2, 1, v);
      expect(Math.hypot(v * dt, dy) / dt).toBeCloseTo(1, 6);
    }
  });

  it('ticks once per round trip, so a moving clock has ticked less', () => {
    expect(lightClockTicks(10, 1, 0)).toBe(5);
    expect(lightClockTicks(10, 1, 0.6)).toBe(4); // period 2 x 1.25 = 2.5
    expect(lightClockTicks(9.99, 1, 0.6)).toBe(3);
    expect(lightClockTicks(10, 0.5, 0)).toBe(10);
  });
});

describe('twinAt', () => {
  const trip = { distance: 3, vOut: 0.6, vBack: 0.8 };

  it('follows the outbound leg', () => {
    const m = twinAt(trip, 2.5);
    expect(m.leg).toBe('outbound');
    expect(m.x).toBeCloseTo(1.5, 12);
    expect(m.travellerTime).toBeCloseTo(2, 12); // 2.5 / 1.25
  });

  it('turns around at the destination', () => {
    const m = twinAt(trip, 5);
    expect(m.x).toBeCloseTo(3, 12);
    expect(m.travellerTime).toBeCloseTo(4, 12);
  });

  it('follows the return leg', () => {
    // 1.25 y after the turn at 0.8c: 1 ly closer, and 1.25 x 0.6 = 0.75 y older.
    const m = twinAt(trip, 6.25);
    expect(m.leg).toBe('return');
    expect(m.x).toBeCloseTo(2, 12);
    expect(m.travellerTime).toBeCloseTo(4.75, 12);
  });

  it('ends where twinParadox says it does', () => {
    const whole = twinParadox(trip);
    const m = twinAt(trip, whole.earthTime);
    expect(m.leg).toBe('home');
    expect(m.x).toBeCloseTo(0, 12);
    expect(m.travellerTime).toBeCloseTo(whole.travellerTime, 12);
  });

  it('keeps the age gap fixed once the twins are together again', () => {
    const whole = twinParadox(trip);
    const later = twinAt(trip, whole.earthTime + 4);
    expect(later.x).toBe(0);
    expect(whole.earthTime + 4 - later.travellerTime).toBeCloseTo(whole.ageDifference, 12);
  });
});
