# Special Relativity Simulator

**Live:** https://alltawd.github.io/special-relativity-sim/

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
│   ├── index.ts           the list of simulations shown as tabs
│   └── spacetime-diagram.ts   a complete simulation (worked example)
├── ui/controls.ts         slider / toggle / canvas-sizing helpers
├── main.ts                tabs + hash routing (#spacetime, #twin, …)
└── style.css              layout + the canvas palette (light and dark)
```

**Rule:** all physics goes in `src/physics/` with a test. A simulation only reads
numbers from there and draws them.

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
   entry in `sims/index.ts`.
2. Move any formula it needs into `physics/lorentz.ts` and **write its test first**.
3. React `useState` becomes plain `let` variables plus a `render()` function. `useEffect`
   cleanup becomes the function `mount` returns (stop `requestAnimationFrame` loops,
   dispose three.js renderers and geometries, remove listeners).
4. Check it in both light and dark mode, then commit.

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
