import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths, so the build works under github.io/<repo>/ on GitHub Pages.
  base: './',
  build: {
    // three.js is about 740 kB. It is in a chunk of its own (ui/stage3d.ts) that
    // is fetched only when someone opens a 3D view, so its size is expected.
    chunkSizeWarningLimit: 800,
  },
});
