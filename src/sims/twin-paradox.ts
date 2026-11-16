/**
 * The twin paradox: one twin flies to a star and back, the other stays home,
 * and the traveller returns younger.
 *
 * The figure shows the trip twice: as a journey (Earth, ship, star) and as a
 * spacetime diagram in Earth's frame. On the diagram each twin's path carries
 * a dot for every so many years of that twin's own time. The traveller's path
 * is longer on the page and has fewer dots: in spacetime the straight path is
 * the one that takes the most time.
 *
 * The old version split Earth's time evenly between the two legs, which is
 * only right when both are flown at the same speed. This one uses the
 * physics module's twinParadox() and twinAt(), which take each leg at its
 * own speed.
 */
// The physics function is imported under another name, because this file exports the simulation as `twinParadox`.
import { gamma, twinAt, twinParadox as wholeTrip, type TwinTrip } from '../physics/lorentz';
import { el, enableSlider, fitCanvas, setSlider, slider, toggle } from '../ui/controls';
import { backdrop, fmt, paint, text, type Paint } from '../ui/draw';
import { bench, explain, group, math, stat, stats, tag } from '../ui/layout';
import { playback } from '../ui/playback';
import { dualView, type Stage3D } from '../ui/views';
import type { Sim } from './types';

/** The whole trip plays in this many seconds, however long it takes the twins. */
const PLAY_SECONDS = 10;

const LEG_NAMES = { outbound: 'Outbound', return: 'Returning', home: 'Home again' } as const;

/** A round step that puts at most about a dozen marks along `total`. */
function markStep(total: number): number {
  return [0.5, 1, 2, 5, 10, 20, 50].find((step) => total / step <= 12) ?? 100;
}

function mount(root: HTMLElement): () => void {
  // ---------- State ----------
  let distance = 4; // light-years to the star
  let vOut = 0.8;
  let vBack = 0.8;
  let sameSpeed = true;
  let earthTime = 0; // years since departure, on Earth

  const trip = (): TwinTrip => ({ distance, vOut, vBack });

  /**
   * Earth time at which the traveller's own clock shows `tau` years. This is
   * twinAt() read backwards: each leg stretches the traveller's time by its gamma.
   */
  const earthTimeWhenTravellerShows = (tau: number) => {
    const outOwn = distance / vOut / gamma(vOut);
    return tau <= outOwn ? tau * gamma(vOut) : distance / vOut + (tau - outOwn) * gamma(vBack);
  };

  // ---------- Elements ----------
  const canvas = el('canvas');
  canvas.setAttribute('role', 'img');

  const earthNow = stat('Earth twin has aged', { unit: 'y', tone: 'timelike' });
  const travellerNow = stat('Traveller has aged', { unit: 'y', tone: 'prime' });
  const gapNow = stat('Gap so far', { unit: 'y' });
  const status = tag('');
  const earthTotal = stat('On Earth', { unit: 'y', tone: 'timelike' });
  const travellerTotal = stat('On the ship', { unit: 'y', tone: 'prime' });
  const gapTotal = stat('The traveller comes home younger by', { unit: 'y' });

  const player = playback({
    onStep: (dt) => {
      const total = wholeTrip(trip()).earthTime;
      if (earthTime >= total) earthTime = 0; // pressing play at the end starts the trip again
      earthTime = Math.min(total, earthTime + (dt * total) / PLAY_SECONDS);
      if (earthTime >= total) player.pause(); // landed
      update();
    },
    onReset: () => { earthTime = 0; update(); },
  });

  const views = dualView({
    canvas,
    camera: [0, 4.5, 13],
    target: [0, 0, 0],
    build: build3d,
    onChange: () => update(),
  });

  /** After a change to the trip itself: start it again from Earth. */
  const replan = () => {
    earthTime = 0;
    update();
  };

  const returnSlider = slider({
    label: 'Speed coming back',
    min: 0.1, max: 0.99, step: 0.01, value: vBack,
    format: (x) => `${fmt(x)} c`,
    onInput: (x) => { vBack = x; replan(); },
    tone: 'prime',
  });
  enableSlider(returnSlider, !sameSpeed);

  root.append(bench({
    figure: [canvas, views.layer],
    tall: true,
    toolbar: { start: [views.switcher], end: [player.el] },
    caption: [
      'On the diagram, each dot is one more stretch of that twin’s own time: the same stretch for both. Count them: the traveller’s path has fewer.',
    ],
    panel: [
      group('Trip',
        slider({
          label: 'Distance to the star',
          min: 1, max: 20, step: 0.5, value: distance,
          format: (x) => `${x.toFixed(1)} ly`,
          onInput: (x) => { distance = x; replan(); },
          marks: [1, 4, 10, 20],
        }),
        slider({
          label: 'Speed going out',
          min: 0.1, max: 0.99, step: 0.01, value: vOut,
          format: (x) => `${fmt(x)} c`,
          onInput: (x) => {
            vOut = x;
            if (sameSpeed) {
              vBack = x;
              setSlider(returnSlider, x);
            }
            replan();
          },
          tone: 'prime',
          marks: [0.1, 0.6, 0.8, 0.99],
        }),
        toggle('Same speed coming back', sameSpeed, (on) => {
          sameSpeed = on;
          enableSlider(returnSlider, !on);
          if (on) {
            vBack = vOut;
            setSlider(returnSlider, vOut);
          }
          replan();
        }),
        returnSlider,
      ),
      group({ title: ['So far'], aside: [status] },
        stats(earthNow, travellerNow),
        stats(gapNow),
      ),
      group('The whole trip',
        stats(earthTotal, travellerTotal),
        stats(gapTotal),
      ),
      group('About',
        explain('Why it is not a paradox',
          ['While the ship cruises, each twin can say the other’s clock runs slow, which sounds like a contradiction: both cannot be younger. But the twins’ histories are not alike. The traveller turns round, changing from one frame to another. The twin on Earth never does.'],
          ['The diagram shows the difference. Earth’s path between the departure and the reunion is straight; the traveller’s has a corner. In spacetime, unlike on a map, the straight path is the one with the most time on it.'],
          ['Each leg takes ', math('Δt'), ' on Earth and only ', math('Δt / γ'), ' on the ship, so the traveller’s total is ', math('τ = Δt_1 / γ_1 + Δt_2 / γ_2'), '.'],
        ),
      ),
    ],
  }));

  // ---------- 2D drawing ----------

  function draw(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const p = paint(canvas);
    backdrop(ctx, w, h, p);
    // Side by side when there is width for it, otherwise the journey above the diagram.
    if (w >= h * 1.25) {
      const split = Math.round(w * 0.56);
      drawDiagram(ctx, p, 0, 0, split, h);
      drawJourney(ctx, p, split, 0, w - split, h);
    } else {
      const split = Math.round(h * 0.27);
      drawJourney(ctx, p, 0, 0, w, split);
      drawDiagram(ctx, p, 0, split, w, h - split);
    }
  }

  /** Earth, the star and the ship between them, with each twin's age so far. */
  function drawJourney(ctx: CanvasRenderingContext2D, p: Paint, left: number, top: number, w: number, h: number) {
    const now = twinAt(trip(), earthTime);
    const earthX = left + 46;
    const starX = left + w - 46;
    const y = top + h * 0.5;
    const shipX = earthX + (now.x / distance) * (starX - earthX);

    // The route.
    ctx.lineWidth = 1;
    ctx.strokeStyle = p.muted;
    ctx.setLineDash([2, 5]);
    ctx.beginPath();
    ctx.moveTo(earthX, y);
    ctx.lineTo(starX, y);
    ctx.stroke();
    ctx.setLineDash([]);
    text(ctx, p, `${distance.toFixed(1)} ly`, (earthX + starX) / 2, y + 16, p.muted, { size: 11, halo: p.bg });

    // Earth.
    ctx.fillStyle = p.timelike;
    ctx.beginPath();
    ctx.arc(earthX, y, 13, 0, 2 * Math.PI);
    ctx.fill();
    text(ctx, p, 'Earth', earthX, y + 30, p.timelike, { weight: 600 });
    text(ctx, p, `+${earthTime.toFixed(1)} y`, earthX, y - 28, p.timelike, { size: 13, weight: 600 });

    // The star: a small sun, with a darker rim and rays so it shows on white.
    ctx.fillStyle = p.photon;
    ctx.beginPath();
    ctx.arc(starX, y, 8, 0, 2 * Math.PI);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = p.light;
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      ctx.moveTo(starX + 12 * Math.cos(angle), y + 12 * Math.sin(angle));
      ctx.lineTo(starX + 16 * Math.cos(angle), y + 16 * Math.sin(angle));
    }
    ctx.stroke();
    text(ctx, p, 'Star', starX, y + 30, p.light, { weight: 600 });

    // The ship, pointing the way it is going.
    const heading = now.leg === 'outbound' ? 1 : -1;
    ctx.fillStyle = p.prime;
    ctx.beginPath();
    ctx.moveTo(shipX + heading * 12, y);
    ctx.lineTo(shipX - heading * 9, y - 8);
    ctx.lineTo(shipX - heading * 5, y);
    ctx.lineTo(shipX - heading * 9, y + 8);
    ctx.closePath();
    ctx.fill();
    // Keep the ship's age clear of Earth's while they are side by side.
    const ageY = Math.abs(shipX - earthX) < 64 ? y - 46 : y - 22;
    text(ctx, p, `+${now.travellerTime.toFixed(1)} y`, shipX, ageY, p.prime, { size: 13, weight: 600, halo: p.bg });
  }

  /** Earth's frame: distance across, Earth time up. */
  function drawDiagram(ctx: CanvasRenderingContext2D, p: Paint, left: number, top: number, w: number, h: number) {
    const whole = wholeTrip(trip());
    const now = twinAt(trip(), earthTime);
    const plot = { x0: left + 50, x1: left + w - 24, y0: top + 18, y1: top + h - 40 };
    const X = (x: number) => plot.x0 + (x / (distance * 1.18)) * (plot.x1 - plot.x0);
    const Y = (t: number) => plot.y1 - (t / (whole.earthTime * 1.04)) * (plot.y1 - plot.y0);
    const step = markStep(whole.earthTime);

    // Axes, with the time axis numbered in the same steps as the dots.
    ctx.lineWidth = 1;
    ctx.strokeStyle = p.grid;
    ctx.beginPath();
    for (let t = step; t <= whole.earthTime; t += step) {
      ctx.moveTo(plot.x0, Math.round(Y(t)) + 0.5);
      ctx.lineTo(plot.x1, Math.round(Y(t)) + 0.5);
    }
    ctx.stroke();
    ctx.strokeStyle = p.axis;
    ctx.beginPath();
    ctx.moveTo(plot.x0, Math.round(plot.y1) + 0.5);
    ctx.lineTo(plot.x1, Math.round(plot.y1) + 0.5);
    ctx.stroke();
    for (let t = 0; t <= whole.earthTime; t += step) {
      text(ctx, p, String(t), plot.x0 - 10, Y(t), p.muted, { size: 11, align: 'right' });
    }
    text(ctx, p, 'Earth', X(0), plot.y1 + 13, p.timelike, { size: 11, weight: 600 });
    text(ctx, p, 'Star', X(distance), plot.y1 + 13, p.light, { size: 11, weight: 600 });
    text(ctx, p, 'distance from Earth', (plot.x0 + plot.x1) / 2, plot.y1 + 29, p.muted, { size: 11.5 });
    ctx.save();
    ctx.translate(left + 13, (plot.y0 + plot.y1) / 2);
    ctx.rotate(-Math.PI / 2);
    text(ctx, p, 'time on Earth (years)', 0, 0, p.muted, { size: 11.5 });
    ctx.restore();

    // The star stays put: a vertical line. A light ray from the departure, for scale.
    ctx.lineWidth = 1;
    ctx.strokeStyle = p.muted;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(X(distance), plot.y1);
    ctx.lineTo(X(distance), plot.y0);
    ctx.stroke();
    ctx.strokeStyle = p.light;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(X(0), Y(0));
    ctx.lineTo(X(distance), Y(distance)); // light covers one light-year per year
    ctx.stroke();
    ctx.setLineDash([]);
    text(ctx, p, 'light', X(distance) - 6, Y(distance) + 12, p.light, { size: 11, align: 'right', halo: p.bg });

    const turn = distance / vOut; // Earth time at the turnaround

    // The whole of each path, faintly, then the part already travelled.
    const paths: { color: string; points: [number, number][]; upTo: [number, number][] }[] = [
      {
        color: p.timelike,
        points: [[0, 0], [0, whole.earthTime]],
        upTo: [[0, 0], [0, earthTime]],
      },
      {
        color: p.prime,
        points: [[0, 0], [distance, turn], [0, whole.earthTime]],
        upTo: earthTime <= turn ? [[0, 0], [now.x, earthTime]] : [[0, 0], [distance, turn], [now.x, earthTime]],
      },
    ];
    for (const path of paths) {
      ctx.strokeStyle = path.color;
      ctx.lineJoin = 'round';
      for (const [points, width, alpha] of [[path.points, 1.5, 0.3], [path.upTo, 2.75, 1]] as const) {
        ctx.lineWidth = width;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        points.forEach(([x, t], i) => (i === 0 ? ctx.moveTo(X(x), Y(t)) : ctx.lineTo(X(x), Y(t))));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // A dot for every `step` years of each twin's own time. Filled once that birthday has happened.
    const mark = (x: number, t: number, color: string) => {
      ctx.beginPath();
      ctx.arc(X(x), Y(t), 4, 0, 2 * Math.PI);
      ctx.fillStyle = t <= earthTime + 1e-9 ? color : p.bg;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = color;
      ctx.stroke();
    };
    for (let own = step; own <= whole.earthTime + 1e-9; own += step) mark(0, own, p.timelike);
    for (let own = step; own <= whole.travellerTime + 1e-9; own += step) {
      const t = earthTimeWhenTravellerShows(own);
      mark(twinAt(trip(), t).x, t, p.prime);
    }

    // "Now", in Earth's frame, and where each twin is on it.
    ctx.lineWidth = 1;
    ctx.strokeStyle = p.muted;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(plot.x0, Y(earthTime));
    ctx.lineTo(plot.x1, Y(earthTime));
    ctx.stroke();
    ctx.setLineDash([]);
    for (const [x, color] of [[0, p.timelike], [now.x, p.prime]] as const) {
      ctx.beginPath();
      ctx.arc(X(x), Y(earthTime), 6.5, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = p.bg;
      ctx.stroke();
    }

    text(ctx, p, `dots: every ${step === 1 ? 'year' : `${step} years`} of own time`, plot.x1, plot.y0 - 4, p.muted, { size: 11, align: 'right', halo: p.bg });
  }

  // ---------- 3D scene ----------

  function build3d(stage: Stage3D): () => void {
    const { THREE, scene } = stage;
    const HALF = 6; // Earth and the star are this far either side of the middle

    const floor = stage.grid(16, 16);
    floor.position.y = -1.6;
    scene.add(floor);

    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(1, 40, 24),
      new THREE.MeshStandardMaterial({ color: stage.color('--sim-timelike'), roughness: 0.7 }),
    );
    earth.position.x = -HALF;

    const star = new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 32, 20),
      new THREE.MeshBasicMaterial({ color: stage.color('--sim-photon') }),
    );
    star.position.x = HALF;

    const route = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-HALF, 0, 0), new THREE.Vector3(HALF, 0, 0)]),
      new THREE.LineBasicMaterial({ color: stage.color('--sim-muted') }),
    );

    const ship = new THREE.Mesh(
      new THREE.ConeGeometry(0.28, 1, 24),
      new THREE.MeshStandardMaterial({ color: stage.color('--sim-prime'), roughness: 0.4 }),
    );
    scene.add(earth, star, route, ship);

    return () => {
      const now = twinAt(trip(), earthTime);
      // Leave from Earth's surface and stop short of the star's.
      ship.position.x = -HALF + 1.4 + (now.x / distance) * (2 * HALF - 2.6);
      ship.rotation.z = now.leg === 'outbound' ? -Math.PI / 2 : Math.PI / 2; // the cone's tip leads
      earth.rotation.y += 0.004;
    };
  }

  // ---------- Keeping everything in step ----------

  function update() {
    const whole = wholeTrip(trip());
    const now = twinAt(trip(), earthTime);
    earthNow.set(earthTime.toFixed(2));
    travellerNow.set(now.travellerTime.toFixed(2));
    gapNow.set((earthTime - now.travellerTime).toFixed(2));
    status.textContent = earthTime === 0 ? 'Ready' : LEG_NAMES[now.leg];
    if (now.leg === 'home') delete status.dataset.tone;
    else status.dataset.tone = 'prime';
    earthTotal.set(whole.earthTime.toFixed(2));
    travellerTotal.set(whole.travellerTime.toFixed(2));
    gapTotal.set(whole.ageDifference.toFixed(2));
    const label = `Twin paradox: ${distance} light-years out at ${vOut.toFixed(2)} c and back at ${vBack.toFixed(2)} c takes ${whole.earthTime.toFixed(1)} years on Earth and ${whole.travellerTime.toFixed(1)} years on the ship.`;
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

export const twinParadox: Sim = {
  id: 'twin',
  title: 'Twin Paradox',
  icon: 'rocket_launch',
  blurb: 'One twin flies to a star and back; the other stays home. When they meet again, the traveller is the younger one.',
  mount,
};
