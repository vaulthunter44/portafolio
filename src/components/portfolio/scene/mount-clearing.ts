import {
  Color, Group, MathUtils, Plane, Raycaster, Scene, Sprite, SpriteMaterial, Vector2, Vector3, WebGLRenderer,
} from "three";
import { buildBlades, makeTipOf } from "./blades";
import { makeField, makePaint, makeTerrain, type Field } from "./field";
import { makeFieldBake } from "./field-bake";
import { DAISY_KINDS, buildSpecks, daisyTexture, petalAtlas } from "./flowers";
import { buildGround } from "./ground";
import { buildWater, carveRiver } from "./river";
import { makeSituations } from "./situations";
import { makeSky } from "./sky";
import { makeTurntable, type View } from "./turntable";
import { PAINT_EXTENT, REDUCED, makeUniforms, mulberry32 } from "./uniforms";
import { blend, driversNow, duskAnimation, onDusk, type Drivers } from "../theme";
import { armSound } from "../sound";
import { runIntro } from "../intro";
import { CHAPTERS, chapterAt, firstSceneOf } from "../content";
import { onLang } from "../lang";
import { SITUATIONS } from "../scenes";

export type ClearingParts = {
  root: HTMLElement;
  stage: HTMLElement;
  track: HTMLElement;
  hero: HTMLElement;
  mast: HTMLElement;
};

const SCENES = SITUATIONS.length;
const BLADES = 220_000;
const SEED = 7;
const CAMERA = { elevation: 10, frustum: 26.5, height: 8.75 };
/** The cover, and the closer views once "View portfolio" walks into the field. */
const VIEWS = {
  cover: { frustum: CAMERA.frustum, y: CAMERA.height, shift: 0 },
  tour: { frustum: 14.5, y: 4.4, shift: 0.15 },
  tourNarrow: { frustum: 22, y: -1.5, shift: 0 },
} satisfies Record<string, View>;
const SUN_OFFSET = 20;
const RELIEF = 1.5;
/** Pointer targets that must not start a field drag. */
const NOT_THE_FIELD = ".track, .mast, .hero__go, .hero__code, .contact, .chapter";

const PALETTES = {
  day: {
    grass: "#84a555", pale: "#99ab6d", deep: "#052e42", warm: "#d73d09", cold: "#bfb788",
    water: "#86b9cc", waterDeep: "#4f8aa6", waterLight: "#eaf4f1", waterInk: "#2f5f78",
    sunHeight: 37, sunAmount: 0.07, sunEdge: 0.31, shadow: 0.64, shadowSoft: 0.26,
  },
  dusk: {
    grass: "#9c9a4a", pale: "#d8b46a", deep: "#35203a", warm: "#ff8a2b", cold: "#e0b884",
    water: "#d9a97c", waterDeep: "#8a5f6e", waterLight: "#ffe3ba", waterInk: "#5a3a44",
    sunHeight: 5, sunAmount: 0.34, sunEdge: 0.55, shadow: 0.8, shadowSoft: 0.3,
  },
  night: {
    grass: "#36443a", pale: "#4a5647", deep: "#060f19", warm: "#7d3a1c", cold: "#566276",
    water: "#2c4658", waterDeep: "#152838", waterLight: "#8aa6ba", waterInk: "#0b1620",
    sunHeight: 3, sunAmount: 0.06, sunEdge: 0.2, shadow: 0.4, shadowSoft: 0.45,
  },
};
const COLOUR_KEYS = ["grass", "pale", "deep", "warm", "cold", "water", "waterDeep", "waterLight", "waterInk"] as const;
const LIGHT_KEYS = ["sunHeight", "sunAmount", "sunEdge", "shadow", "shadowSoft"] as const;

export function mountClearing({ root, stage, track, hero, mast }: ClearingParts) {
  root.classList.add("is-live");
  const abort = new AbortController();
  const { signal } = abort;
  armSound(signal);

  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(new Color("#faf8f2"), 0);
  stage.appendChild(renderer.domElement);

  const skyEl = root.querySelector<HTMLElement>(".sky");
  const sky = skyEl ? makeSky(skyEl) : null;

  const scene = new Scene();
  const m = makeUniforms();
  const bake = makeFieldBake(m, PAINT_EXTENT, RELIEF);
  const paint = makePaint();
  const atlas = petalAtlas();
  const ground = buildGround(paint, m, bake);
  scene.add(ground);
  scene.add(buildWater(paint, m, bake));
  const daisyMaterials = DAISY_KINDS.map((k) => new SpriteMaterial({ map: daisyTexture(k), transparent: true, depthWrite: false }));
  const daisies = new Group();
  scene.add(daisies);
  const { hillsAt } = makeTerrain(m);
  const situations = makeSituations(scene, hillsAt);
  const table = makeTurntable({
    step: 360 / SCENES, scenes: SCENES, distance: 60, elevation: MathUtils.degToRad(CAMERA.elevation),
    frustum: CAMERA.frustum, centre: new Vector3(0, CAMERA.height, 0),
  });

  // The look, as tuned on the source site.
  m.uVary.value = 0.69;
  m.uPatch.value = 1;
  m.uGrassDepth.value = 0.63;
  m.uWidth.value = 0.47;
  m.uInkAmount.value = 0.02;
  m.uLine.value = 1.45;
  m.uEdge.value = 0;
  m.uWind.value = REDUCED ? 0 : 0.55;
  m.uGust.value = 0.85;
  m.uHills.value = 0.6;
  m.uHillSize.value = 9.5;

  // ---- the field itself ----------------------------------------------------
  const hillRng = mulberry32((0x9e3779b9 ^ SEED) >>> 0);
  m.uHillSeed.value.set(64 * hillRng(), 64 * hillRng());
  const field: Field = makeField(SEED);
  paint.seed(field.islands.slice(0, 1), carveRiver);

  const bladeCount = REDUCED ? 40_000 : BLADES;
  const blades = buildBlades(field, paint, bladeCount, m, { min: 0.05, max: 0.54 }, bake);
  if (blades) scene.add(blades.group);
  const tipOf = blades ? makeTipOf(blades, m, hillsAt) : null;
  const specks = buildSpecks(field, paint, MathUtils.clamp(Math.round(bladeCount / 45), 16, 400), m, atlas, bake);
  if (specks) scene.add(specks);
  const flowerSprites = (blades?.flowers ?? []).map((f) => {
    const sprite = new Sprite(daisyMaterials[f.kind]);
    sprite.scale.setScalar(f.size);
    daisies.add(sprite);
    return { ...f, sprite };
  });
  let revealClock: number | null = REDUCED ? null : 0;
  m.uReveal.value = REDUCED ? 1.2 : 0;
  m.uGrow.value = REDUCED ? 1.2 : 0;

  // ---- the slider under the field -------------------------------------------
  const inner = track.querySelector<HTMLElement>(".track__inner")!;
  const bar = track.querySelector<HTMLElement>(".track__bar")!;
  const segL = track.querySelector<HTMLElement>(".track__seg--l")!;
  const segR = track.querySelector<HTMLElement>(".track__seg--r")!;
  bar.setAttribute("aria-valuemax", String(SCENES - 1));
  for (const button of track.querySelectorAll<HTMLElement>("[data-turn]")) {
    button.addEventListener("click", () => table.turn(Number(button.dataset.turn)), { signal });
  }
  const thumbLayer = document.createElement("div");
  thumbLayer.className = "thumb-layer";
  const thumb = document.createElement("div");
  thumb.className = "track__thumb";
  thumbLayer.append(thumb);
  bar.append(thumbLayer);

  let shown = 0;
  const paintTrack = () => {
    const at = (shown + 0.5) / SCENES;
    const width = bar.getBoundingClientRect().width;
    const gap = width > 0 ? 7 / width : 0;   // a 7px break either side of the thumb
    bar.style.setProperty("--at", at.toFixed(5));
    thumbLayer.style.setProperty("--at", at.toFixed(5));
    segL.style.setProperty("--l", Math.max(0, at - gap).toFixed(5));
    segR.style.setProperty("--r", Math.max(0, 1 - at - gap).toFixed(5));
  };
  const showScene = (scene: number) => {
    shown = scene;
    paintTrack();
    bar.setAttribute("aria-valuenow", String(scene));
    bar.setAttribute("aria-valuetext", `${situations.nameAt(scene)}, ${scene + 1} / ${SCENES}`);
    root.dispatchEvent(new CustomEvent("portfolio:chapter", { detail: chapterAt(scene, SCENES) }));
  };
  // The tour asks for a chapter by number, or for the one before or after; each
  // chapter starts at its first scene, reached the shortest way round.
  root.addEventListener("portfolio:goto", (e) => {
    table.goToScene(firstSceneOf((e as CustomEvent<number>).detail, SCENES));
  }, { signal });
  root.addEventListener("portfolio:turn", (e) => {
    const next = (chapterAt(table.scene, SCENES) + (e as CustomEvent<number>).detail + CHAPTERS.length) % CHAPTERS.length;
    table.goToScene(firstSceneOf(next, SCENES));
  }, { signal });
  const syncLang = () => showScene(shown);
  const stopLang = onLang(syncLang);

  let barRect: DOMRect | null = null;
  const sceneAtX = (x: number) => {
    if (!barRect || barRect.width <= 0) return 0;
    return MathUtils.clamp(Math.round(SCENES * ((x - barRect.left) / barRect.width) - 0.5), 0, SCENES - 1);
  };
  let scrubbing = false;
  bar.addEventListener("pointerdown", (e) => {
    if (e.button) return;
    e.stopPropagation();
    scrubbing = true;
    barRect = bar.getBoundingClientRect();
    inner.classList.add("is-dragging");
    thumbLayer.classList.add("is-dragging");
    bar.setPointerCapture?.(e.pointerId);
    table.goToScene(sceneAtX(e.clientX));
    e.preventDefault();
  }, { signal });
  bar.addEventListener("pointermove", (e) => { if (scrubbing) table.goToScene(sceneAtX(e.clientX)); }, { signal });
  const endScrub = (e?: PointerEvent) => {
    if (!scrubbing) return;
    scrubbing = false;
    inner.classList.remove("is-dragging");
    thumbLayer.classList.remove("is-dragging");
    if (e?.pointerId !== undefined) bar.releasePointerCapture?.(e.pointerId);
  };
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"] as const) bar.addEventListener(type, endScrub, { signal });
  bar.addEventListener("keydown", (e) => {
    const dir = ({ ArrowLeft: -1, ArrowRight: 1, ArrowDown: -1, ArrowUp: 1 } as Record<string, number>)[e.key];
    if (dir === undefined) return;
    e.preventDefault();
    e.stopPropagation();
    table.turn(dir);
  }, { signal });

  // The slider grows as the pointer approaches it.
  let pointerY = -1e4, reachFrame = 0;
  const updateReach = () => {
    reachFrame = 0;
    const top = bar.getBoundingClientRect().top;
    const near = Math.max(0, 1 - Math.abs(pointerY - top) / 210);
    inner.style.setProperty("--reach", (near * near).toFixed(3));
    thumbLayer.style.setProperty("--reach", (near * near).toFixed(3));
  };
  if (!REDUCED) {
    addEventListener("pointermove", (e) => { pointerY = e.clientY; reachFrame ||= requestAnimationFrame(updateReach); }, { passive: true, signal });
    addEventListener("pointerleave", () => { pointerY = -1e4; reachFrame ||= requestAnimationFrame(updateReach); }, { signal });
  }

  table.onDetent(showScene);
  showScene(table.scene);
  const intro = runIntro({ root, hero, mast, track, signal });
  table.attach(document.body, {
    when: (e) => !(e.target as Element | null)?.closest?.(NOT_THE_FIELD),
  });

  // ---- the pointer "ball" that parts the grass ------------------------------
  const ray = new Raycaster();
  const groundPlane = new Plane(new Vector3(0, 1, 0), 0);
  const ndc = new Vector2();
  const hit = new Vector3();
  const viewDir = new Vector3();
  const ball = { at: new Vector3(), here: false, r: 0, head: 0, trail: Array.from({ length: 8 }, () => ({ x: 0, z: 0, at: -99 })) };

  function pickGround(e: PointerEvent) {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -(((e.clientY - rect.top) / rect.height) * 2) + 1);
    ray.setFromCamera(ndc, table.camera);
    if (!ray.ray.intersectPlane(groundPlane, hit)) return null;
    // Two refinements against the hills.
    for (let i = 0; i < 2 && m.uHills.value > 0; i++) {
      groundPlane.constant = -hillsAt(hit.x, hit.z);
      if (!ray.ray.intersectPlane(groundPlane, hit)) break;
    }
    groundPlane.constant = 0;
    return hit;
  }
  addEventListener("pointermove", (e) => {
    const p = pickGround(e);
    ball.here = !!p;
    if (!p) return;
    // Back off along the view so the ball sits under the cursor at blade height.
    table.camera.getWorldDirection(viewDir);
    const back = 0.62 / Math.max(0.05, Math.abs(viewDir.y));
    const x = p.x - viewDir.x * back, z = p.z - viewDir.z * back;
    ball.at.set(x, hillsAt(x, z), z);
  }, { passive: true, signal });
  addEventListener("pointerleave", () => { ball.here = false; }, { signal });
  addEventListener("blur", () => { ball.here = false; }, { signal });

  function updateBall(dt: number, time: number) {
    const goal = ball.here ? 1.15 : 0;
    ball.r += (goal - ball.r) * Math.min(1, dt * (ball.here ? 12 : 1.8));
    if (ball.r < 0.01 && !ball.here) ball.r = 0;
    if (ball.r > 0.001) m.uBall.value.set(ball.at.x, ball.at.y, ball.at.z, ball.r);
    else m.uBall.value.set(9999, 0, 9999, 1.15);
    if (ball.here) {
      const last = ball.trail[ball.head];
      if (Math.hypot(ball.at.x - last.x, ball.at.z - last.z) > 1.15 || last.at < 0) {
        ball.head = (ball.head + 1) % ball.trail.length;
        ball.trail[ball.head] = { x: ball.at.x, z: ball.at.z, at: time };
      }
    }
    ball.trail.forEach((t, i) => {
      const fade = Math.max(0, 1 - (time - t.at) / 20);
      m.uTrail.value[i].set(t.x, t.z, fade * fade * 0.8, 0);
    });
  }

  // ---- day, dusk and night ---------------------------------------------------
  const palette = Object.fromEntries(
    Object.entries(PALETTES).map(([name, p]) => [name, Object.fromEntries(COLOUR_KEYS.map((k) => [k, new Color(p[k])]))]),
  ) as Record<keyof typeof PALETTES, Record<(typeof COLOUR_KEYS)[number], Color>>;
  const mixed = Object.fromEntries(COLOUR_KEYS.map((k) => [k, new Color()])) as Record<(typeof COLOUR_KEYS)[number], Color>;
  let sunHeight = PALETTES.day.sunHeight;
  let lightDirty = true;
  const stopDusk = onDusk(() => { lightDirty = true; });

  function applyLight(d: Drivers) {
    situations.setLight(d.night);
    sky?.setLight(d);
    for (const k of COLOUR_KEYS) {
      const c = mixed[k];
      c.r = blend(palette.day[k].r, palette.dusk[k].r, palette.night[k].r, d);
      c.g = blend(palette.day[k].g, palette.dusk[k].g, palette.night[k].g, d);
      c.b = blend(palette.day[k].b, palette.dusk[k].b, palette.night[k].b, d);
    }
    m.uGrass.value.copy(mixed.grass);
    m.uGrassPale.value.copy(mixed.pale);
    m.uGrassDeep.value.copy(mixed.deep);
    m.uWarm.value.copy(mixed.warm);
    m.uCold.value.copy(mixed.cold);
    m.uWater.value.copy(mixed.water);
    m.uWaterDeep.value.copy(mixed.waterDeep);
    m.uWaterLight.value.copy(mixed.waterLight);
    m.uWaterInk.value.copy(mixed.waterInk);
    const light = Object.fromEntries(LIGHT_KEYS.map((k) => [k, blend(PALETTES.day[k], PALETTES.dusk[k], PALETTES.night[k], d)]));
    sunHeight = light.sunHeight;
    m.uSunAmount.value = light.sunAmount;
    m.uSunEdge.value = light.sunEdge;
    m.uShadowAmount.value = light.shadow;
    m.uShadowSoft.value = light.shadowSoft;
  }

  // ---- size ------------------------------------------------------------------
  const resize = () => {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (table.resize(w, h)) renderer.setSize(w, h, false);
    sky?.resize();
    paintTrack();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  if (skyEl) observer.observe(skyEl);
  resize();

  // ---- the white slider over dark grass -------------------------------------
  const paper = [250, 248, 242];
  let row: Uint8Array | null = null;
  const luminance = (r: number, g: number, b: number) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  function sampleUnderTrack() {
    const bg = /rgba?\(([^)]+)\)/.exec(getComputedStyle(document.body).backgroundColor);
    if (bg) {
      const [r, g, b] = bg[1].split(",").map(Number);
      if (![r, g, b].some(Number.isNaN)) paper.splice(0, 3, r, g, b);
    }
    const rect = bar.getBoundingClientRect();
    if (rect.width <= 0) return;
    const gl = renderer.getContext();
    const ratio = renderer.getPixelRatio();
    const width = Math.max(1, Math.round(rect.width * ratio));
    const left = Math.max(0, Math.round(rect.left * ratio));
    const y = Math.round((innerHeight - (rect.top + rect.height / 2)) * ratio);
    if (y < 0 || y >= gl.drawingBufferHeight) return;
    if (!row || row.length < 4 * width) row = new Uint8Array(4 * width);
    gl.readPixels(left, y, width, 1, gl.RGBA, gl.UNSIGNED_BYTE, row);
    let sum = 0;
    for (let i = 0; i < width; i++) {
      const o = 4 * i, a = row[o + 3] / 255;
      sum += luminance(row[o] + paper[0] * (1 - a), row[o + 1] + paper[1] * (1 - a), row[o + 2] + paper[2] * (1 - a));
    }
    inner.dataset.dark = String(sum / width < 0.5);
  }

  // ---- frame loop ------------------------------------------------------------
  const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
  let last = performance.now();
  let lastSample = 0;
  let frame = requestAnimationFrame(function loop(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    frame = requestAnimationFrame(loop);
    if (document.hidden) return;
    m.uTime.value += dt;

    if (revealClock !== null) {
      revealClock += dt;
      const spread = Math.min(1, revealClock / 3.5);
      m.uReveal.value = 1.2 * easeOut(spread);
      m.uGrow.value = 1.2 * easeOut(Math.min(1, revealClock / 2.7));
      if (spread >= 1) revealClock = null;
    }
    updateBall(dt, m.uTime.value);
    if (lightDirty) {
      applyLight(driversNow());
      if (!duskAnimation()) lightDirty = false;
    }

    const touring = root.dataset.mode === "tour";
    table.setView(!touring ? VIEWS.cover : innerWidth < 768 ? VIEWS.tourNarrow : VIEWS.tour);
    table.update(dt);
    situations.update(table, dt, m.uGrow.value, touring ? chapterAt(table.scene, SCENES) : null);
    const az = table.azimuth + MathUtils.degToRad(SUN_OFFSET), el = MathUtils.degToRad(sunHeight);
    m.uSunDir.value.set(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el));
    const skew = Math.min(1 / Math.tan(el), 6);
    m.uSunSkew.value.set(-Math.cos(az) * skew, -Math.sin(az) * skew);
    bake.ensure(renderer);
    if (tipOf) for (const f of flowerSprites) {
      const t = tipOf(f.i, m.uTime.value);
      f.sprite.position.set(t.x, t.y, t.z);
    }
    renderer.render(scene, table.camera);
    if (sky && root.dataset.sky !== "off") sky.render(m.uTime.value, table.azimuth);

    if (m.uTime.value - lastSample > 0.2) {
      lastSample = m.uTime.value;
      sampleUnderTrack();
    }
  });

  return () => {
    abort.abort();
    observer.disconnect();
    stopDusk();
    stopLang();
    intro.dispose();
    cancelAnimationFrame(frame);
    cancelAnimationFrame(reachFrame);
    root.classList.remove("is-live", "is-entering");
    table.dispose();
    situations.dispose();
    sky?.dispose();
    thumbLayer.remove();
    scene.traverse((o) => {
      const mesh = o as { geometry?: { dispose(): void }; material?: { dispose(): void } };
      mesh.geometry?.dispose();
      mesh.material?.dispose();
    });
    for (const mat of daisyMaterials) { mat.map?.dispose(); mat.dispose(); }
    atlas.dispose();
    paint.tex.dispose();
    bake.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    stage.replaceChildren();
  };
}
