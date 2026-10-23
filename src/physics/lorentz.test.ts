import { describe, expect, it } from 'vitest';
import {
  addVelocities,
  boost,
  classifyInterval,
  contractedLength,
  dopplerFactor,
  gamma,
  interval,
  properTime,
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
