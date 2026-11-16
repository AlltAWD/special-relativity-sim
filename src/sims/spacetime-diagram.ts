/**
 * Minkowski diagram: the worked example of a ported simulation.
 *
 * Ported from the old SpacetimeDiagram.tsx, with three fixes:
 *  - one scale for both axes, so light lines are at exactly 45 degrees (the old
 *    dashed light-cone lines ran to the corners of a 700x500 canvas, ~35.5 degrees);
 *  - every event also shows its coordinates in S' (the old version only showed S);
 *  - no stray segment at the start of each worldline.
 *
 * How it is put together, as a pattern for the other simulations:
 *  - the state is a handful of `let` variables at the top of mount();
 *  - draw() paints the canvas from that state, and nothing else touches the canvas;
 *  - update() is called after every change and refreshes the readouts, the table
 *    and the canvas;
 *  - every number shown comes from physics/lorentz.ts.
 */
import { boost, classifyInterval, gamma, interval, unboost, type Event2D, type IntervalKind } from '../physics/lorentz';
import { button, el, fitCanvas, iconButton, slider, swatch, toggle } from '../ui/controls';
import { bench, defs, group, legend, math, note, srOnly, stat, stats } from '../ui/layout';
import { cssVars } from '../ui/theme';
import type { Sim } from './types';

/** Half-height of the visible region, in seconds. A wide figure shows more than this in x. */
const RANGE = 6;

/** An event the visitor has placed. The id never changes; the label is what they see. */
interface Marked extends Event2D {
  id: number;
  label: string;
}

/** Where "Add event" puts events, in order. The first three show one interval of each kind. */
const SPOTS: [t: number, x: number][] = [[2, 1], [1, 3], [3, -3], [-2, -1], [4, 2], [-1, -4], [-3, 2], [2, -2]];

const ARROWS: Record<string, [dt: number, dx: number]> = {
  ArrowUp: [1, 0],
  ArrowDown: [-1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

/** 0 -> A, 25 -> Z, 26 -> AA: spreadsheet column names. */
function labelFor(index: number): string {
  let label = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    label = String.fromCharCode(65 + ((n - 1) % 26)) + label;
  }
  return label;
}

/** Two decimals with a real minus sign, and never "-0.00". */
function fmt(n: number): string {
  const digits = Math.abs(n).toFixed(2);
  return (n < 0 && Number(digits) !== 0 ? '−' : '') + digits;
}

const snap = (n: number) => Math.round(n * 10) / 10;

// Each kind of interval has its own shape as well as its own colour, so the
// three can be told apart without relying on colour vision.
const MARKERS: Record<IntervalKind, string> = {
  timelike: '<circle cx="6" cy="6" r="5" fill="currentColor"/>',
  spacelike: '<path d="M6 0 12 6 6 12 0 6z" fill="currentColor"/>',
  lightlike: '<circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" stroke-width="2.2"/>',
};

function markerIcon(kind: IntervalKind): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 12 12');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('marker');
  svg.dataset.tone = kind;
  svg.innerHTML = MARKERS[kind];
  return svg;
}

/** The same three shapes, on the canvas. */
function drawMarker(ctx: CanvasRenderingContext2D, kind: IntervalKind, px: number, py: number, fill: string, bg: string) {
  ctx.beginPath();
  if (kind === 'spacelike') {
    ctx.moveTo(px, py - 7);
    ctx.lineTo(px + 7, py);
    ctx.lineTo(px, py + 7);
    ctx.lineTo(px - 7, py);
    ctx.closePath();
  } else {
    ctx.arc(px, py, kind === 'lightlike' ? 4.75 : 5.5, 0, 2 * Math.PI);
  }
  // A thin outline in the background colour keeps the marker clear of the lines under it.
  ctx.lineWidth = kind === 'lightlike' ? 5.5 : 3;
  ctx.strokeStyle = bg;
  ctx.stroke();
  if (kind === 'lightlike') {
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = fill;
    ctx.stroke();
  } else {
    ctx.fillStyle = fill;
    ctx.fill();
  }
}

function mount(root: HTMLElement): () => void {
  // ---------- State ----------
  let v = 0.5;
  let showCone = true;
  let showGrid = true;
  let events: Marked[] = [];
  let created = 0; // events made so far; names the next one
  let hoverId: number | null = null; // under the pointer, on the diagram or in the table
  let focusId: number | null = null; // its table row has keyboard focus
  let dragId: number | null = null; // being dragged on the diagram
  let pointer: Event2D | null = null; // where a click would land
  let press: { x: number; y: number } | null = null; // where a press on empty space began

  const kindOf = (ev: Event2D): IntervalKind => classifyInterval(interval(ev.t, ev.x));
  const byId = (id: number | null) => events.find((ev) => ev.id === id);
  /** The event being pointed at, moved or edited: it is highlighted in both the diagram and the table. */
  const activeId = () => dragId ?? hoverId ?? focusId;

  // ---------- Elements ----------
  const canvas = el('canvas');
  canvas.setAttribute('role', 'img');

  // Coordinates under the pointer, in both frames.
  const probeName = el('span', { className: 'probe-name' });
  const probeCells = [el('span'), el('span'), el('span', { className: 'is-prime' }), el('span', { className: 'is-prime' })];
  const probe = el('div', { className: 'probe', hidden: true },
    probeName,
    el('span', { className: 'probe-head' }, math('t')),
    el('span', { className: 'probe-head' }, math('x')),
    math('S'), probeCells[0], probeCells[1],
    el('span', { className: 'is-prime' }, math('S′')), probeCells[2], probeCells[3],
  );
  probe.setAttribute('aria-hidden', 'true'); // the table carries the same numbers

  const gammaStat = stat(math('γ = 1 / √(1 − v²)'));

  const axes = defs(
    [el('span', {}, math('t′'), ' axis'), el('span', {}, math('x = vt'), ', where the origin of S′ travels')],
    [el('span', {}, math('x′'), ' axis'), el('span', {}, math('t = vx'), ', everything S′ calls “now” at ', math('t′ = 0'))],
  );
  axes.dataset.tone = 'prime';

  const columns = [
    { head: 't', className: '' },
    { head: 'x', className: '' },
    { head: 't′', className: 'is-prime starts-block' },
    { head: 'x′', className: 'is-prime' },
    { head: 's²', className: 'starts-block' },
  ];
  const tbody = el('tbody');
  const table = el('table', { className: 'table' },
    el('thead', {}, el('tr', {},
      el('th', { scope: 'col' }, srOnly('Event')),
      ...columns.map((col) => el('th', { scope: 'col', className: col.className }, math(col.head))),
      el('th', { scope: 'col' }, srOnly('Remove')),
    )),
    tbody,
  );
  const empty = note('No events yet. Click the diagram to place one.');

  const addButton = button('Add event', () => {
    const [t, x] = SPOTS.find(([st, sx]) => !events.some((ev) => ev.t === st && ev.x === sx))
      ?? [snap(Math.random() * 8 - 4), snap(Math.random() * 8 - 4)];
    const ev = add(t, x);
    update();
    rows.get(ev.id)?.chip.focus(); // ready to be nudged with the arrow keys
  }, { icon: 'add', small: true, variant: 'tonal' });

  const clearButton = button('Clear', () => {
    events = [];
    created = 0;
    hoverId = focusId = dragId = null;
    update();
    addButton.focus();
  }, { small: true, variant: 'text' });

  root.append(bench({
    figure: [canvas, probe],
    caption: [
      'Click or tap to place an event; drag one to move it. Each interval ',
      math('s² = t² − x²'),
      ' is measured from the origin. With time in seconds and distance in light-seconds, light travels at 45°.',
    ],
    panel: [
      group([swatch('line', 'prime'), 'Frame ', math('S′')],
        slider({
          label: 'Velocity of S′',
          min: -0.95, max: 0.95, step: 0.01, value: v,
          format: (x) => `${fmt(x)} c`,
          onInput: (x) => { v = x; update(); },
          tone: 'prime',
          marks: [-0.8, -0.6, 0, 0.6, 0.8],
        }),
        stats(gammaStat),
      ),
      group({ title: ['Events'], aside: [addButton, clearButton] }, el('div', { className: 'table-wrap' }, table), empty),
      group('Show',
        toggle('Light cone', showCone, (on) => { showCone = on; update(); }, { swatch: 'dashed', tone: 'light' }),
        toggle('Grid', showGrid, (on) => { showGrid = on; update(); }, { swatch: 'grid' }),
      ),
      // The things you operate come first; the explanations go last, where a
      // short window scrolls them out of the way.
      group('Key',
        legend(
          [markerIcon('timelike'), 'Timelike, ', math('s² > 0'), ': inside the light cone'],
          [markerIcon('lightlike'), 'Lightlike, ', math('s² = 0'), ': on it'],
          [markerIcon('spacelike'), 'Spacelike, ', math('s² < 0'), ': outside it'],
        ),
        axes,
      ),
    ],
  }));

  // ---------- Geometry: world (x, t) <-> canvas pixels ----------

  // One scale for both axes keeps light at 45 degrees.
  const geometry = () => {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    const scale = Math.min(w, h) / (2 * RANGE);
    return { w, h, scale, cx: w / 2, cy: h / 2, xMax: w / 2 / scale, tMax: h / 2 / scale };
  };

  const toLocal = (at: { clientX: number; clientY: number }) => {
    const rect = canvas.getBoundingClientRect();
    return { px: at.clientX - rect.left, py: at.clientY - rect.top };
  };

  const toWorld = (px: number, py: number): Event2D => {
    const { scale, cx, cy } = geometry();
    return { t: (cy - py) / scale, x: (px - cx) / scale };
  };

  /** Snap to the 0.1 grid and stay inside the figure. */
  const place = (t: number, x: number): Event2D => {
    const { xMax, tMax } = geometry();
    const within = (n: number, max: number) => Math.max(-max, Math.min(max, n));
    return { t: snap(within(t, Math.floor(tMax * 10) / 10)), x: snap(within(x, Math.floor(xMax * 10) / 10)) };
  };

  /** The event within `reach` pixels of a point, if any. Later events are drawn on top, so they win ties. */
  const hit = (px: number, py: number, reach: number): Marked | undefined => {
    const { scale, cx, cy } = geometry();
    let nearest: Marked | undefined;
    let distance = reach;
    for (const ev of events) {
      const d = Math.hypot(cx + ev.x * scale - px, cy - ev.t * scale - py);
      if (d <= distance) {
        nearest = ev;
        distance = d;
      }
    }
    return nearest;
  };

  /** A fingertip is less precise than a mouse. */
  const reachOf = (e: PointerEvent) => (e.pointerType === 'touch' ? 24 : 11);

  // ---------- Changing the events ----------

  function add(t: number, x: number): Marked {
    const ev: Marked = { ...place(t, x), id: created, label: labelFor(created) };
    created++;
    events.push(ev);
    return ev;
  }

  function remove(id: number) {
    events = events.filter((ev) => ev.id !== id);
    if (hoverId === id) hoverId = null;
    if (focusId === id) focusId = null;
    if (dragId === id) dragId = null;
  }

  // ---------- Pointer: hover, click to place, drag to move ----------

  canvas.addEventListener('pointermove', (e) => {
    const { px, py } = toLocal(e);
    const world = toWorld(px, py);
    if (dragId !== null) {
      const ev = byId(dragId);
      if (ev) Object.assign(ev, place(world.t, world.x));
      update();
      return;
    }
    if (e.pointerType === 'touch') return; // a finger does not hover
    hoverId = hit(px, py, reachOf(e))?.id ?? null;
    pointer = place(world.t, world.x);
    canvas.style.cursor = hoverId === null ? 'crosshair' : 'grab';
    highlight();
  });

  canvas.addEventListener('pointerleave', () => {
    if (dragId !== null) return;
    hoverId = null;
    pointer = null;
    highlight();
  });

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const { px, py } = toLocal(e);
    const target = hit(px, py, reachOf(e));
    if (target) {
      dragId = hoverId = target.id;
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
      highlight();
    } else {
      press = { x: e.clientX, y: e.clientY };
    }
  });

  canvas.addEventListener('pointerup', (e) => {
    if (dragId !== null) {
      dragId = null;
      canvas.style.cursor = 'grab';
    } else if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 6) {
      // A press that did not move is a click: place an event there.
      const { px, py } = toLocal(e);
      const world = toWorld(px, py);
      hoverId = add(world.t, world.x).id;
      canvas.style.cursor = 'grab';
    }
    press = null;
    if (e.pointerType === 'touch') {
      hoverId = null;
      pointer = null;
    }
    update();
  });

  canvas.addEventListener('pointercancel', () => {
    dragId = hoverId = null;
    pointer = press = null;
    update();
  });

  // On a touch screen, dragging on the diagram scrolls the page as usual,
  // unless the drag starts on an event: then it moves the event.
  canvas.addEventListener('touchstart', (e) => {
    const { px, py } = toLocal(e.touches[0]);
    if (hit(px, py, 24)) e.preventDefault();
  }, { passive: false });

  // ---------- Events table ----------

  interface Row {
    tr: HTMLTableRowElement;
    chip: HTMLButtonElement;
    cells: HTMLTableCellElement[];
    kind: IntervalKind | null;
  }
  const rows = new Map<number, Row>();
  let rowsFor = ''; // the ids the table was last built for

  function makeRow(ev: Marked): HTMLTableRowElement {
    const chip = el('button', { type: 'button', className: 'event-chip' });
    const cells = columns.map((col) => el('td', { className: col.className }));
    const removeButton = iconButton(`Remove event ${ev.label}`, 'close', () => removeAndRefocus(), true);
    const tr = el('tr', {}, el('th', { scope: 'row' }, chip), ...cells, el('td', {}, removeButton));

    const removeAndRefocus = () => {
      const index = events.indexOf(ev);
      remove(ev.id);
      update();
      // Keep the keyboard where it was: the next row, else the previous one, else the Add button.
      const neighbour = events[index] ?? events[index - 1];
      (neighbour ? rows.get(neighbour.id)?.chip : addButton)?.focus();
    };

    tr.addEventListener('pointerenter', () => { hoverId = ev.id; highlight(); });
    tr.addEventListener('pointerleave', () => {
      if (hoverId === ev.id) hoverId = null;
      highlight();
    });
    chip.addEventListener('focus', () => { focusId = ev.id; highlight(); });
    chip.addEventListener('blur', () => {
      if (focusId === ev.id) focusId = null;
      highlight();
    });
    chip.addEventListener('keydown', (e) => {
      const arrow = ARROWS[e.key];
      if (arrow) {
        e.preventDefault();
        const step = e.shiftKey ? 1 : 0.1;
        Object.assign(ev, place(ev.t + arrow[0] * step, ev.x + arrow[1] * step));
        update();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeAndRefocus();
      }
    });

    rows.set(ev.id, { tr, chip, cells, kind: null });
    return tr;
  }

  function syncTable() {
    // Rebuild the rows only when events are added or removed. While an event is
    // dragged or nudged its row is updated in place, so it keeps keyboard focus.
    const ids = events.map((ev) => ev.id).join(',');
    if (ids !== rowsFor) {
      rowsFor = ids;
      rows.clear();
      tbody.replaceChildren(...events.map(makeRow));
      table.hidden = events.length === 0;
      empty.hidden = events.length > 0;
      clearButton.disabled = events.length === 0;
    }
    for (const ev of events) {
      const row = rows.get(ev.id)!;
      const inPrime = boost(ev, v);
      const s2 = interval(ev.t, ev.x);
      const kind = classifyInterval(s2);
      [ev.t, ev.x, inPrime.t, inPrime.x, s2].forEach((value, i) => { row.cells[i].textContent = fmt(value); });
      if (row.kind !== kind) {
        row.kind = kind;
        row.chip.replaceChildren(markerIcon(kind), ev.label);
        row.chip.setAttribute('aria-label', `Event ${ev.label}, ${kind}. Arrow keys move it, Delete removes it.`);
      }
    }
  }

  // ---------- Keeping everything in step ----------

  /** After any change to the state: refresh every readout and redraw. */
  function update() {
    gammaStat.set(gamma(v).toFixed(3));
    syncTable();
    const list = events.map((ev) => `${ev.label} ${kindOf(ev)}`).join(', ');
    canvas.setAttribute('aria-label',
      `Minkowski diagram. Frame S′ moves at ${v.toFixed(2)} c. ` + (list ? `Events: ${list}.` : 'No events.'));
    highlight();
  }

  /** After only the pointer or the focus moved: cheaper than update(). */
  function highlight() {
    const active = activeId();
    for (const [id, row] of rows) row.tr.classList.toggle('is-active', id === active);

    const ev = byId(dragId ?? hoverId);
    const at = ev ?? pointer;
    probe.hidden = !at;
    if (at) {
      const inPrime = boost(at, v);
      probeName.textContent = ev?.label ?? '';
      [at.t, at.x, inPrime.t, inPrime.x].forEach((value, i) => { probeCells[i].textContent = fmt(value); });
      // Keep the readout out from under the pointer.
      const { scale, cx, cy } = geometry();
      const nearCorner = cx + at.x * scale < 210 && cy - at.t * scale < 110;
      probe.dataset.side = nearCorner ? 'right' : 'left';
    }
    view.redraw();
  }

  // ---------- Drawing ----------

  function draw(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const { scale, cx, cy, xMax, tMax } = geometry();
    const color = cssVars(canvas);
    const bg = color('--sim-bg');
    const axis = color('--sim-axis');
    const prime = color('--sim-prime');
    const uiFont = color('--font-ui');
    const mathFont = color('--font-math');

    const X = (x: number) => cx + x * scale;
    const Y = (t: number) => cy - t * scale;
    const far = xMax + tMax + 2; // past every edge of the figure

    const line = (x0: number, t0: number, x1: number, t1: number) => {
      ctx.beginPath();
      ctx.moveTo(X(x0), Y(t0));
      ctx.lineTo(X(x1), Y(t1));
      ctx.stroke();
    };
    /** Text with a halo in the background colour, so it stays readable over lines. */
    const text = (label: string, px: number, py: number) => {
      ctx.lineJoin = 'round';
      ctx.lineWidth = 4;
      ctx.strokeStyle = bg;
      ctx.strokeText(label, px, py);
      ctx.fillText(label, px, py);
    };

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    if (showGrid) {
      // Half-pixel positions keep one-pixel lines sharp.
      ctx.beginPath();
      for (let k = -Math.floor(xMax); k <= Math.floor(xMax); k++) {
        const px = Math.round(X(k)) + 0.5;
        ctx.moveTo(px, 0);
        ctx.lineTo(px, h);
      }
      for (let k = -Math.floor(tMax); k <= Math.floor(tMax); k++) {
        const py = Math.round(Y(k)) + 0.5;
        ctx.moveTo(0, py);
        ctx.lineTo(w, py);
      }
      ctx.lineWidth = 1;
      ctx.strokeStyle = color('--sim-grid');
      ctx.stroke();
    }

    if (showCone) {
      // Future and past of the origin.
      ctx.fillStyle = color('--sim-cone');
      for (const sign of [1, -1]) {
        ctx.beginPath();
        ctx.moveTo(X(0), Y(0));
        ctx.lineTo(X(far), Y(sign * far));
        ctx.lineTo(X(-far), Y(sign * far));
        ctx.closePath();
        ctx.fill();
      }
      ctx.lineWidth = 1.25;
      ctx.strokeStyle = color('--sim-light');
      ctx.setLineDash([5, 4]);
      line(-far, -far, far, far);
      line(-far, far, far, -far);
      ctx.setLineDash([]);
    }

    // S axes, with a tick every unit and a number every two.
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = axis;
    line(-far, 0, far, 0);
    line(0, -far, 0, far);
    ctx.beginPath();
    for (let k = -Math.floor(far); k <= Math.floor(far); k++) {
      if (k === 0) continue;
      ctx.moveTo(Math.round(X(k)) + 0.5, Y(0) - 3.5);
      ctx.lineTo(Math.round(X(k)) + 0.5, Y(0) + 3.5);
      ctx.moveTo(X(0) - 3.5, Math.round(Y(k)) + 0.5);
      ctx.lineTo(X(0) + 3.5, Math.round(Y(k)) + 0.5);
    }
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = `500 11px ${uiFont}`;
    ctx.fillStyle = color('--sim-muted');
    for (let k = -2 * Math.floor(far / 2); k <= far; k += 2) {
      if (k === 0) continue;
      const label = String(k).replace('-', '−');
      if (X(k) > 14 && X(k) < w - 30) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        text(label, X(k), Y(0) + 7);
      }
      if (Y(k) > 28 && Y(k) < h - 10) {
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        text(label, X(0) - 8, Y(k));
      }
    }

    // S' axes: t' is the line x = v t, and x' is the line t = v x.
    ctx.lineWidth = 1.75;
    ctx.strokeStyle = prime;
    line(-v * far, -far, v * far, far);
    line(-far, -v * far, far, v * far);

    // One tick per unit of t' and of x'. unboost() says where S puts them: the
    // tick t' = 1 sits at height t = gamma, which is time dilation drawn to
    // scale. Each tick is drawn parallel to the other primed axis, like a short
    // piece of the S' coordinate grid.
    const tilt = Math.hypot(1, v);
    ctx.beginPath();
    for (let k = -Math.floor(far); k <= Math.floor(far); k++) {
      if (k === 0) continue;
      const onT = unboost({ t: k, x: 0 }, v);
      const onX = unboost({ t: 0, x: k }, v);
      ctx.moveTo(X(onT.x) - 4 / tilt, Y(onT.t) + (4 * v) / tilt);
      ctx.lineTo(X(onT.x) + 4 / tilt, Y(onT.t) - (4 * v) / tilt);
      ctx.moveTo(X(onX.x) - (4 * v) / tilt, Y(onX.t) + 4 / tilt);
      ctx.lineTo(X(onX.x) + (4 * v) / tilt, Y(onX.t) - 4 / tilt);
    }
    ctx.lineWidth = 1.25;
    ctx.stroke();

    // Axis names. The S names sit on the side away from the S' axes, and swap
    // sides with the sign of v, so the two sets never collide.
    const side = v >= 0 ? 1 : -1;
    const slope = Math.max(Math.abs(v), 1e-6);
    const inset = 0.8;
    ctx.font = `italic 500 17px ${mathFont}`;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = axis;
    ctx.textAlign = 'right';
    text('x', w - 10, Y(0) + side * 14);
    ctx.textAlign = side > 0 ? 'right' : 'left';
    text('t', X(0) - side * 9, 14);
    ctx.fillStyle = prime;
    const xEnd = Math.min(xMax - inset, (tMax - inset) / slope); // where the x' axis nears an edge
    const tEnd = Math.min(tMax - inset, (xMax - inset) / slope); // and the t' axis
    ctx.textAlign = 'right';
    text('x′', X(xEnd), Y(v * xEnd) - side * 14);
    ctx.textAlign = side > 0 ? 'left' : 'right';
    text('t′', X(v * tEnd) + side * 10, Y(tEnd));

    // The origin: the event every interval is measured from.
    ctx.fillStyle = axis;
    ctx.beginPath();
    ctx.arc(X(0), Y(0), 2.75, 0, 2 * Math.PI);
    ctx.fill();

    // Where a click would place an event.
    if (pointer && hoverId === null && dragId === null) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = color('--sim-muted');
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.arc(X(pointer.x), Y(pointer.t), 5.5, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // For the active event, the interval itself: the segment from the origin.
    const active = byId(activeId());
    if (active) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = color(`--sim-${kindOf(active)}`);
      ctx.globalAlpha = 0.6;
      line(0, 0, active.x, active.t);
      ctx.globalAlpha = 1;
    }

    for (const ev of events) {
      const kind = kindOf(ev);
      const fill = color(`--sim-${kind}`);
      const px = X(ev.x);
      const py = Y(ev.t);
      if (ev === active) {
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = fill;
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        ctx.arc(px, py, 12.5, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      drawMarker(ctx, kind, px, py, fill, bg);

      // Its name, up and to the right unless that would leave the figure.
      const flipX = px > w - 34;
      const flipY = py < 26;
      ctx.font = `600 12.5px ${uiFont}`;
      ctx.fillStyle = axis;
      ctx.textAlign = flipX ? 'right' : 'left';
      ctx.textBaseline = 'middle';
      text(ev.label, px + (flipX ? -11 : 11), py + (flipY ? 13 : -11));
    }
  }

  // ---------- Start ----------

  for (const [t, x] of SPOTS.slice(0, 3)) add(t, x);
  const view = fitCanvas(canvas, draw);
  update();

  return () => {
    view.stop();
    root.replaceChildren();
  };
}

export const spacetimeDiagram: Sim = {
  id: 'spacetime',
  title: 'Spacetime Diagram',
  icon: 'timeline',
  blurb: 'A Minkowski diagram with the light cone and a second frame, S′, moving at the speed you choose. Place events and compare their coordinates in both frames.',
  mount,
};
