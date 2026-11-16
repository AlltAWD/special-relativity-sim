/**
 * Highway View: several objects moving along one road at different speeds,
 * watched from the road.
 *
 * The figure is two plots that share their horizontal axis, position along the
 * road. The upper one is the highway, with a lane for every speed, so each
 * object sits at (where it is, how fast it goes), drawn at its contracted
 * length with the time its own clock shows. The lower one is the same scene as
 * a spacetime diagram: the objects' worldlines, with "now" as a line that
 * climbs as time passes.
 *
 * Everything is in the road's frame. Clocks fixed to the road show coordinate
 * time t; a clock carried by an object shows its proper time t / gamma. All
 * carried clocks read zero at t = 0.
 */
// Types only: the three.js code itself arrives with the 3D view (see ui/views.ts).
import type { Material, Mesh } from 'three';
import { contractedLength, gamma, properTime } from '../physics/lorentz';
import {
  button, dot, el, fitCanvas, iconButton, numberField, select, slider, toggle,
} from '../ui/controls';
import { arrow, fmt, paint, text, type Paint } from '../ui/draw';
import { bench, explain, group, inset, math, note, stat, stats } from '../ui/layout';
import { playback } from '../ui/playback';
import { dualView, type Stage3D } from '../ui/views';
import type { Sim } from './types';

/** The road runs from -ROAD to +ROAD light-seconds. */
const ROAD = 20;
/** Seconds of history the spacetime plot shows at once. */
const WINDOW = 15;
/** How many colours tokens.css defines for objects (--cat-1 to --cat-8). */
const COLOURS = 8;

interface Vehicle {
  id: number;
  name: string;
  /** Position of its middle at t = 0, in light-seconds. */
  start: number;
  /** Velocity as a fraction of c. */
  v: number;
  /** Length in its own rest frame, in light-seconds. */
  restLength: number;
  /** Which of the --cat colours it is drawn in. */
  colour: number;
  carriesClock: boolean;
}

/** A clock bolted to the road. */
interface RoadClock {
  id: number;
  name: string;
  x: number;
}

type Selection = { kind: 'vehicle' | 'clock'; id: number } | null;

function mount(root: HTMLElement): () => void {
  // ---------- State ----------
  let t = 0; // coordinate time in the road's frame, in seconds
  let rate = 1; // seconds of simulation per second of watching
  let stepSize = 0.5;
  let showGrid = true;
  let showRestLength = true;
  let made = 0; // for ids
  let objectsMade = 0; // for names and colours, so neither is reused after a removal
  let clocksMade = 0;
  let vehicles: Vehicle[] = [];
  let clocks: RoadClock[] = [];
  let selection: Selection = null;

  const positionOf = (vehicle: Vehicle, at = t) => vehicle.start + vehicle.v * at;
  const colourOf = (vehicle: Vehicle) => `--cat-${vehicle.colour}`;
  const selectedVehicle = () => (selection?.kind === 'vehicle' ? vehicles.find((x) => x.id === selection!.id) : undefined);
  const selectedClock = () => (selection?.kind === 'clock' ? clocks.find((x) => x.id === selection!.id) : undefined);

  function addVehicle(start: number, v: number, restLength: number, carriesClock = true): Vehicle {
    const vehicle: Vehicle = {
      id: ++made,
      name: `Object ${String.fromCharCode(65 + (objectsMade % 26))}`,
      start, v, restLength, carriesClock,
      colour: (objectsMade % COLOURS) + 1,
    };
    objectsMade++;
    vehicles.push(vehicle);
    return vehicle;
  }

  function addClock(x: number): RoadClock {
    const clock = { id: ++made, name: `Road clock ${++clocksMade}`, x };
    clocks.push(clock);
    return clock;
  }

  addVehicle(0, 0, 2);
  addVehicle(5, 0.6, 2);
  addVehicle(-3, 0.8, 3, false);
  addClock(0);

  // ---------- Elements ----------
  const canvas = el('canvas');
  canvas.setAttribute('role', 'img');

  const timeStat = stat(el('span', {}, 'Time on the road, ', math('t')), { unit: 's' });

  const player = playback({
    autoplay: false,
    onStep: (dt) => { t += dt * rate; refresh(); },
    onReset: () => { t = 0; refresh(); },
    before: [button('Step back', () => { t = Math.max(0, t - stepSize); refresh(); }, { icon: 'skip_previous', iconOnly: true })],
    after: [button('Step forward', () => { t += stepSize; refresh(); }, { icon: 'skip_next', iconOnly: true })],
  });

  const jump = numberField({
    label: 'Go to t',
    value: 0, min: 0, max: 999, step: 0.1,
    onChange: (value) => { t = value; refresh(); },
    small: true,
  });

  const views = dualView({
    canvas,
    camera: [0, 9, 17],
    target: [0, 0, 0],
    build: build3d,
    onChange: () => refresh(),
  });

  /** The Lorentz factor of the selected object, shown in its editor. */
  const gammaNote = note('');

  const vehicleList = el('ul', { className: 'list' });
  const vehicleEditor = el('div');
  const clockList = el('ul', { className: 'list' });
  const clockEditor = el('div');

  root.append(bench({
    figure: [canvas, views.layer],
    tall: true,
    toolbar: { start: [views.switcher], end: [player.el] },
    caption: [
      'Above: each object in the lane for its speed, at its contracted length L, with the time τ its own clock shows. Below: the same objects as worldlines. Click an object or a clock to select it.',
    ],
    panel: [
      group('Time',
        stats(timeStat),
        el('div', { className: 'row row--tight' },
          jump.el,
          select({
            label: 'Step',
            options: ['0.1', '0.5', '1', '5'].map((value) => ({ value, label: `${value} s` })),
            value: String(stepSize),
            onChange: (value) => { stepSize = Number(value); },
            small: true,
          }),
          select({
            label: 'Speed',
            options: ['0.25', '0.5', '1', '2', '5'].map((value) => ({ value, label: `${value}×` })),
            value: String(rate),
            onChange: (value) => { rate = Number(value); },
            small: true,
          }),
        ),
      ),
      group({
        title: ['Objects'],
        aside: [button('Add', () => {
          selection = { kind: 'vehicle', id: addVehicle(0, 0.3, 2).id };
          rebuild();
        }, { icon: 'add', small: true, variant: 'tonal' })],
      }, vehicleList, vehicleEditor),
      group({
        title: ['Road clocks'],
        aside: [button('Add', () => {
          selection = { kind: 'clock', id: addClock(clocks.length ? clocks[clocks.length - 1].x + 5 : 0).id };
          rebuild();
        }, { icon: 'add', small: true, variant: 'tonal' })],
      }, clockList, clockEditor),
      group('Show',
        toggle('Grid', showGrid, (on) => { showGrid = on; refresh(); }, { swatch: 'grid' }),
        toggle('Rest-length outlines', showRestLength, (on) => { showRestLength = on; refresh(); }, { swatch: 'dashed' }),
      ),
      group('About',
        explain('How to read it',
          ['The upper plot is a road with a lane for every speed: the faster an object, the further its lane is from the middle, and nothing can leave the two dashed lanes where light travels. Faster objects are drawn shorter, because they are: by the factor ', math('γ'), '.'],
          ['The lower plot shows where everything has been. An object standing still draws a vertical line; a faster one leans further over, but never past the dashed path of light.'],
          ['A road clock shows ', math('t'), ', the time everyone at rest on the road agrees on. A clock riding on an object shows ', math('τ = t / γ'), ' and falls behind.'],
        ),
      ),
    ],
  }));

  // ---------- Lists and editors ----------

  /** Per-item bits that change every frame: the line of numbers under each name. */
  const details = new Map<number, HTMLElement>();

  function item(
    kind: 'vehicle' | 'clock', id: number, name: string, colour: string, onRemove: () => void,
  ): HTMLLIElement {
    const detail = el('span', { className: 'list-detail' });
    details.set(id, detail);
    const pick = el('button', { type: 'button', className: 'list-pick' },
      dot(colour), el('span', { className: 'list-name' }, name), detail);
    const isSelected = selection?.kind === kind && selection.id === id;
    pick.setAttribute('aria-pressed', String(isSelected));
    pick.addEventListener('click', () => {
      selection = isSelected ? null : { kind, id };
      rebuild();
    });
    const row = el('li', { className: 'list-item' }, pick, iconButton(`Remove ${name}`, 'delete', onRemove, true));
    row.dataset.selected = String(isSelected);
    return row;
  }

  /** After objects or clocks are added, removed or selected: rebuild the lists and the editor. */
  function rebuild() {
    details.clear();

    vehicleList.replaceChildren(...vehicles.map((vehicle) =>
      item('vehicle', vehicle.id, vehicle.name, `var(${colourOf(vehicle)})`, () => {
        vehicles = vehicles.filter((other) => other !== vehicle);
        rebuild();
      })));
    const vehicle = selectedVehicle();
    vehicleEditor.replaceChildren(...(vehicle ? [inset([dot(`var(${colourOf(vehicle)})`), vehicle.name],
      slider({
        label: 'Position at t = 0',
        min: -15, max: 15, step: 0.5, value: vehicle.start,
        format: (x) => `${fmt(x, 1)} ls`,
        onInput: (x) => { vehicle.start = x; refresh(); },
      }),
      slider({
        label: 'Velocity',
        min: -0.95, max: 0.95, step: 0.01, value: vehicle.v,
        format: (x) => `${fmt(x)} c`,
        onInput: (x) => { vehicle.v = x; refresh(); },
      }),
      slider({
        label: 'Length at rest',
        min: 0.5, max: 5, step: 0.1, value: vehicle.restLength,
        format: (x) => `${fmt(x, 1)} ls`,
        onInput: (x) => { vehicle.restLength = x; refresh(); },
      }),
      toggle('Carries a clock', vehicle.carriesClock, (on) => { vehicle.carriesClock = on; refresh(); }),
      gammaNote,
    )] : vehicles.length ? [] : [note('No objects. Add one to put something on the road.')]));

    clockList.replaceChildren(...clocks.map((clock) =>
      item('clock', clock.id, clock.name, 'var(--sim-timelike)', () => {
        clocks = clocks.filter((other) => other !== clock);
        rebuild();
      })));
    const clock = selectedClock();
    clockEditor.replaceChildren(...(clock ? [inset([dot('var(--sim-timelike)'), clock.name],
      slider({
        label: 'Position',
        min: -15, max: 15, step: 0.5, value: clock.x,
        format: (x) => `${fmt(x, 1)} ls`,
        onInput: (x) => { clock.x = x; refresh(); },
      }),
      note('It is fixed to the road, so it shows the road’s time and draws a vertical worldline.'),
    )] : []));

    refresh();
  }

  // ---------- Geometry shared by drawing and clicking ----------

  const layout = (w: number, h: number) => {
    const left = 54;
    const right = w - 14;
    const lanes = { top: 26, bottom: Math.round(h * 0.45) };
    const worldlines = { top: lanes.bottom + 34, bottom: h - 40 };
    // The spacetime plot follows "now" once it nears the top.
    const from = Math.max(0, t - WINDOW * 0.75);
    return {
      left, right, lanes, worldlines, from,
      X: (x: number) => left + ((x + ROAD) / (2 * ROAD)) * (right - left),
      laneY: (v: number) => lanes.bottom - ((v + 1) / 2) * (lanes.bottom - lanes.top),
      timeY: (at: number) => worldlines.bottom - ((at - from) / WINDOW) * (worldlines.bottom - worldlines.top),
    };
  };

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const g = layout(rect.width, rect.height);
    const scale = (g.right - g.left) / (2 * ROAD);
    const clock = clocks.find((c) => Math.hypot(g.X(c.x) - px, g.laneY(0) + 30 - py) < 18);
    const vehicle = [...vehicles].reverse().find((x) =>
      Math.abs(g.X(positionOf(x)) - px) < Math.max(14, (contractedLength(x.restLength, x.v) * scale) / 2 + 6)
      && Math.abs(g.laneY(x.v) - py) < 16);
    selection = vehicle ? { kind: 'vehicle', id: vehicle.id } : clock ? { kind: 'clock', id: clock.id } : null;
    rebuild();
  });

  // ---------- 2D drawing ----------

  function draw(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const p = paint(canvas);
    const g = layout(w, h);
    ctx.fillStyle = p.bg;
    ctx.fillRect(0, 0, w, h);
    drawLanes(ctx, p, g);
    drawWorldlines(ctx, p, g);

    // The two plots share this axis.
    for (let x = -ROAD; x <= ROAD; x += 5) {
      text(ctx, p, String(x).replace('-', '−'), g.X(x), g.worldlines.bottom + 13, p.muted, { size: 11 });
    }
    text(ctx, p, 'position along the road (light-seconds)', (g.left + g.right) / 2, g.worldlines.bottom + 30, p.muted, { size: 11.5 });
  }

  type Layout = ReturnType<typeof layout>;

  /** Vertical grid lines for one plot, and its frame. */
  function frame(ctx: CanvasRenderingContext2D, p: Paint, g: Layout, top: number, bottom: number, rows: number[]) {
    ctx.lineWidth = 1;
    ctx.strokeStyle = p.grid;
    ctx.beginPath();
    if (showGrid) {
      for (let x = -ROAD; x <= ROAD; x += 5) {
        ctx.moveTo(Math.round(g.X(x)) + 0.5, top);
        ctx.lineTo(Math.round(g.X(x)) + 0.5, bottom);
      }
      for (const y of rows) {
        ctx.moveTo(g.left, Math.round(y) + 0.5);
        ctx.lineTo(g.right, Math.round(y) + 0.5);
      }
    }
    ctx.stroke();
    ctx.strokeStyle = p.outline;
    ctx.strokeRect(g.left + 0.5, top + 0.5, g.right - g.left, bottom - top);
  }

  /** A small pill showing a clock's reading. */
  function reading(ctx: CanvasRenderingContext2D, p: Paint, x: number, y: number, label: string, color: string, bold: boolean) {
    ctx.font = `600 11px ${p.ui}`;
    const width = Math.max(34, ctx.measureText(label).width + 14);
    ctx.beginPath();
    ctx.roundRect(x - width / 2, y - 9, width, 18, 9);
    ctx.fillStyle = p.bg;
    ctx.fill();
    ctx.lineWidth = bold ? 2.25 : 1.25;
    ctx.strokeStyle = color;
    ctx.stroke();
    text(ctx, p, label, x, y + 0.5, color, { size: 11, weight: 600 });
  }

  function drawLanes(ctx: CanvasRenderingContext2D, p: Paint, g: Layout) {
    const { top, bottom } = g.lanes;
    const scale = (g.right - g.left) / (2 * ROAD);
    frame(ctx, p, g, top, bottom, [-0.5, 0, 0.5].map(g.laneY));
    text(ctx, p, 'Highway: a lane for every speed', g.left, top - 12, p.ink, { size: 12, weight: 600, align: 'left' });
    for (const v of [-1, -0.5, 0, 0.5, 1]) {
      text(ctx, p, `${fmt(v, 1)} c`, g.left - 8, g.laneY(v), p.muted, { size: 11, align: 'right' });
    }

    // The lanes only light can use.
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = p.light;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    for (const v of [1, -1]) {
      ctx.moveTo(g.left, g.laneY(v));
      ctx.lineTo(g.right, g.laneY(v));
    }
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.save();
    ctx.beginPath();
    ctx.rect(g.left, top - 22, g.right - g.left, bottom - top + 22);
    ctx.clip();

    // Road clocks hang under the lane for "at rest", clear of the readings objects carry above them.
    for (const clock of clocks) {
      const x = g.X(clock.x);
      const y = g.laneY(0);
      ctx.lineWidth = 1.25;
      ctx.strokeStyle = p.timelike;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 21);
      ctx.stroke();
      reading(ctx, p, x, y + 30, `t  ${fmt(t, 1)}`, p.timelike, selectedClock() === clock);
    }

    for (const vehicle of vehicles) {
      const color = p.color(colourOf(vehicle));
      const x = g.X(positionOf(vehicle));
      const y = g.laneY(vehicle.v);
      const length = contractedLength(vehicle.restLength, vehicle.v) * scale;
      const isSelected = selectedVehicle() === vehicle;

      if (showRestLength && vehicle.v !== 0) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = p.muted;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(x - (vehicle.restLength * scale) / 2, y - 8, vehicle.restLength * scale, 16);
        ctx.setLineDash([]);
      }

      ctx.beginPath();
      ctx.roundRect(x - length / 2, y - 8, length, 16, Math.min(4, length / 2));
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = color;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = isSelected ? 2.75 : 1.75;
      ctx.strokeStyle = color;
      ctx.stroke();

      if (vehicle.v !== 0) {
        const way = Math.sign(vehicle.v);
        const from = x + way * (Math.max(length, vehicle.restLength * scale) / 2 + 5);
        ctx.lineWidth = 1.5;
        arrow(ctx, from, y, from + way * (8 + 22 * Math.abs(vehicle.v)), y, 6);
      }

      // The object's letter, and what its own clock shows.
      const letter = vehicle.name.replace('Object ', '');
      if (vehicle.carriesClock) {
        reading(ctx, p, x, y - 21, `${letter}  ${fmt(properTime(t, vehicle.v), 1)}`, color, isSelected);
      } else {
        text(ctx, p, letter, x, y - 19, color, { size: 11.5, weight: 600, halo: p.bg });
      }
    }
    ctx.restore();
  }

  function drawWorldlines(ctx: CanvasRenderingContext2D, p: Paint, g: Layout) {
    const { top, bottom } = g.worldlines;
    const to = g.from + WINDOW;
    const firstRow = Math.ceil(g.from / 5) * 5;
    const rows: number[] = [];
    for (let at = firstRow; at <= to; at += 5) rows.push(at);
    frame(ctx, p, g, top, bottom, rows.map(g.timeY));
    text(ctx, p, 'The same scene as worldlines', g.left, top - 12, p.ink, { size: 12, weight: 600, align: 'left' });
    for (const at of rows) text(ctx, p, `${at} s`, g.left - 8, g.timeY(at), p.muted, { size: 11, align: 'right' });

    ctx.save();
    ctx.beginPath();
    ctx.rect(g.left, top, g.right - g.left, bottom - top);
    ctx.clip();

    // Light leaving the middle of the road at t = 0.
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = p.light;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    for (const way of [1, -1]) {
      ctx.moveTo(g.X(way * g.from), g.timeY(g.from));
      ctx.lineTo(g.X(way * to), g.timeY(to));
    }
    ctx.stroke();

    // Road clocks do not move: vertical lines.
    ctx.strokeStyle = p.timelike;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    for (const clock of clocks) {
      ctx.moveTo(g.X(clock.x), top);
      ctx.lineTo(g.X(clock.x), bottom);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Each object's path: solid up to now, faint for what is still to come.
    for (const vehicle of vehicles) {
      const color = p.color(colourOf(vehicle));
      const isSelected = selectedVehicle() === vehicle;
      ctx.strokeStyle = color;
      for (const [start, end, alpha] of [[g.from, Math.min(t, to), 1], [Math.max(t, g.from), to, 0.3]] as const) {
        if (end <= start) continue;
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.moveTo(g.X(positionOf(vehicle, start)), g.timeY(start));
        ctx.lineTo(g.X(positionOf(vehicle, end)), g.timeY(end));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // "Now": every point on this line is at the same time for the road.
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = p.spacelike;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(g.left, g.timeY(t));
    ctx.lineTo(g.right, g.timeY(t));
    ctx.stroke();
    ctx.setLineDash([]);
    text(ctx, p, `now, t = ${fmt(t)} s`, g.right - 8, g.timeY(t) - 10, p.spacelike, { size: 11, weight: 600, align: 'right', halo: p.bg });

    for (const vehicle of vehicles) {
      ctx.beginPath();
      ctx.arc(g.X(positionOf(vehicle)), g.timeY(t), 5, 0, 2 * Math.PI);
      ctx.fillStyle = p.color(colourOf(vehicle));
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = p.bg;
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---------- 3D scene ----------

  function build3d(stage: Stage3D): () => void {
    const { THREE, scene } = stage;
    const LANE = 5; // scene units between the "at rest" lane and a light-speed lane

    scene.add(stage.grid(2 * ROAD, 8));

    // The light-speed lanes.
    const edge = new THREE.LineDashedMaterial({ color: stage.color('--sim-light'), dashSize: 0.6, gapSize: 0.4 });
    for (const z of [-LANE, LANE]) {
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-ROAD, 0.02, z), new THREE.Vector3(ROAD, 0.02, z)]),
        edge,
      );
      line.computeLineDistances();
      scene.add(line);
    }

    // The objects and clocks change as the visitor adds and removes them, so
    // they live in a group that is rebuilt whenever the list changes.
    const things = new THREE.Group();
    scene.add(things);
    let builtFor = '';
    let boxes: { vehicle: Vehicle; mesh: Mesh }[] = [];

    const rebuildThings = () => {
      for (const child of things.children) {
        const mesh = child as Mesh;
        mesh.geometry.dispose();
        (mesh.material as Material).dispose();
      }
      things.clear();
      boxes = vehicles.map((vehicle) => {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(1, 0.8, 1.1), // one unit long: scale.x sets the real length
          new THREE.MeshStandardMaterial({ color: stage.color(colourOf(vehicle)), roughness: 0.5 }),
        );
        things.add(mesh);
        return { vehicle, mesh };
      });
      for (const clock of clocks) {
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.16, 0.16, 2.2, 16),
          new THREE.MeshStandardMaterial({ color: stage.color('--sim-timelike'), roughness: 0.5 }),
        );
        post.position.set(clock.x, 1.1, 0.9);
        post.userData.clock = clock;
        things.add(post);
      }
    };

    return () => {
      const signature = [...vehicles.map((x) => `${x.id}:${x.colour}`), ...clocks.map((c) => `c${c.id}`)].join(',');
      if (signature !== builtFor) {
        builtFor = signature;
        rebuildThings();
      }
      for (const { vehicle, mesh } of boxes) {
        mesh.position.set(positionOf(vehicle), 0.4, -vehicle.v * LANE); // faster to the right: further from the camera
        mesh.scale.x = contractedLength(vehicle.restLength, vehicle.v);
      }
      for (const child of things.children) {
        const clock = child.userData.clock as RoadClock | undefined;
        if (clock) child.position.x = clock.x;
      }
    };
  }

  // ---------- Keeping everything in step ----------

  /** After time moves or a slider changes: refresh the numbers and redraw. */
  function refresh() {
    timeStat.set(fmt(t));
    jump.set(Number(t.toFixed(2)));
    for (const vehicle of vehicles) {
      const parts = [
        `x ${fmt(positionOf(vehicle), 1)}`,
        `v ${fmt(vehicle.v)} c`,
        `L ${fmt(contractedLength(vehicle.restLength, vehicle.v), 2)}`,
      ];
      if (vehicle.carriesClock) parts.push(`τ ${fmt(properTime(t, vehicle.v), 2)} s`);
      const detail = details.get(vehicle.id);
      if (detail) detail.textContent = parts.join(' · ');
    }
    for (const clock of clocks) {
      const detail = details.get(clock.id);
      if (detail) detail.textContent = `x ${fmt(clock.x, 1)} · t ${fmt(t, 2)} s`;
    }
    const chosen = selectedVehicle();
    if (chosen) {
      const g = gamma(chosen.v);
      gammaNote.replaceChildren(math(`γ = ${g.toFixed(3)}`), `: it is ${fmt(1 / g, 3)} of its rest length, and its clock runs at ${fmt(1 / g, 3)} of the road’s rate.`);
    }
    const label = `Highway view at t = ${t.toFixed(0)} seconds, with ${vehicles.length} objects and ${clocks.length} road clocks.`;
    if (canvas.getAttribute('aria-label') !== label) canvas.setAttribute('aria-label', label);
    view.redraw();
  }

  const view = fitCanvas(canvas, draw);
  rebuild();

  return () => {
    player.stop();
    views.stop();
    view.stop();
    root.replaceChildren();
  };
}

export const highway: Sim = {
  id: 'highway',
  title: 'Highway View',
  icon: 'road',
  blurb: 'Put objects and clocks on a road, give each a speed, and run time forward: positions, contracted lengths and clock readings, side by side with their worldlines.',
  mount,
};
