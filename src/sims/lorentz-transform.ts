/**
 * The Lorentz transformation, one event at a time: type in an event's
 * coordinates in S and see, with the arithmetic, what they are in S'.
 *
 * The Spacetime Diagram shows a boost by tilting the axes and leaving the
 * events where they are. This figure shows the other reading of the same
 * equations: the axes stay put and each event's coordinates move. As the speed
 * changes, an event slides along a hyperbola, the curve of every point that
 * shares its interval s^2 = t^2 - x^2 from the origin. That is the invariance
 * of the interval, drawn.
 */
import { boost, classifyInterval, gamma, interval, type Event2D, type IntervalKind } from '../physics/lorentz';
import { button, dot, el, fitCanvas, iconButton, numberField, slider, type NumberField } from '../ui/controls';
import { fmt, paint, text } from '../ui/draw';
import { bench, explain, group, legend, math, note, srOnly, stat, stats, tag } from '../ui/layout';
import type { Sim } from './types';

/** Half-height of the visible region. A wide figure shows more than this in x. */
const RANGE = 8;
/** How far out an event may be placed. */
const LIMIT = 7;

interface Marked extends Event2D {
  id: number;
  label: string;
}

const STARTING_EVENTS: Event2D[] = [{ t: 2, x: 3 }, { t: 4, x: 1 }, { t: 3, x: -3 }];

const snap = (n: number) => Math.round(n * 10) / 10;
const within = (n: number) => Math.max(-LIMIT, Math.min(LIMIT, n));
/** A number as it appears inside a product: negative ones get brackets. */
const factor = (n: number) => (n < 0 ? `(${fmt(n)})` : fmt(n));

function mount(root: HTMLElement): () => void {
  // ---------- State ----------
  let v = 0.5;
  let events: Marked[] = [];
  let created = 0;
  let selectedId = 0;
  let dragId: number | null = null;

  const kindOf = (ev: Event2D): IntervalKind => classifyInterval(interval(ev.t, ev.x));
  const selected = () => events.find((ev) => ev.id === selectedId) ?? events[0];

  function add(t: number, x: number): Marked {
    created++;
    const ev = { id: created, label: `E${created}`, t, x };
    events.push(ev);
    return ev;
  }

  // ---------- Elements ----------
  const canvas = el('canvas');
  canvas.setAttribute('role', 'img');

  const gammaStat = stat(math('γ = 1 / √(1 − v²)'));

  const tbody = el('tbody');
  const table = el('table', { className: 'table' },
    el('thead', {}, el('tr', {},
      el('th', { scope: 'col' }, srOnly('Event')),
      el('th', { scope: 'col' }, math('t')),
      el('th', { scope: 'col' }, math('x')),
      el('th', { scope: 'col', className: 'is-prime starts-block' }, math('t′')),
      el('th', { scope: 'col', className: 'is-prime' }, math('x′')),
      el('th', { scope: 'col' }, srOnly('Remove')),
    )),
    tbody,
  );

  const workingTitle = el('span');
  const kindTag = tag('');
  const working = el('div', { className: 'working' });

  const addButton = button('Add', () => {
    // A spot that is free, a little further round each time.
    const spots: [number, number][] = [[1, -2], [5, 3], [-2, 4], [-3, -1], [2, -5], [6, -2]];
    const [t, x] = spots.find(([st, sx]) => !events.some((ev) => ev.t === st && ev.x === sx)) ?? [1, 1];
    selectedId = add(t, x).id;
    update();
  }, { icon: 'add', small: true, variant: 'tonal' });

  const resetButton = button('Reset', () => {
    events = [];
    created = 0;
    for (const start of STARTING_EVENTS) add(start.t, start.x);
    selectedId = events[0].id;
    update();
  }, { small: true, variant: 'text' });

  root.append(bench({
    figure: [canvas],
    caption: [
      'A ring is an event’s coordinates in S; the dot on the same curve is its coordinates in S′. Drag a ring, or type in the table. Units: seconds and light-seconds.',
    ],
    panel: [
      group('Frame S′',
        slider({
          label: 'Velocity of S′',
          min: -0.99, max: 0.99, step: 0.01, value: v,
          format: (x) => `${fmt(x)} c`,
          onInput: (x) => { v = x; update(); },
          tone: 'prime',
          marks: [-0.8, -0.6, 0, 0.6, 0.8],
        }),
        stats(gammaStat),
      ),
      group({ title: ['Events'], aside: [addButton, resetButton] },
        el('div', { className: 'table-wrap' }, table),
      ),
      group({ title: [workingTitle], aside: [kindTag] }, working),
      group('About',
        legend(
          [dot('var(--sim-timelike)'), 'Timelike, ', math('s² > 0'), ': slides along a curve inside the light cone'],
          [dot('var(--sim-lightlike)'), 'Lightlike, ', math('s² = 0'), ': stays on the light line'],
          [dot('var(--sim-spacelike)'), 'Spacelike, ', math('s² < 0'), ': slides along a curve outside it'],
        ),
        explain('How it works',
          ['An event is a place and a time: “here, now”. Its coordinates ', math('(t, x)'), ' depend on who is measuring. The Lorentz transformation turns one observer’s coordinates into another’s.'],
          ['Time and space mix: ', math('t′'), ' depends on ', math('x'), ' as well as ', math('t'), '. That is why two events at the same time in S (same ', math('t'), ', different ', math('x'), ') are at different times in S′.'],
          ['What does not change is ', math('s² = t² − x²'), '. Every observer computes the same value, so an event can only move along the curve where that value is constant.'],
        ),
      ),
    ],
  }));

  // ---------- Geometry ----------

  const geometry = () => {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    const scale = Math.min(w, h) / (2 * RANGE);
    return { w, h, scale, cx: w / 2, cy: h / 2 };
  };

  const toLocal = (at: { clientX: number; clientY: number }) => {
    const rect = canvas.getBoundingClientRect();
    return { px: at.clientX - rect.left, py: at.clientY - rect.top };
  };

  /** The event whose ring (its S coordinates) or dot (S') is within reach of a point. */
  const hit = (px: number, py: number, reach: number): { ev: Marked; ring: boolean } | undefined => {
    const { scale, cx, cy } = geometry();
    let nearest: { ev: Marked; ring: boolean } | undefined;
    let distance = reach;
    for (const ev of events) {
      const inPrime = boost(ev, v);
      const candidates: [Event2D, boolean][] = [[inPrime, false], [ev, true]]; // rings win ties: they can be dragged
      for (const [at, ring] of candidates) {
        const d = Math.hypot(cx + at.x * scale - px, cy - at.t * scale - py);
        if (d <= distance) {
          nearest = { ev, ring };
          distance = d;
        }
      }
    }
    return nearest;
  };

  // ---------- Pointer: click to select, drag a ring to move its event ----------

  canvas.addEventListener('pointermove', (e) => {
    const { px, py } = toLocal(e);
    if (dragId !== null) {
      const ev = events.find((candidate) => candidate.id === dragId);
      const { scale, cx, cy } = geometry();
      if (ev) {
        ev.t = snap(within((cy - py) / scale));
        ev.x = snap(within((px - cx) / scale));
      }
      update();
      return;
    }
    const target = hit(px, py, 12);
    canvas.style.cursor = target ? (target.ring ? 'grab' : 'pointer') : 'default';
  });

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const { px, py } = toLocal(e);
    const target = hit(px, py, e.pointerType === 'touch' ? 24 : 12);
    if (!target) return;
    selectedId = target.ev.id;
    if (target.ring) {
      dragId = target.ev.id;
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
    }
    update();
  });

  const endDrag = () => {
    if (dragId === null) return;
    dragId = null;
    canvas.style.cursor = 'grab';
    update();
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  // On a touch screen a drag scrolls the page, unless it starts on a ring.
  canvas.addEventListener('touchstart', (e) => {
    const { px, py } = toLocal(e.touches[0]);
    if (hit(px, py, 24)?.ring) e.preventDefault();
  }, { passive: false });

  // ---------- Events table ----------

  interface Row {
    tr: HTMLTableRowElement;
    chip: HTMLButtonElement;
    tField: NumberField;
    xField: NumberField;
    primeCells: HTMLTableCellElement[];
    kind: IntervalKind | null;
  }
  const rows = new Map<number, Row>();
  let rowsFor = '';

  function makeRow(ev: Marked): HTMLTableRowElement {
    const chip = el('button', { type: 'button', className: 'event-chip' });
    chip.addEventListener('click', () => { selectedId = ev.id; update(); });
    const field = (axis: 't' | 'x') => numberField({
      name: `${ev.label}, ${axis} in S`,
      value: ev[axis], min: -LIMIT, max: LIMIT, step: 0.1,
      onChange: (value) => { ev[axis] = value; selectedId = ev.id; update(); },
    });
    const tField = field('t');
    const xField = field('x');
    const primeCells = [el('td', { className: 'is-prime starts-block' }), el('td', { className: 'is-prime' })];
    const removeButton = iconButton(`Remove ${ev.label}`, 'close', () => {
      events = events.filter((other) => other !== ev);
      update();
    }, true);
    removeButton.disabled = events.length <= 1; // the worked example always needs an event
    const tr = el('tr', {},
      el('th', { scope: 'row' }, chip),
      el('td', {}, tField.el), el('td', {}, xField.el),
      ...primeCells,
      el('td', {}, removeButton),
    );
    rows.set(ev.id, { tr, chip, tField, xField, primeCells, kind: null });
    return tr;
  }

  function syncTable() {
    // Rebuild only when events are added or removed, so a field being typed in is not replaced.
    const ids = events.map((ev) => ev.id).join(',');
    if (ids !== rowsFor) {
      rowsFor = ids;
      rows.clear();
      tbody.replaceChildren(...events.map(makeRow));
    }
    for (const ev of events) {
      const row = rows.get(ev.id)!;
      const inPrime = boost(ev, v);
      row.tField.set(ev.t);
      row.xField.set(ev.x);
      row.primeCells[0].textContent = fmt(inPrime.t);
      row.primeCells[1].textContent = fmt(inPrime.x);
      const kind = kindOf(ev);
      if (row.kind !== kind) {
        row.kind = kind;
        row.chip.replaceChildren(dot(`var(--sim-${kind})`), ev.label);
      }
      const isSelected = ev.id === selected().id;
      row.tr.classList.toggle('is-active', isSelected);
      row.chip.setAttribute('aria-pressed', String(isSelected));
      row.chip.setAttribute('aria-label', `${ev.label}, ${kind}${isSelected ? ', shown worked out below' : ''}`);
    }
  }

  // ---------- The transformation, written out for the selected event ----------

  function syncWorking() {
    const ev = selected();
    const g = gamma(v);
    const inPrime = boost(ev, v);
    const s2 = interval(ev.t, ev.x);
    const kind = classifyInterval(s2);
    workingTitle.textContent = `${ev.label}, worked out`;
    kindTag.textContent = kind;
    kindTag.dataset.tone = kind;
    // Each line is in pieces, so a long one can wrap between them in a narrow panel.
    const line = (...pieces: string[]) => el('div', { className: 'formula formula--working' }, ...pieces.map(math));
    working.replaceChildren(
      line('t′ = γ(t − vx)', `= ${g.toFixed(3)} × (${fmt(ev.t)} − ${factor(v)} × ${factor(ev.x)})`, `= ${fmt(inPrime.t)}`),
      line('x′ = γ(x − vt)', `= ${g.toFixed(3)} × (${fmt(ev.x)} − ${factor(v)} × ${factor(ev.t)})`, `= ${fmt(inPrime.x)}`),
      line('s² = t² − x²', `= ${fmt(s2)}`),
      line('t′² − x′²', `= ${fmt(interval(inPrime.t, inPrime.x))}`),
      note('The last two agree for every velocity: the interval is the same in both frames.'),
    );
  }

  // ---------- Drawing ----------

  function draw(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const p = paint(canvas);
    const { scale, cx, cy } = geometry();
    const X = (x: number) => cx + x * scale;
    const Y = (t: number) => cy - t * scale;
    const xMax = w / 2 / scale;
    const far = xMax + RANGE + 2;

    ctx.fillStyle = p.bg;
    ctx.fillRect(0, 0, w, h);

    // Graph paper, one unit to the square.
    ctx.beginPath();
    for (let k = -Math.floor(xMax); k <= Math.floor(xMax); k++) {
      ctx.moveTo(Math.round(X(k)) + 0.5, 0);
      ctx.lineTo(Math.round(X(k)) + 0.5, h);
    }
    for (let k = -RANGE; k <= RANGE; k++) {
      ctx.moveTo(0, Math.round(Y(k)) + 0.5);
      ctx.lineTo(w, Math.round(Y(k)) + 0.5);
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = p.grid;
    ctx.stroke();

    // Light lines.
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = p.light;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(X(-far), Y(-far));
    ctx.lineTo(X(far), Y(far));
    ctx.moveTo(X(-far), Y(far));
    ctx.lineTo(X(far), Y(-far));
    ctx.stroke();
    ctx.setLineDash([]);

    // Axes. The same pair serves both frames: (t, x) for the rings, (t', x') for the dots.
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = p.axis;
    ctx.beginPath();
    ctx.moveTo(0, Y(0));
    ctx.lineTo(w, Y(0));
    ctx.moveTo(X(0), 0);
    ctx.lineTo(X(0), h);
    ctx.stroke();
    for (let k = -2 * Math.floor(far / 2); k <= far; k += 2) {
      if (k === 0) continue;
      const label = String(k).replace('-', '−');
      if (X(k) > 14 && X(k) < w - 44) text(ctx, p, label, X(k), Y(0) + 13, p.muted, { size: 11, halo: p.bg });
      if (Y(k) > 28 && Y(k) < h - 10) text(ctx, p, label, X(0) - 8, Y(k), p.muted, { size: 11, align: 'right', halo: p.bg });
    }
    text(ctx, p, 'x, x′', w - 10, Y(0) - 13, p.axis, { size: 16, math: true, align: 'right', halo: p.bg });
    text(ctx, p, 't, t′', X(0) + 10, 14, p.axis, { size: 16, math: true, align: 'left', halo: p.bg });

    const current = selected();
    for (const ev of events) {
      const kind = kindOf(ev);
      const color = p.color(`--sim-${kind}`);
      const inPrime = boost(ev, v);
      const isSelected = ev === current;

      // Everywhere this event's coordinates can be, in any frame: boost it by every speed.
      ctx.lineWidth = 1;
      ctx.strokeStyle = color;
      ctx.globalAlpha = isSelected ? 0.55 : 0.28;
      ctx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const at = boost(ev, Math.tanh(-3.2 + (6.4 * i) / 120)); // even steps of rapidity cover the curve evenly
        if (i === 0) ctx.moveTo(X(at.x), Y(at.t));
        else ctx.lineTo(X(at.x), Y(at.t));
      }
      ctx.stroke();

      // The stretch it has moved along, from v = 0 to the chosen v.
      ctx.lineWidth = 2.5;
      ctx.globalAlpha = isSelected ? 0.9 : 0.5;
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const at = boost(ev, (v * i) / 40);
        if (i === 0) ctx.moveTo(X(at.x), Y(at.t));
        else ctx.lineTo(X(at.x), Y(at.t));
      }
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Ring: where S puts the event. Dot: where S' puts it.
      ctx.lineWidth = 2.25;
      ctx.fillStyle = p.bg;
      ctx.beginPath();
      ctx.arc(X(ev.x), Y(ev.t), isSelected ? 7 : 6, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(X(inPrime.x), Y(inPrime.t), isSelected ? 6 : 5, 0, 2 * Math.PI);
      ctx.fill();

      text(ctx, p, ev.label, X(ev.x) + 11, Y(ev.t) - 11, p.ink, { size: 12.5, weight: 600, align: 'left', halo: p.bg });
      // Only name the dot separately once it has moved clear of the ring.
      if (Math.hypot(X(inPrime.x) - X(ev.x), Y(inPrime.t) - Y(ev.t)) > 30) {
        text(ctx, p, `${ev.label}′`, X(inPrime.x) + 10, Y(inPrime.t) - 10, color, { size: 12.5, weight: 600, align: 'left', halo: p.bg });
      }
    }
  }

  // ---------- Keeping everything in step ----------

  function update() {
    gammaStat.set(gamma(v).toFixed(3));
    syncTable();
    syncWorking();
    const ev = selected();
    const inPrime = boost(ev, v);
    canvas.setAttribute('aria-label',
      `Lorentz transformation at ${v.toFixed(2)} c. ${ev.label} is at t ${fmt(ev.t)}, x ${fmt(ev.x)} in S and t ${fmt(inPrime.t)}, x ${fmt(inPrime.x)} in S′.`);
    view.redraw();
  }

  for (const start of STARTING_EVENTS) add(start.t, start.x);
  selectedId = events[0].id;
  const view = fitCanvas(canvas, draw);
  update();

  return () => {
    view.stop();
    root.replaceChildren();
  };
}

export const lorentzTransform: Sim = {
  id: 'lorentz',
  title: 'Lorentz Transform',
  icon: 'transform',
  blurb: 'One event, two sets of coordinates. Type an event in and follow the arithmetic that takes it from one frame to the other.',
  mount,
};
