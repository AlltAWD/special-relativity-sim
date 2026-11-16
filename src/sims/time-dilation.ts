/**
 * Time dilation, shown with two light clocks: one at rest and one moving.
 *
 * A light clock is a photon bouncing between two mirrors. Seen from the frame
 * where the clock moves, the photon has to cover a longer, slanted path, and
 * since light always travels at c the trip takes longer: the moving clock
 * ticks slower by the factor gamma.
 *
 * The old version drew both photons bouncing at the same rate and only slowed
 * down a number. Here the bounce itself comes from lightClockHeight(), so what
 * you watch is what the readouts say.
 */
import { gamma, lightClockHeight, lightClockTicks, properTime } from '../physics/lorentz';
import { el, fitCanvas, slider } from '../ui/controls';
import { arrow, backdrop, fmt, paint, photon, text, type Paint } from '../ui/draw';
import { bench, explain, group, math, stat, stats } from '../ui/layout';
import { playback } from '../ui/playback';
import { dualView, type Stage3D } from '../ui/views';
import type { Sim } from './types';

/** Distance between a clock's mirrors, in light-seconds: light takes one second to cross. */
const HEIGHT = 1;

/**
 * The corners of the photon's zigzag between two times: where it was at `from`,
 * every mirror it has hit since, and where it is at `to`.
 */
function zigzag(v: number, from: number, to: number): { t: number; height: number }[] {
  const crossing = HEIGHT * gamma(v); // time from one mirror to the other
  const corners = [{ t: from, height: lightClockHeight(from, HEIGHT, v) }];
  for (let k = Math.floor(from / crossing) + 1; k * crossing < to; k++) {
    corners.push({ t: k * crossing, height: k % 2 === 0 ? 0 : HEIGHT });
  }
  corners.push({ t: to, height: lightClockHeight(to, HEIGHT, v) });
  return corners;
}

function mount(root: HTMLElement): () => void {
  // ---------- State ----------
  let v = 0.6;
  let t = 0; // seconds since the start, in the frame where the first clock is at rest

  /**
   * The moving clock crosses a lane and then comes round again. This says how
   * far into the lane it is, and when the current crossing started.
   */
  const crossing = (lane: number) => {
    const into = (v * t) % lane;
    return { into, start: v > 0 ? t - into / v : 0 };
  };

  // ---------- Elements ----------
  const canvas = el('canvas');
  canvas.setAttribute('role', 'img');

  const gammaStat = stat(math('γ = 1 / √(1 − v²)'));
  const restTime = stat('Clock at rest', { unit: 's', tone: 'timelike' });
  const movingTime = stat('Moving clock', { unit: 's', tone: 'prime' });
  const restTicks = stat('Ticks at rest', { tone: 'timelike' });
  const movingTicks = stat('Ticks, moving', { tone: 'prime' });
  const rate = stat(el('span', {}, 'Rate of the moving clock, ', math('1 / γ')));

  const player = playback({
    onStep: (dt) => { t += dt; update(); },
    onReset: () => { t = 0; update(); },
  });

  const views = dualView({
    canvas,
    camera: [0.6, 2.6, 8.6],
    target: [0.4, 0.9, 0],
    build: build3d,
    onChange: () => update(),
  });

  root.append(bench({
    figure: [canvas, views.layer],
    toolbar: { start: [views.switcher], end: [player.el] },
    caption: [
      'Each clock ticks when its photon is back at the bottom mirror. The mirrors are 1 light-second apart (two squares), so the clock at rest ticks every 2 seconds. In 3D, drag to look around.',
    ],
    panel: [
      group('Moving clock',
        slider({
          label: 'Velocity',
          min: 0, max: 0.99, step: 0.01, value: v,
          format: (x) => `${fmt(x)} c`,
          // The readouts assume one constant speed since t = 0, so a new speed starts a new run.
          onInput: (x) => { v = x; t = 0; update(); },
          tone: 'prime',
          marks: [0, 0.6, 0.8, 0.95],
        }),
        stats(gammaStat),
      ),
      group('Elapsed',
        stats(restTime, movingTime),
        stats(restTicks, movingTicks),
        stats(rate),
      ),
      group('About',
        explain('How it works',
          ['Both photons travel at the speed of light. The one in the moving clock also has to keep up with its mirrors, so it travels along a slant: further, for each bounce, than the photon in the clock at rest.'],
          ['Further at the same speed takes longer. Each tick of the moving clock takes ', math('γ'), ' times as long, so in a time ', math('t'), ' it shows only ', math('τ = t / γ'), '.'],
          ['Someone riding with the moving clock sees it tick normally, and sees the other clock, which moves relative to them, running slow instead. Neither view is the “real” one.'],
        ),
      ),
    ],
  }));

  // ---------- 2D drawing ----------

  function draw(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const p = paint(canvas);
    backdrop(ctx, w, h, p);

    // Pixels per light-second: the clock takes up to 46% of the height, and at
    // least 5.2 light-seconds fit across, so the layout also works on a phone.
    const s = Math.min(h * 0.46, w / 5.2);
    const bottom = h / 2 + s / 2; // the bottom mirrors
    const top = bottom - s * HEIGHT;
    const restX = s * 0.8;
    const laneStart = s * 1.9;
    const lane = (w - s * 0.7 - laneStart) / s; // light-seconds the moving clock crosses
    const { into, start } = crossing(lane);
    const movingX = laneStart + into * s;
    const yOf = (height: number) => bottom - height * s;

    // Graph paper with half a light-second to the square, lined up with the mirrors.
    ctx.beginPath();
    for (let x = restX % (s / 2); x < w; x += s / 2) {
      ctx.moveTo(Math.round(x) + 0.5, 0);
      ctx.lineTo(Math.round(x) + 0.5, h);
    }
    for (let y = bottom % (s / 2); y < h; y += s / 2) {
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(w, Math.round(y) + 0.5);
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = p.grid;
    ctx.stroke();

    // The path the moving photon has taken on this crossing: the long way round.
    if (v > 0) {
      const corners = zigzag(v, Math.max(start, t - 14), t);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = p.light;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      corners.forEach((corner, i) => {
        const x = laneStart + v * (corner.t - start) * s;
        if (i === 0) ctx.moveTo(x, yOf(corner.height));
        else ctx.lineTo(x, yOf(corner.height));
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }

    drawClock(ctx, p, restX, top, bottom, s, p.timelike, 'At rest', lightClockTicks(t, HEIGHT, 0));
    drawClock(ctx, p, movingX, top, bottom, s, p.prime, `${fmt(v)} c`, lightClockTicks(t, HEIGHT, v));

    // Which way the moving clock is going.
    if (v > 0) {
      ctx.lineWidth = 1.75;
      ctx.strokeStyle = p.prime;
      const y = (top + bottom) / 2;
      arrow(ctx, movingX + s * 0.34, y, movingX + s * (0.34 + 0.12 + 0.3 * v), y);
    }

    photon(ctx, p, restX, yOf(lightClockHeight(t, HEIGHT, 0)), Math.max(4, s * 0.045));
    photon(ctx, p, movingX, yOf(lightClockHeight(t, HEIGHT, v)), Math.max(4, s * 0.045));
  }

  /** Two mirrors, a name above and a tick count below. */
  function drawClock(
    ctx: CanvasRenderingContext2D, p: Paint, x: number, top: number, bottom: number, s: number,
    color: string, name: string, ticks: number,
  ) {
    const half = s * 0.26;
    ctx.fillStyle = color;
    for (const y of [top - 6, bottom]) {
      ctx.beginPath();
      ctx.roundRect(x - half, y, 2 * half, 6, 3);
      ctx.fill();
    }
    // The photon's path in the clock's own frame: straight up and down.
    ctx.lineWidth = 1;
    ctx.strokeStyle = p.outline;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();
    text(ctx, p, name, x, top - 22, color, { size: 13, weight: 600, halo: p.bg });
    text(ctx, p, `${ticks} ${ticks === 1 ? 'tick' : 'ticks'}`, x, bottom + 34, p.muted, { halo: p.bg });
  }

  // ---------- 3D scene ----------

  function build3d(stage: Stage3D): () => void {
    const { THREE, scene } = stage;
    const K = 2; // scene units per light-second
    const LANE = 4; // light-seconds the moving clock crosses in the scene
    const restX = -4.6;
    const laneStart = -3;

    const floor = stage.grid(16, 16);
    floor.position.y = -0.35;
    scene.add(floor);

    const mirrorShape = new THREE.BoxGeometry(0.9, 0.06, 0.9);
    const makeClock = (color: string) => {
      const clock = new THREE.Group();
      const material = new THREE.MeshStandardMaterial({ color: stage.color(color), metalness: 0.2, roughness: 0.45 });
      for (const y of [-0.03, HEIGHT * K + 0.03]) {
        const mirror = new THREE.Mesh(mirrorShape, material);
        mirror.position.y = y;
        clock.add(mirror);
      }
      scene.add(clock);
      return clock;
    };
    const rest = makeClock('--sim-timelike');
    rest.position.x = restX;
    const moving = makeClock('--sim-prime');

    const photonShape = new THREE.SphereGeometry(0.11, 20, 12);
    const photonMaterial = new THREE.MeshBasicMaterial({ color: stage.color('--sim-photon') });
    const restPhoton = new THREE.Mesh(photonShape, photonMaterial);
    const movingPhoton = new THREE.Mesh(photonShape, photonMaterial);
    scene.add(restPhoton, movingPhoton);

    // The zigzag, as a line with room for as many corners as it can ever have.
    const MAX_CORNERS = 40;
    const trailPositions = new THREE.BufferAttribute(new Float32Array(MAX_CORNERS * 3), 3);
    const trailShape = new THREE.BufferGeometry();
    trailShape.setAttribute('position', trailPositions);
    const trail = new THREE.Line(trailShape, new THREE.LineBasicMaterial({ color: stage.color('--sim-light') }));
    trail.frustumCulled = false;
    scene.add(trail);

    return () => {
      const { into, start } = crossing(LANE);
      const movingX = laneStart + into * K;
      moving.position.x = movingX;
      restPhoton.position.set(restX, lightClockHeight(t, HEIGHT, 0) * K, 0);
      movingPhoton.position.set(movingX, lightClockHeight(t, HEIGHT, v) * K, 0);

      const corners = v > 0 ? zigzag(v, Math.max(start, t - 14), t).slice(-MAX_CORNERS) : [];
      corners.forEach((corner, i) => {
        trailPositions.setXYZ(i, laneStart + v * (corner.t - start) * K, corner.height * K, 0);
      });
      trailPositions.needsUpdate = true;
      trailShape.setDrawRange(0, corners.length);
    };
  }

  // ---------- Keeping everything in step ----------

  function update() {
    const g = gamma(v);
    gammaStat.set(g.toFixed(3));
    restTime.set(t.toFixed(2));
    movingTime.set(properTime(t, v).toFixed(2));
    restTicks.set(String(lightClockTicks(t, HEIGHT, 0)));
    movingTicks.set(String(lightClockTicks(t, HEIGHT, v)));
    rate.set((1 / g).toFixed(3));
    // A description for screen readers, refreshed once a second rather than every frame.
    const label = `Two light clocks. The one at rest shows ${t.toFixed(0)} seconds; the one moving at ${v.toFixed(2)} c shows ${properTime(t, v).toFixed(0)} seconds.`;
    if (canvas.getAttribute('aria-label') !== label) canvas.setAttribute('aria-label', label);
    view.redraw();
  }

  const view = fitCanvas(canvas, draw);
  update();

  return () => {
    player.stop();
    views.stop();
    view.stop();
    root.replaceChildren();
  };
}

export const timeDilation: Sim = {
  id: 'time-dilation',
  title: 'Time Dilation',
  icon: 'timer',
  blurb: 'A light clock in motion ticks slower: its photon has further to go between the mirrors, and light cannot hurry.',
  mount,
};
