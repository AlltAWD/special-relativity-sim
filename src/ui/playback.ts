/**
 * Play, pause and reset for an animated simulation.
 *
 * The simulation owns its clock: playback only calls `onStep(dt)` once per
 * frame while playing, with the real time that has passed, and the simulation
 * decides what that does to its state.
 */
import { button, el, icon } from './controls';

export interface PlaybackOptions {
  /** Advance the simulation by `dt` seconds of real time, then redraw. */
  onStep(dt: number): void;
  /** Put the simulation back to its starting state, then redraw. */
  onReset(): void;
  /**
   * Start playing straight away. Defaults to true, except for visitors who
   * have asked their system for reduced motion: they start paused.
   */
  autoplay?: boolean;
  /** Extra buttons before and after play / pause (step back, step forward). */
  before?: HTMLElement[];
  after?: HTMLElement[];
}

export interface Playback {
  /** The buttons, to put in a figure's toolbar or a panel group. */
  el: HTMLElement;
  readonly playing: boolean;
  play(): void;
  pause(): void;
  /** Stop for good. Call this from the function `mount` returns. */
  stop(): void;
}

export function playback(opts: PlaybackOptions): Playback {
  let playing = false;
  let frame = 0;
  let last = 0;

  const toggleButton = button('Play', () => (playing ? pause() : play()), {
    icon: 'play_arrow', iconOnly: true, variant: 'tonal',
  });
  const resetButton = button('Reset', () => opts.onReset(), { icon: 'restart_alt', iconOnly: true });

  const showState = () => {
    const label = playing ? 'Pause' : 'Play';
    toggleButton.replaceChildren(icon(playing ? 'pause' : 'play_arrow'));
    toggleButton.setAttribute('aria-label', label);
    toggleButton.title = label;
  };

  const tick = (now: number) => {
    // After the tab has been in the background, `now - last` can be many
    // seconds. Cap it so the simulation does not leap forward. (The cap is
    // generous, so a slow device that manages four frames a second still
    // keeps real time.)
    const dt = Math.min((now - last) / 1000, 0.25);
    last = now;
    opts.onStep(dt);
    if (playing) frame = requestAnimationFrame(tick);
  };

  function play() {
    if (playing) return;
    playing = true;
    last = performance.now();
    frame = requestAnimationFrame(tick);
    showState();
  }

  function pause() {
    if (!playing) return;
    playing = false;
    cancelAnimationFrame(frame);
    showState();
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if ((opts.autoplay ?? true) && !reducedMotion) play();

  return {
    el: el('div', { className: 'actions' }, ...(opts.before ?? []), toggleButton, ...(opts.after ?? []), resetButton),
    get playing() {
      return playing;
    },
    play,
    pause,
    stop() {
      playing = false;
      cancelAnimationFrame(frame);
    },
  };
}
