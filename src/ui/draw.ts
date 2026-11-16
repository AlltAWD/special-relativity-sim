/**
 * Small helpers for drawing figures on a 2D canvas, so every simulation's
 * figure uses the same colours, type and marks.
 */
import { cssVars } from './theme';

/** The theme colours and fonts a figure needs, read once per frame. */
export interface Paint {
  bg: string;
  grid: string;
  axis: string;
  muted: string;
  /** Green: the moving frame S' and things riding in it. */
  prime: string;
  /** Yellow, dark enough for text and thin lines. */
  light: string;
  /** Bright yellow, for a photon itself. */
  photon: string;
  /** Blue: things at rest in S. */
  timelike: string;
  /** Red: classical ("wrong") answers, and the current-time line. */
  spacelike: string;
  ink: string;
  outline: string;
  ui: string;
  math: string;
  /** Any other custom property, such as '--cat-3'. */
  color(name: string): string;
}

export function paint(canvas: HTMLCanvasElement): Paint {
  const color = cssVars(canvas);
  return {
    bg: color('--sim-bg'),
    grid: color('--sim-grid'),
    axis: color('--sim-axis'),
    muted: color('--sim-muted'),
    prime: color('--sim-prime'),
    light: color('--sim-light'),
    photon: color('--sim-photon'),
    timelike: color('--sim-timelike'),
    spacelike: color('--sim-spacelike'),
    ink: color('--on-surface'),
    outline: color('--outline-variant'),
    ui: color('--font-ui'),
    math: color('--font-math'),
    color,
  };
}

/** Fill the canvas with the background and, optionally, graph paper. */
export function backdrop(ctx: CanvasRenderingContext2D, w: number, h: number, p: Paint, gridStep = 0) {
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, w, h);
  if (gridStep <= 0) return;
  ctx.beginPath();
  // Centred, so the pattern stays symmetric when the figure is resized.
  for (let x = (w / 2) % gridStep; x < w; x += gridStep) {
    ctx.moveTo(Math.round(x) + 0.5, 0);
    ctx.lineTo(Math.round(x) + 0.5, h);
  }
  for (let y = (h / 2) % gridStep; y < h; y += gridStep) {
    ctx.moveTo(0, Math.round(y) + 0.5);
    ctx.lineTo(w, Math.round(y) + 0.5);
  }
  ctx.lineWidth = 1;
  ctx.strokeStyle = p.grid;
  ctx.stroke();
}

export interface TextOptions {
  size?: number;
  weight?: number;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  /** Use the mathematics typeface, in italic: for a variable name. */
  math?: boolean;
  /** Draw a halo in this colour behind the text, so it stays readable over lines. */
  halo?: string;
}

/** Text in the figure's fonts. `color` is the fill. */
export function text(
  ctx: CanvasRenderingContext2D, p: Paint, label: string, x: number, y: number, color: string, opts: TextOptions = {},
) {
  const size = opts.size ?? 12;
  ctx.font = opts.math ? `italic 500 ${size}px ${p.math}` : `${opts.weight ?? 500} ${size}px ${p.ui}`;
  ctx.textAlign = opts.align ?? 'center';
  ctx.textBaseline = opts.baseline ?? 'middle';
  if (opts.halo) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = 4;
    ctx.strokeStyle = opts.halo;
    ctx.strokeText(label, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(label, x, y);
}

/** A straight arrow from (x0, y0) to (x1, y1), in the current stroke style. */
export function arrow(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, head = 7) {
  const angle = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - head * Math.cos(angle - 0.45), y1 - head * Math.sin(angle - 0.45));
  ctx.lineTo(x1 - head * Math.cos(angle + 0.45), y1 - head * Math.sin(angle + 0.45));
  ctx.closePath();
  ctx.fillStyle = ctx.strokeStyle;
  ctx.fill();
}

/**
 * A photon: a bright dot with a soft glow, and a darker rim so that it also
 * shows up on a white figure.
 */
export function photon(ctx: CanvasRenderingContext2D, p: Paint, x: number, y: number, radius = 6) {
  const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 3.2);
  glow.addColorStop(0, p.photon);
  glow.addColorStop(1, 'transparent');
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, radius * 3.2, 0, 2 * Math.PI);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = p.photon;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI);
  ctx.fill();
  ctx.lineWidth = 1.25;
  ctx.strokeStyle = p.light;
  ctx.stroke();
}

/**
 * A dimension line, as on an engineering drawing: a line from x0 to x1 at
 * height y with a tick at each end and a label above the middle.
 */
export function dimension(
  ctx: CanvasRenderingContext2D, p: Paint, x0: number, x1: number, y: number, label: string, color: string,
) {
  ctx.lineWidth = 1.25;
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.moveTo(x0, y - 5);
  ctx.lineTo(x0, y + 5);
  ctx.moveTo(x1, y - 5);
  ctx.lineTo(x1, y + 5);
  ctx.stroke();
  text(ctx, p, label, (x0 + x1) / 2, y - 11, color, { halo: p.bg });
}

/** Two decimals with a real minus sign, and never "−0.00". */
export function fmt(n: number, digits = 2): string {
  const body = Math.abs(n).toFixed(digits);
  return (n < 0 && Number(body) !== 0 ? '−' : '') + body;
}
