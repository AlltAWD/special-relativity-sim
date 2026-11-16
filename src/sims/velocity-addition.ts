/**
 * Velocity addition: something moves at u inside a frame S' that itself moves
 * at v. How fast is it in S?
 *
 * The figure has two halves. The race shows the answer in motion, with a light
 * pulse to set the limit and a dashed "ghost" where the everyday rule u + v
 * says the object should be. The chart below shows both rules for every u at
 * once: the everyday one is a straight line that crosses the speed of light,
 * the real one bends to stay under it.
 */
import { addVelocities, galileanSum } from '../physics/lorentz';
import { el, fitCanvas, slider } from '../ui/controls';
import { backdrop, fmt, paint, photon, text, type Paint } from '../ui/draw';
import { bench, explain, frac, group, math, stat, stats, tag } from '../ui/layout';
import { playback } from '../ui/playback';
import { dualView, type Stage3D } from '../ui/views';
import type { Sim } from './types';

/** Seconds for the light pulse to run the length of the track, and the pause before the next race. */
const RACE = 4;
const PAUSE = 0.9;

function mount(root: HTMLElement): () => void {
  // ---------- State ----------
  let u = 0.6; // the object, measured in S'
  let v = 0.5; // S', measured in S
  let t = 0; // seconds of watching

  /** How far through the current race we are, from 0 to 1. Light is at exactly this fraction of the track. */
  const progress = () => Math.min((t % (RACE + PAUSE)) / RACE, 1);
  /** If anything runs backwards the race starts mid-track, so there is room both ways. */
  const twoWay = () => u < 0 || v < 0;

  // ---------- Elements ----------
  const canvas = el('canvas');
  canvas.setAttribute('role', 'img');

  const realStat = stat('Relativistic', { unit: 'c', tone: 'timelike' });
  const classicalStat = stat(el('span', {}, 'Everyday rule, ', math('u + v')), { unit: 'c', tone: 'spacelike' });
  const gapStat = stat('The everyday rule is off by', { unit: 'c' });
  const verdict = tag('');
  const working = el('div', { className: 'formula formula--working' });

  const player = playback({
    onStep: (dt) => { t += dt; view.redraw(); },
    onReset: () => { t = 0; view.redraw(); },
  });

  const views = dualView({
    canvas,
    camera: [0, 6.5, 13],
    target: [0, 0.3, 0],
    build: build3d,
    onChange: () => view.redraw(),
  });

  root.append(bench({
    figure: [canvas, views.layer],
    tall: true,
    toolbar: { start: [views.switcher], end: [player.el] },
    caption: [
      'Everything starts together. The light pulse reaches the end of the track in every race; the object (solid) never catches it, though the everyday rule (dashed) may say it should.',
    ],
    panel: [
      group('Speeds',
        slider({
          label: 'Object, measured in S′ (u)',
          min: -0.99, max: 0.99, step: 0.01, value: u,
          format: (x) => `${fmt(x)} c`,
          onInput: (x) => { u = x; t = 0; update(); },
          tone: 'timelike',
          marks: [-0.9, 0, 0.6, 0.9],
        }),
        slider({
          label: 'Frame S′, measured in S (v)',
          min: -0.99, max: 0.99, step: 0.01, value: v,
          format: (x) => `${fmt(x)} c`,
          onInput: (x) => { v = x; t = 0; update(); },
          tone: 'prime',
          marks: [-0.9, 0, 0.5, 0.9],
        }),
      ),
      group('Speed of the object in S',
        stats(realStat, classicalStat),
        stats(gapStat),
        el('div', { className: 'actions' }, verdict),
        working,
      ),
      group('About',
        explain('How it works',
          ['At everyday speeds you add velocities: walk at 5 km/h along a train doing 100 km/h and the platform sees 105 km/h. That rule is an approximation.'],
          ['The exact rule divides by ', math('1 + uv'), '. For slow things ', math('uv'), ' is tiny and nothing changes. Near the speed of light it matters a great deal, and the result can never reach 1.'],
          ['Try ', math('u = 1'), ' in your head: ', math('(1 + v) / (1 + v) = 1'), '. Light moves at the speed of light in every frame, whatever the frame is doing.'],
        ),
      ),
    ],
  }));

  // ---------- 2D drawing ----------

  function draw(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const p = paint(canvas);
    backdrop(ctx, w, h, p);
    const split = Math.round(h * 0.4);
    drawRace(ctx, p, w, split);
    ctx.lineWidth = 1;
    ctx.strokeStyle = p.outline;
    ctx.beginPath();
    ctx.moveTo(0, split + 0.5);
    ctx.lineTo(w, split + 0.5);
    ctx.stroke();
    drawChart(ctx, p, 0, split, w, h - split);
  }

  /** Three lanes: light, the object (with its everyday-rule ghost), and the frame S'. */
  function drawRace(ctx: CanvasRenderingContext2D, p: Paint, w: number, h: number) {
    const real = addVelocities(u, v);
    const classical = galileanSum(u, v);
    const left = 20;
    const right = w - 20;
    // Where the race starts, and how many pixels light covers in one race.
    const start = twoWay() ? (left + right) / 2 : left + 28;
    const reach = (twoWay() ? (right - left) / 2 : right - start) - 8;
    const at = (speed: number) => start + speed * progress() * reach;
    const lanes = [0.27, 0.55, 0.83].map((f) => h * f);

    // Start line, and where light gets to.
    ctx.lineWidth = 1;
    ctx.strokeStyle = p.outline;
    ctx.beginPath();
    for (const x of twoWay() ? [start, start - reach, start + reach] : [start, start + reach]) {
      ctx.moveTo(Math.round(x) + 0.5, lanes[0] - 22);
      ctx.lineTo(Math.round(x) + 0.5, lanes[2] + 16);
    }
    for (const y of lanes) {
      ctx.moveTo(left, Math.round(y + 12) + 0.5);
      ctx.lineTo(right, Math.round(y + 12) + 0.5);
    }
    ctx.stroke();

    const labelAbove = (label: string, x: number, y: number, color: string) => {
      const align = x > w - 70 ? 'right' : x < 70 ? 'left' : 'center';
      text(ctx, p, label, Math.max(left, Math.min(right, x)), y - 17, color, { size: 11.5, weight: 600, align, halo: p.bg });
    };

    // Light: the limit. One pulse each way if the race is two-way.
    for (const direction of twoWay() ? [1, -1] : [1]) photon(ctx, p, at(direction), lanes[0], 5);
    labelAbove('light, 1.00 c', at(1), lanes[0], p.light);

    // The everyday rule's prediction: a dashed ring, which can leave light behind.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();
    ctx.lineWidth = 1.75;
    ctx.strokeStyle = p.spacelike;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(at(classical), lanes[1], 8, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // The object itself.
    ctx.fillStyle = p.timelike;
    ctx.beginPath();
    ctx.arc(at(real), lanes[1], 8, 0, 2 * Math.PI);
    ctx.fill();
    // Label whichever of the two is ahead on the outside, so the labels do not sit on each other.
    const apart = Math.abs(at(classical) - at(real)) > 78;
    labelAbove(`object, ${fmt(real, 3)} c`, at(real), lanes[1], p.timelike);
    if (apart && at(classical) > left && at(classical) < right) {
      labelAbove(`u + v = ${fmt(classical, 2)} c`, at(classical), lanes[1], p.spacelike);
    }

    // The frame S': a flat car.
    const carX = at(v);
    ctx.fillStyle = p.prime;
    ctx.globalAlpha = 0.18;
    ctx.beginPath();
    ctx.roundRect(carX - 26, lanes[2] - 9, 52, 18, 5);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.75;
    ctx.strokeStyle = p.prime;
    ctx.stroke();
    labelAbove(`S′, ${fmt(v)} c`, carX, lanes[2], p.prime);
  }

  /** The object's speed in S against its speed in S', for the chosen v: both rules, and the limit. */
  function drawChart(ctx: CanvasRenderingContext2D, p: Paint, left: number, top: number, w: number, h: number) {
    const plot = { x0: left + 46, x1: left + w - 18, y0: top + 16, y1: top + h - 38 };
    const X = (speed: number) => plot.x0 + ((speed + 1) / 2) * (plot.x1 - plot.x0); // u from -1 to 1
    const Y = (speed: number) => plot.y1 - ((speed + 2.1) / 4.2) * (plot.y1 - plot.y0); // result from -2.1 to 2.1
    const real = addVelocities(u, v);
    const classical = galileanSum(u, v);

    // Beyond the speed of light: nothing real can be here.
    ctx.fillStyle = p.spacelike;
    ctx.globalAlpha = 0.07;
    ctx.fillRect(plot.x0, plot.y0, plot.x1 - plot.x0, Y(1) - plot.y0);
    ctx.fillRect(plot.x0, Y(-1), plot.x1 - plot.x0, plot.y1 - Y(-1));
    ctx.globalAlpha = 1;

    // Grid and numbers.
    ctx.lineWidth = 1;
    ctx.strokeStyle = p.grid;
    ctx.beginPath();
    for (let k = -2; k <= 2; k++) {
      ctx.moveTo(plot.x0, Math.round(Y(k)) + 0.5);
      ctx.lineTo(plot.x1, Math.round(Y(k)) + 0.5);
    }
    for (let k = -2; k <= 2; k++) {
      ctx.moveTo(Math.round(X(k / 2)) + 0.5, plot.y0);
      ctx.lineTo(Math.round(X(k / 2)) + 0.5, plot.y1);
    }
    ctx.stroke();
    ctx.strokeStyle = p.axis;
    ctx.beginPath();
    ctx.moveTo(plot.x0, Math.round(Y(0)) + 0.5);
    ctx.lineTo(plot.x1, Math.round(Y(0)) + 0.5);
    ctx.moveTo(Math.round(X(0)) + 0.5, plot.y0);
    ctx.lineTo(Math.round(X(0)) + 0.5, plot.y1);
    ctx.stroke();
    for (let k = -2; k <= 2; k++) {
      text(ctx, p, String(k).replace('-', '−'), plot.x0 - 8, Y(k), p.muted, { size: 11, align: 'right' });
      text(ctx, p, fmt(k / 2, 1), X(k / 2), plot.y1 + 12, p.muted, { size: 11 });
    }
    text(ctx, p, 'u: speed of the object in S′', (plot.x0 + plot.x1) / 2, plot.y1 + 28, p.muted, { size: 11.5 });
    ctx.save();
    ctx.translate(left + 13, (plot.y0 + plot.y1) / 2);
    ctx.rotate(-Math.PI / 2);
    text(ctx, p, 'its speed in S', 0, 0, p.muted, { size: 11.5 });
    ctx.restore();

    // The speed of light, both ways.
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = p.light;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    for (const limit of [1, -1]) {
      ctx.moveTo(plot.x0, Y(limit));
      ctx.lineTo(plot.x1, Y(limit));
    }
    ctx.stroke();
    ctx.setLineDash([]);
    // Top left is always empty: both rules give a speed below zero at u = -1.
    text(ctx, p, 'speed of light', plot.x0 + 8, Y(1) + 11, p.light, { size: 11, align: 'left', halo: p.bg });
    text(ctx, p, 'faster than light', plot.x0 + 8, plot.y0 + 10, p.spacelike, { size: 11, align: 'left' });

    ctx.save();
    ctx.beginPath();
    ctx.rect(plot.x0, plot.y0, plot.x1 - plot.x0, plot.y1 - plot.y0);
    ctx.clip();

    // Everyday rule: a straight line.
    ctx.lineWidth = 1.75;
    ctx.strokeStyle = p.spacelike;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(X(-1), Y(galileanSum(-1, v)));
    ctx.lineTo(X(1), Y(galileanSum(1, v)));
    ctx.stroke();
    ctx.setLineDash([]);

    // The real rule: a curve from (-1, -1) to (1, 1), whatever v is.
    ctx.lineWidth = 2.25;
    ctx.strokeStyle = p.timelike;
    ctx.beginPath();
    for (let i = 0; i <= 120; i++) {
      const speed = -1 + (2 * i) / 120;
      const y = Y(addVelocities(speed, v));
      if (i === 0) ctx.moveTo(X(speed), y);
      else ctx.lineTo(X(speed), y);
    }
    ctx.stroke();

    // The chosen u.
    ctx.lineWidth = 1;
    ctx.strokeStyle = p.muted;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(X(u), plot.y0);
    ctx.lineTo(X(u), plot.y1);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 1.75;
    ctx.strokeStyle = p.spacelike;
    ctx.fillStyle = p.bg;
    ctx.beginPath();
    ctx.arc(X(u), Y(classical), 5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = p.timelike;
    ctx.beginPath();
    ctx.arc(X(u), Y(real), 5.5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();
  }

  // ---------- 3D scene ----------

  function build3d(stage: Stage3D): () => void {
    const { THREE, scene } = stage;
    const HALF = 8; // half the length of the track, in scene units

    const floor = stage.grid(2 * HALF, 16);
    scene.add(floor);

    // Three lanes across the track: light at the back, the object in the middle, S' at the front.
    const lane = { light: -2.4, object: 0, car: 2.4 };

    const pulses = [1, -1].map(() => {
      const pulse = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 24, 16),
        new THREE.MeshBasicMaterial({ color: stage.color('--sim-photon') }),
      );
      pulse.position.set(0, 0.4, lane.light);
      scene.add(pulse);
      return pulse;
    });

    const object = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 28, 18),
      new THREE.MeshStandardMaterial({ color: stage.color('--sim-timelike'), roughness: 0.4 }),
    );
    object.position.set(0, 0.42, lane.object);

    // Where the everyday rule puts the object: a wire outline.
    const ghost = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 12, 8),
      new THREE.MeshBasicMaterial({ color: stage.color('--sim-spacelike'), wireframe: true }),
    );
    ghost.position.set(0, 0.42, lane.object);

    const car = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 0.3, 1.5),
      new THREE.MeshStandardMaterial({ color: stage.color('--sim-prime'), roughness: 0.55 }),
    );
    car.position.set(0, 0.15, lane.car);
    scene.add(object, ghost, car);

    return () => {
      const start = twoWay() ? 0 : -HALF + 1;
      const reach = twoWay() ? HALF - 1 : 2 * HALF - 2;
      const at = (speed: number) => start + speed * progress() * reach;
      pulses[0].position.x = at(1);
      pulses[1].position.x = at(-1);
      pulses[1].visible = twoWay();
      object.position.x = at(addVelocities(u, v));
      ghost.position.x = at(galileanSum(u, v));
      car.position.x = at(v);
    };
  }

  // ---------- Keeping everything in step ----------

  /** After u or v changes. (While the race just plays, only the figure needs redrawing.) */
  function update() {
    const real = addVelocities(u, v);
    const classical = galileanSum(u, v);
    realStat.set(fmt(real, 3));
    classicalStat.set(fmt(classical, 3));
    gapStat.set(fmt(Math.abs(classical - real), 3));

    const impossible = Math.abs(classical) > 1;
    verdict.textContent = impossible
      ? 'The everyday rule gives a speed faster than light'
      : 'Both rules stay below the speed of light here';
    if (impossible) verdict.dataset.tone = 'spacelike';
    else delete verdict.dataset.tone;

    // The formula with this u and v filled in.
    working.replaceChildren(
      math('w ='),
      frac('u + v', '1 + uv'),
      math('='),
      frac(math(`${fmt(u)} + ${fmt(v)}`.replace('+ −', '− ')), math(`1 + ${fmt(u * v, 3)}`.replace('+ −', '− '))),
      math(`= ${fmt(real, 3)}`),
    );

    canvas.setAttribute('aria-label',
      `An object moving at ${fmt(u)} c in a frame moving at ${fmt(v)} c moves at ${fmt(real, 3)} c. Adding the speeds would give ${fmt(classical, 3)} c.`);
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

export const velocityAddition: Sim = {
  id: 'velocity-addition',
  title: 'Velocity Addition',
  icon: 'speed',
  blurb: 'Speeds do not simply add. Combine any two below the speed of light and the result is still below it.',
  mount,
};
