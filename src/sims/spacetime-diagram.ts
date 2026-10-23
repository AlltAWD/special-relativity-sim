/**
 * Minkowski diagram: the worked example of a ported simulation.
 *
 * Ported from the old SpacetimeDiagram.tsx, with three fixes:
 *  - one scale for both axes, so light lines are at exactly 45 degrees (the old
 *    dashed light-cone lines ran to the corners of a 700x500 canvas, ~35.5 degrees);
 *  - every event also shows its coordinates in S' (the old version only showed S);
 *  - no stray segment at the start of each worldline.
 */
import { boost, classifyInterval, gamma, interval, type Event2D, type IntervalKind } from '../physics/lorentz';
import { el, fitCanvas, slider, toggle } from '../ui/controls';
import type { Sim } from './types';

/** Half-width of the visible region, in light-seconds / seconds. */
const RANGE = 6;

function mount(root: HTMLElement): () => void {
  let v = 0.5;
  let showCone = true;
  let showGrid = true;
  const events: Event2D[] = [{ t: 2, x: 1 }, { t: 1, x: 3 }];

  const canvas = el('canvas', { className: 'diagram' });
  const table = el('table', { className: 'events' });
  const readout = el('p', { className: 'readout' });

  root.append(
    el('div', { className: 'controls' },
      slider({
        label: "Velocity of S'",
        min: -0.95, max: 0.95, step: 0.01, value: v,
        format: (x) => `${x.toFixed(2)} c`,
        onInput: (x) => { v = x; render(); },
      }),
      toggle('Light cone', showCone, (on) => { showCone = on; render(); }),
      toggle('Grid', showGrid, (on) => { showGrid = on; render(); }),
      el('button', { type: 'button', onclick: () => { events.length = 0; render(); } }, 'Clear events'),
    ),
    readout,
    canvas,
    el('p', { className: 'hint' }, 'Click the diagram to place an event. Its interval is measured from the origin.'),
    table,
  );

  // World (x, t) <-> canvas pixels. One scale for both axes keeps light at 45 degrees.
  const view = () => {
    const scale = Math.min(canvas.width, canvas.height) / (2 * RANGE);
    return { scale, cx: canvas.width / 2, cy: canvas.height / 2 };
  };
  const toScreen = (x: number, t: number): [number, number] => {
    const { scale, cx, cy } = view();
    return [cx + x * scale, cy - t * scale];
  };

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (canvas.width / rect.width);
    const py = (e.clientY - rect.top) * (canvas.height / rect.height);
    const { scale, cx, cy } = view();
    const round = (n: number) => Math.round(n * 10) / 10;
    events.push({ x: round((px - cx) / scale), t: round((cy - py) / scale) });
    render();
  });

  function render() {
    draw();
    readout.textContent = `γ = ${gamma(v).toFixed(3)}. The t' axis is the worldline x = vt; the x' axis is the line of simultaneity t = vx.`;
    renderTable();
  }

  function draw() {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const css = getComputedStyle(canvas);
    const color = (name: string) => css.getPropertyValue(name).trim();
    const ratio = window.devicePixelRatio || 1;
    const { scale } = view();
    const far = 2 * RANGE * Math.max(canvas.width, canvas.height) / Math.min(canvas.width, canvas.height);

    const line = (x0: number, t0: number, x1: number, t1: number) => {
      ctx.beginPath();
      ctx.moveTo(...toScreen(x0, t0));
      ctx.lineTo(...toScreen(x1, t1));
      ctx.stroke();
    };

    ctx.fillStyle = color('--sim-bg');
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = ratio;

    if (showGrid) {
      ctx.strokeStyle = color('--sim-grid');
      for (let k = -Math.ceil(far); k <= Math.ceil(far); k++) {
        line(k, -far, k, far);
        line(-far, k, far, k);
      }
    }

    if (showCone) {
      ctx.fillStyle = color('--sim-cone');
      for (const sign of [1, -1]) {
        ctx.beginPath();
        ctx.moveTo(...toScreen(0, 0));
        ctx.lineTo(...toScreen(far, sign * far));
        ctx.lineTo(...toScreen(-far, sign * far));
        ctx.closePath();
        ctx.fill();
      }
      ctx.strokeStyle = color('--sim-light');
      ctx.setLineDash([6 * ratio, 6 * ratio]);
      line(-far, -far, far, far);
      line(-far, far, far, -far);
      ctx.setLineDash([]);
    }

    // S axes, then S' axes: t' is x = v t, x' is t = v x.
    ctx.lineWidth = 2 * ratio;
    ctx.strokeStyle = color('--sim-axis');
    line(-far, 0, far, 0);
    line(0, -far, 0, far);
    ctx.strokeStyle = color('--sim-prime');
    line(-v * far, -far, v * far, far);
    line(-far, -v * far, far, v * far);

    ctx.font = `${13 * ratio}px system-ui, sans-serif`;
    ctx.fillStyle = color('--sim-axis');
    ctx.fillText('x', ...toScreen(RANGE - 0.4, 0.2));
    ctx.fillText('t', ...toScreen(0.2, RANGE - 0.4));
    ctx.fillStyle = color('--sim-prime');
    ctx.fillText("t'", ...toScreen(v * (RANGE - 0.8) + 0.2, RANGE - 0.8));
    ctx.fillText("x'", ...toScreen(RANGE - 0.8, v * (RANGE - 0.8) + 0.2));

    for (const ev of events) {
      const kind = classifyInterval(interval(ev.t, ev.x));
      ctx.fillStyle = color(`--sim-${kind}`);
      ctx.beginPath();
      ctx.arc(...toScreen(ev.x, ev.t), 0.12 * scale, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  function renderTable() {
    const fmt = (n: number) => n.toFixed(2);
    const head = el('tr', {}, ...['(t, x) in S', "(t', x') in S'", 's²', 'Separation'].map((h) => el('th', {}, h)));
    const rows = events.map((ev) => {
      const p = boost(ev, v);
      const s2 = interval(ev.t, ev.x);
      const kind: IntervalKind = classifyInterval(s2);
      return el('tr', {},
        el('td', {}, `(${fmt(ev.t)}, ${fmt(ev.x)})`),
        el('td', {}, `(${fmt(p.t)}, ${fmt(p.x)})`),
        el('td', {}, fmt(s2)),
        el('td', { className: kind }, kind),
      );
    });
    table.replaceChildren(head, ...rows);
  }

  const stopFitting = fitCanvas(canvas, draw);
  render();

  return () => {
    stopFitting();
    root.replaceChildren();
  };
}

export const spacetimeDiagram: Sim = {
  id: 'spacetime',
  title: 'Spacetime Diagram',
  blurb: "Minkowski diagram with the light cone and a second frame S'. Click to place events and compare their coordinates in both frames.",
  mount,
};
