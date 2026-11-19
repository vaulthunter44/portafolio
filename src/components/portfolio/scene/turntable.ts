import { OrthographicCamera, Vector3 } from "three";
import { REDUCED } from "./uniforms";

type Options = {
  step: number;        // degrees per detent
  scenes: number;      // detents per revolution
  distance: number;
  elevation: number;   // radians
  frustum: number;     // visible height in world units
  centre: Vector3;
  ease?: number;       // exponential approach rate
  grab?: number;       // px of drag per detent
};

/** How close the camera is: visible height, the point it looks at, and a sideways shift (fraction of width). */
export type View = { frustum: number; y: number; shift: number };

export type Turntable = ReturnType<typeof makeTurntable>;

/** An orthographic camera orbiting the field in fixed steps, eased between them. */
export function makeTurntable({ step, scenes, distance, elevation, frustum, centre, ease = 9, grab = 90 }: Options) {
  const stepRad = (step * Math.PI) / 180;
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  const home = centre.clone();
  const view: View = { frustum, y: centre.y, shift: 0 };
  const goal: View = { ...view };
  let index = 0;
  let azimuth = 0;
  let width = 0, height = 0;
  const listeners = new Set<(scene: number) => void>();
  const cleanups: (() => void)[] = [];
  const wrap = (i: number) => ((i % scenes) + scenes) % scenes;

  function place() {
    home.y = view.y;
    const flat = Math.cos(elevation) * distance;
    camera.position.set(home.x + Math.cos(azimuth) * flat, home.y + Math.sin(elevation) * distance, home.z + Math.sin(azimuth) * flat);
    camera.lookAt(home);
    camera.updateProjectionMatrix();
  }

  function goTo(target: number) {
    const next = Math.round(target);
    if (next === index) return;
    const previous = index;
    index = next;
    // Without motion, jump straight there. (The source sets the angle but never
    // re-places the camera, so its reduced-motion view never actually turns.)
    if (REDUCED) { azimuth = index * stepRad; place(); }
    if (wrap(previous) !== wrap(index)) for (const fn of listeners) fn(wrap(index));
  }
  const turn = (by: number) => goTo(index + by);

  function project() {
    if (!width || !height) return;
    const aspect = width / height;
    camera.left = (-view.frustum * aspect) / 2;
    camera.right = (view.frustum * aspect) / 2;
    camera.top = view.frustum / 2;
    camera.bottom = -view.frustum / 2;
    camera.setViewOffset(width, height, view.shift * width, 0, width, height);
  }

  function resize(w = width, h = height) {
    if (!w || !h) return false;
    width = w;
    height = h;
    project();
    place();
    return true;
  }

  place();

  return {
    camera,
    scenes,
    get index() { return index; },
    get scene() { return wrap(index); },
    get azimuth() { return azimuth; },
    turn,
    goToScene(scene: number) {
      let delta = (((scene - wrap(index)) % scenes) + scenes) % scenes;
      if (delta > scenes / 2) delta -= scenes;
      turn(delta);
    },
    /** Ease towards a closer or farther view (or jump there with reduced motion). */
    setView(next: View) {
      if (goal.frustum === next.frustum && goal.y === next.y && goal.shift === next.shift) return;
      Object.assign(goal, next);
      if (REDUCED) { Object.assign(view, next); project(); place(); }
    },
    update(dt: number) {
      const target = index * stepRad;
      const k = 1 - Math.exp(-dt * ease * 0.42);
      let zooming = false;
      for (const key of ["frustum", "y", "shift"] as const) {
        if (view[key] === goal[key]) continue;
        view[key] += (goal[key] - view[key]) * k;
        if (Math.abs(goal[key] - view[key]) < 1e-4) view[key] = goal[key];
        zooming = true;
      }
      if (zooming) project();
      if (azimuth === target && !zooming) return false;
      azimuth += (target - azimuth) * (1 - Math.exp(-dt * ease));
      if (Math.abs(target - azimuth) < 1e-4) azimuth = target;
      place();
      return true;
    },
    resize,
    /** Drag, wheel and arrow keys on `el` turn the field, unless `when` says otherwise. */
    attach(el: HTMLElement, { when }: { when: (e: Event) => boolean }) {
      let drag: { x: number; from: number } | null = null;
      let wheelLock = 0;
      const down = (e: PointerEvent) => {
        if (!when(e) || e.button !== 0) return;
        drag = { x: e.clientX, from: index };
        el.setPointerCapture?.(e.pointerId);
        el.classList.add("is-turning");
      };
      const move = (e: PointerEvent) => {
        if (drag) goTo(drag.from + Math.round((e.clientX - drag.x) / grab));
      };
      const up = (e: PointerEvent) => {
        if (!drag) return;
        drag = null;
        el.releasePointerCapture?.(e.pointerId);
        el.classList.remove("is-turning");
      };
      const wheel = (e: WheelEvent) => {
        if (!when(e)) return;
        const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        if (Math.abs(delta) < 2) return;
        e.preventDefault();
        const now = performance.now();
        if (now < wheelLock) return;
        wheelLock = now + 320;
        turn(Math.sign(delta));
      };
      const key = (e: KeyboardEvent) => {
        if (!when(e)) return;
        const dir = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -1, ArrowDown: 1 } as Record<string, number>)[e.key];
        if (dir === undefined) return;
        e.preventDefault();
        turn(e.shiftKey ? dir * Math.round(scenes / 4) : dir);
      };
      el.addEventListener("pointerdown", down);
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
      el.addEventListener("wheel", wheel, { passive: false });
      el.addEventListener("keydown", key);
      cleanups.push(() => {
        el.removeEventListener("pointerdown", down);
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerup", up);
        el.removeEventListener("pointercancel", up);
        el.removeEventListener("wheel", wheel);
        el.removeEventListener("keydown", key);
      });
    },
    onDetent(fn: (scene: number) => void) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    dispose() {
      for (const fn of cleanups) fn();
      cleanups.length = 0;
      listeners.clear();
    },
  };
}
