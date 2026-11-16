/**
 * Length contraction: a ship measured at rest, and the same ship measured as
 * it flies past a ruler on the ground.
 *
 * Only the dimension along the motion changes, so the ship is drawn with round
 * windows: they stay as tall as ever and become ellipses.
 */
import { contractedLength, gamma } from '../physics/lorentz';
import { el, fitCanvas, slider } from '../ui/controls';
import { arrow, backdrop, dimension, fmt, paint, text, type Paint } from '../ui/draw';
import { bench, explain, group, math, stat, stats } from '../ui/layout';
import { playback } from '../ui/playback';
import { dualView, type Stage3D } from '../ui/views';
import type { Sim } from './types';

/** Length of the ship in its own rest frame, in light-seconds. */
const REST_LENGTH = 4;

/** The animation shows this many seconds of flight per second of watching, so slow ships still get somewhere. */
const PACE = 3;

function mount(root: HTMLElement): () => void {
  // ---------- State ----------
  let v = 0.6;
  let t = 0; // seconds of watching

  /**
   * Where the middle of the moving ship is on a stretch `span` light-seconds
   * wide, centred on zero. It flies off one end and comes back in at the other.
   */
  const shipCentre = (span: number) => {
    const lap = span + REST_LENGTH; // fully out of sight at both ends
    return ((v * t * PACE + lap / 2) % lap) - lap / 2;
  };

  // ---------- Elements ----------
  const canvas = el('canvas');
  canvas.setAttribute('role', 'img');

  const gammaStat = stat(math('γ = 1 / √(1 − v²)'));
  const restStat = stat(el('span', {}, 'At rest, ', math('L_0')), { value: fmt(REST_LENGTH), unit: 'ls', tone: 'timelike' });
  const movingStat = stat(el('span', {}, 'Moving, ', math('L')), { unit: 'ls', tone: 'prime' });
  const ratioStat = stat(el('span', {}, 'Ratio ', math('L / L_0 = 1 / γ')));

  const player = playback({
    onStep: (dt) => { t += dt; update(); },
    onReset: () => { t = 0; update(); },
  });

  const views = dualView({
    canvas,
    camera: [0, 5.5, 11],
    target: [0, 0.4, 0],
    build: build3d,
    onChange: () => update(),
  });

  root.append(bench({
    figure: [canvas, views.layer],
    toolbar: { start: [views.switcher], end: [player.el] },
    caption: [
      'The rulers are at rest on the ground and marked in light-seconds (ls). The dashed outline around the moving ship is its length at rest.',
    ],
    panel: [
      group('Moving ship',
        slider({
          label: 'Velocity',
          min: 0, max: 0.99, step: 0.01, value: v,
          format: (x) => `${fmt(x)} c`,
          onInput: (x) => { v = x; update(); },
          tone: 'prime',
          marks: [0, 0.6, 0.8, 0.95],
        }),
        stats(gammaStat),
      ),
      group('Length',
        stats(restStat, movingStat),
        stats(ratioStat),
      ),
      group('About',
        explain('How it works',
          ['To measure something that is moving, you have to mark where both of its ends are at the same moment. Two frames in relative motion disagree about which moments are “the same”, so they disagree about the length.'],
          ['The ground measures the ship as ', math('L = L_0 / γ'), ', shorter than the ', math('L_0'), ' its crew measures. Only the direction of motion is affected: the ship is as tall as ever, so its round windows look squashed.'],
          ['It works both ways. To the crew the ship is its full length, and it is the ground, with its rulers, that is contracted.'],
        ),
      ),
    ],
  }));

  // ---------- 2D drawing ----------

  function draw(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const p = paint(canvas);
    backdrop(ctx, w, h, p);

    const s = w / 12; // pixels per light-second: twelve fit across
    const span = w / s;
    const shipHeight = Math.min(s * 1.15, h * 0.17);
    const length = contractedLength(REST_LENGTH, v);

    // Two lanes, each with a ship above a ruler.
    const lanes = [
      { y: h * 0.3, x: w / 2, length: REST_LENGTH, color: p.timelike, name: 'At rest', symbol: 'L₀' },
      { y: h * 0.74, x: w / 2 + shipCentre(span) * s, length, color: p.prime, name: `Moving at ${fmt(v)} c`, symbol: 'L' },
    ];

    for (const lane of lanes) {
      const rulerY = lane.y + shipHeight / 2 + 16;
      drawRuler(ctx, p, w, rulerY, s);
      text(ctx, p, lane.name, 16, lane.y - shipHeight / 2 - 44, lane.color, { size: 13, weight: 600, align: 'left' });

      const px = lane.length * s;
      if (lane.length !== REST_LENGTH) {
        // What the ship would span if it were not contracted.
        ctx.lineWidth = 1;
        ctx.strokeStyle = p.muted;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(lane.x - (REST_LENGTH * s) / 2, lane.y - shipHeight / 2, REST_LENGTH * s, shipHeight);
        ctx.setLineDash([]);
      }
      drawShip(ctx, p, lane.x, lane.y, px, shipHeight, lane.color, px / (REST_LENGTH * s));
      dimension(ctx, p, lane.x - px / 2, lane.x + px / 2, lane.y - shipHeight / 2 - 14,
        `${lane.symbol} = ${fmt(lane.length)} ls`, lane.color);
    }

    // Which way, and how fast, the lower ship is going.
    if (v > 0) {
      const moving = lanes[1];
      const nose = moving.x + (length * s) / 2;
      ctx.lineWidth = 1.75;
      ctx.strokeStyle = p.prime;
      arrow(ctx, nose + 10, moving.y, nose + 10 + 14 + 30 * v, moving.y);
    }
  }

  /** A ruler across the whole figure, with a tick per light-second and a number every two. */
  function drawRuler(ctx: CanvasRenderingContext2D, p: Paint, w: number, y: number, s: number) {
    ctx.lineWidth = 1;
    ctx.strokeStyle = p.axis;
    ctx.beginPath();
    ctx.moveTo(0, Math.round(y) + 0.5);
    ctx.lineTo(w, Math.round(y) + 0.5);
    const count = Math.ceil(w / s / 2);
    for (let k = -count; k <= count; k++) {
      const x = Math.round(w / 2 + k * s) + 0.5;
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + (k % 2 === 0 ? 8 : 5));
    }
    ctx.stroke();
    for (let k = -count; k <= count; k += 2) {
      const x = w / 2 + k * s;
      if (x > 12 && x < w - 12) text(ctx, p, String(k).replace('-', '−'), x, y + 18, p.muted, { size: 11 });
    }
  }

  /**
   * The ship, `length` pixels long and `height` tall, centred on (cx, cy) and
   * pointing right. `squash` is length / rest length: it turns the round
   * windows into ellipses.
   */
  function drawShip(
    ctx: CanvasRenderingContext2D, p: Paint, cx: number, cy: number, length: number, height: number,
    color: string, squash: number,
  ) {
    const x = (fraction: number) => cx + fraction * length; // -0.5 is the tail, 0.5 the tip of the nose
    const y = (fraction: number) => cy + fraction * height;
    ctx.beginPath();
    ctx.moveTo(x(-0.5), y(-0.5)); // top fin
    ctx.lineTo(x(-0.34), y(-0.32));
    ctx.lineTo(x(0.24), y(-0.32));
    ctx.quadraticCurveTo(x(0.42), y(-0.3), x(0.5), y(0)); // nose
    ctx.quadraticCurveTo(x(0.42), y(0.3), x(0.24), y(0.32));
    ctx.lineTo(x(-0.34), y(0.32));
    ctx.lineTo(x(-0.5), y(0.5)); // bottom fin
    ctx.lineTo(x(-0.44), y(0));
    ctx.closePath();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.stroke();

    const radius = height * 0.13;
    for (const at of [-0.2, 0, 0.2]) {
      ctx.beginPath();
      ctx.ellipse(x(at), cy, radius * squash, radius, 0, 0, 2 * Math.PI);
      ctx.fillStyle = p.bg;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  // ---------- 3D scene ----------

  function build3d(stage: Stage3D): () => void {
    const { THREE, scene } = stage;
    const SPAN = 18; // light-seconds of ground the scene shows

    scene.add(stage.grid(SPAN, SPAN));

    const makeShip = (color: string, z: number) => {
      const ship = new THREE.Group();
      const hull = new THREE.MeshStandardMaterial({ color: stage.color(color), metalness: 0.15, roughness: 0.5 });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, REST_LENGTH * 0.76, 28), hull);
      body.rotation.z = -Math.PI / 2; // lay the cylinder along x
      body.position.x = -REST_LENGTH * 0.12;
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.42, REST_LENGTH * 0.24, 28), hull);
      nose.rotation.z = -Math.PI / 2;
      nose.position.x = REST_LENGTH * 0.38;
      ship.add(body, nose);
      // Spherical portholes: contraction turns them into ellipsoids.
      const glass = new THREE.MeshStandardMaterial({ color: stage.color('--sim-bg'), roughness: 0.2 });
      for (const at of [-0.22, 0, 0.22]) {
        const porthole = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 12), glass);
        porthole.position.set(at * REST_LENGTH - REST_LENGTH * 0.12, 0, 0.34);
        ship.add(porthole);
      }
      ship.position.set(0, 0.55, z);
      scene.add(ship);
      return ship;
    };

    makeShip('--sim-timelike', 1.8);
    const moving = makeShip('--sim-prime', -1.8);

    return () => {
      moving.position.x = shipCentre(SPAN);
      moving.scale.x = 1 / gamma(v);
    };
  }

  // ---------- Keeping everything in step ----------

  function update() {
    const g = gamma(v);
    const length = contractedLength(REST_LENGTH, v);
    gammaStat.set(g.toFixed(3));
    movingStat.set(fmt(length));
    ratioStat.set((1 / g).toFixed(3));
    const label = `A ship ${fmt(REST_LENGTH)} light-seconds long at rest measures ${fmt(length)} light-seconds when it moves at ${v.toFixed(2)} c.`;
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

export const lengthContraction: Sim = {
  id: 'length-contraction',
  title: 'Length Contraction',
  icon: 'straighten',
  blurb: 'A moving object is shorter along its direction of motion: measure the same ship at rest and in flight.',
  mount,
};
