# Special Relativity Simulator

**Live:** https://alltawd.github.io/special-relativity-sim/

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshot-dark.png" />
  <img src="docs/screenshot-light.png" alt="The Spacetime Diagram: a Minkowski diagram beside a panel with the velocity of the moving frame and a table of events in both frames" />
</picture>

Interactive simulations of special relativity in the browser, in natural units
(c = 1). Plain TypeScript with Vite, Canvas 2D for diagrams and three.js for 3D
scenes. No framework, no server.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # physics unit tests (Vitest)
npm run build    # type-check + production build into dist/
```

## Structure

```
src/
├── physics/
│   ├── lorentz.ts         pure functions: gamma, boost, interval, velocity addition, twin paradox…
│   └── lorentz.test.ts    unit tests: the physics is checked before anything is drawn
├── sims/
│   ├── types.ts           the Sim interface: { id, title, blurb, mount(root) => cleanup }
│   ├── index.ts           the list of simulations, and the placeholder for unported ones
│   ├── spacetime-diagram.ts   a complete simulation (worked example)
│   └── kit.ts             every control on one page (#kit, in `npm run dev` only)
├── ui/
│   ├── controls.ts        slider, toggle, button, segmented, icons, canvas sizing
│   ├── layout.ts          the workbench (figure + panel), groups, readouts, typeset math
│   └── theme.ts           light / dark, and theme colours for canvases
├── styles/
│   ├── tokens.css         every colour and font, for both themes
│   ├── shell.css          page layout and navigation
│   ├── kit.css            the workbench and every control
│   └── fonts.css          STIX Two Text, self-hosted
└── main.ts                navigation + hash routing (#spacetime, #twin, …)
```

**Rule:** all physics goes in `src/physics/` with a test. A simulation only reads
numbers from there and draws them.

## Design

One rule runs through the interface: **the chrome is neutral, and colour means
physics.** Navigation, buttons and text use only ink and paper. A colour appears
only where it stands for something in the simulation:

| Colour | Token | Stands for |
| --- | --- | --- |
| green | `--sim-prime` | the moving frame S′ |
| gold | `--sim-light` | light |
| blue, rose, gold | `--sim-timelike`, `--sim-spacelike`, `--sim-lightlike` | the three kinds of interval |

A control takes the colour of what it controls (`tone: 'prime'` makes a slider
green), so the panel doubles as the legend for the figure. Things that differ in
colour also differ in shape or label, so nothing depends on colour vision alone.

Every colour is defined once, in `styles/tokens.css`, for the light and the dark
theme. Headings and anything mathematical are set in STIX Two Text, the typeface
physics journals use; `math('t′ = γ(t − vx)')` italicises the variables and leaves
numbers and operators upright, as a textbook does.

Each simulation sits in a **workbench**: the figure with a panel beside it, sized
to the window so that a control, the figure and the numbers it changes are all on
screen at once. On a phone the panel moves under the figure.

## Building a simulation's interface

`npm run dev`, then open http://localhost:5173/#kit to see every control and the
call that makes it. A simulation is put together like this:

```ts
import { gamma } from '../physics/lorentz';
import { el, fitCanvas, slider } from '../ui/controls';
import { bench, group, math, stat, stats } from '../ui/layout';
import { cssVars } from '../ui/theme';
import type { Sim } from './types';

function mount(root: HTMLElement): () => void {
  let v = 0.6; // state: plain variables

  const canvas = el('canvas');
  const gammaStat = stat(math('γ'));

  root.append(bench({
    figure: [canvas],
    caption: ['What the figure shows, how to use it, and its units.'],
    panel: [
      group('Motion',
        slider({
          label: 'Velocity', min: 0, max: 0.99, step: 0.01, value: v, tone: 'prime',
          format: (x) => `${x.toFixed(2)} c`,
          onInput: (x) => { v = x; update(); },
        }),
        stats(gammaStat),
      ),
    ],
  }));

  // Sizes are in CSS pixels. Runs again on resize, theme change and font load.
  function draw(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const color = cssVars(canvas); // theme colours, read fresh each frame
    ctx.fillStyle = color('--sim-bg');
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = color('--sim-prime');
    // ...
  }

  // Call after every change to the state.
  function update() {
    gammaStat.set(gamma(v).toFixed(3));
    view.redraw();
  }

  const view = fitCanvas(canvas, draw);
  update();

  return () => {
    view.stop();
    root.replaceChildren();
  };
}

export const example: Sim = { id: 'example', title: 'Example', blurb: 'One line about it.', mount };
```

Also in `ui/`: `toggle`, `button` (with play / pause / reset icons), `segmented`
(a 2D / 3D switch), `row`, `defs`, `legend`, `frac` and `formula`.

## Porting checklist

The original version (Next.js + React) is in `~/special-relativity-simulator`.
Port one simulation at a time:

- [x] Spacetime Diagram (`spacetime-diagram.ts`)
- [ ] Velocity Addition
- [ ] Lorentz Transform
- [ ] Time Dilation
- [ ] Length Contraction
- [ ] Twin Paradox: use the new `twinParadox({ distance, vOut, vBack })`
- [ ] Highway View

For each one:
1. Create `src/sims/<name>.ts` exporting a `Sim`, and replace its `notPorted(...)`
   entry in `sims/index.ts`. The "Soon" tag in the navigation goes away with it.
2. Move any formula it needs into `physics/lorentz.ts` and **write its test first**.
3. Build the interface from `ui/` as above. React `useState` becomes plain `let`
   variables plus an `update()` function. `useEffect` cleanup becomes the function
   `mount` returns (stop `requestAnimationFrame` loops, dispose three.js renderers
   and geometries, remove listeners).
4. Check it in both themes (the toggle is at the top of the page) and at phone
   width, then commit.

## Known issues fixed from the original

- Twin paradox split Earth time evenly between the legs, which is wrong when the
  outbound and return speeds differ (test: 3 ly at 0.6c out, 0.8c back → 6.25 y aboard, not 6.125).
- The Minkowski diagram's dashed light-cone lines were drawn to the corners of a
  700×500 canvas (≈35.5°, not 45°).
- 30 type errors were hidden by `ignoreBuildErrors: true`. This build runs `tsc` in strict mode.

## Ideas worth more than a port

- **Frame switching in Highway View.** The original only shows the ground frame, so the
  relativity of simultaneity never appears. Let the user pick any object as the rest
  frame and `boost` every clock and position into it: clocks synchronized in one frame
  read different times in the other.
- **What you would actually see.** Include light-travel delay (and, in 3D, Terrell
  rotation) as a toggle next to the "measured" picture.
- **Spacetime Diagram:** draw lines of simultaneity through each event in S', and an
  option to redraw the whole diagram in S' (so S's axes become the tilted ones).
