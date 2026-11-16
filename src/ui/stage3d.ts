/**
 * A three.js scene for a simulation's 3D view: renderer, camera, lights,
 * drag-to-orbit controls, resizing and theme colours.
 *
 * three.js is large, so nothing imports this file directly. ui/views.ts loads
 * it with import() the first time a visitor switches to 3D, which keeps it out
 * of the code every page needs.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { cssVars, onThemeChange } from './theme';

export interface Stage3D {
  /** The three.js module, so simulations do not import it themselves. */
  THREE: typeof THREE;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** A theme colour, by its CSS custom property: stage.color('--sim-prime'). */
  color(name: string): THREE.Color;
  /** A floor grid in theme colours, centred on the origin. */
  grid(size: number, divisions: number): THREE.GridHelper;
}

export interface Stage3DOptions {
  /** Where the camera starts, and what it looks at (default: the origin). */
  camera: [x: number, y: number, z: number];
  target?: [x: number, y: number, z: number];
  /**
   * Add the simulation's objects to stage.scene, and return a function that
   * moves them to match the simulation's state. It runs before every frame.
   * build runs again when the theme changes, so read colours from stage.color.
   */
  build(stage: Stage3D): () => void;
}

export interface Stage3DHandle {
  dispose(): void;
}

export function createStage3D(container: HTMLElement, opts: Stage3DOptions): Stage3DHandle {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  container.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
  camera.position.set(...opts.camera);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(...(opts.target ?? [0, 0, 0]));
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.495; // stay above the floor
  controls.update();

  let color = cssVars(container);
  const stage: Stage3D = {
    THREE,
    scene,
    camera,
    color: (name) => new THREE.Color(color(name)),
    grid: (size, divisions) =>
      new THREE.GridHelper(size, divisions, stage.color('--outline-variant'), stage.color('--sim-grid')),
  };

  /** Free the GPU memory of everything in the scene, then empty it. */
  const clear = () => {
    scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      for (const material of materials) material.dispose();
    });
    scene.clear();
  };

  let update = () => {};
  const build = () => {
    clear();
    color = cssVars(container);
    scene.background = stage.color('--sim-bg');
    scene.add(new THREE.AmbientLight(0xffffff, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(6, 12, 8);
    scene.add(sun);
    update = opts.build(stage);
  };
  build();

  const fit = () => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;
    renderer.setSize(width, height, false); // false: the stylesheet sets the displayed size
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(fit);
  observer.observe(container);
  fit();

  let frame = 0;
  const loop = () => {
    frame = requestAnimationFrame(loop);
    if (container.hidden || container.clientWidth === 0) return; // the 2D view is showing
    update();
    controls.update();
    renderer.render(scene, camera);
  };
  frame = requestAnimationFrame(loop);

  const stopTheme = onThemeChange(build);

  return {
    dispose() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      stopTheme();
      controls.dispose();
      clear();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
