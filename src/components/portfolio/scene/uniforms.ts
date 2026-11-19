import { Color, Vector2, Vector3, Vector4, type IUniform } from "three";

export const INK = "#4a5c37";
export const PAINT_EXTENT = 96;
export const REDUCED =
  typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const u = <T,>(value: T): IUniform<T> => ({ value });

/** One shared set of uniforms; every material references the same objects. */
export function makeUniforms() {
  return {
    uTime: u(0),
    uWind: u(REDUCED ? 0 : 0.55),
    uGrow: u(0),
    uCrop: u(1),
    uReveal: u(0),
    uLine: u(1.3),
    uInkAmount: u(0.5),
    uInkColor: u(new Color(INK)),
    uGrass: u(new Color("#c2c87e")),
    uGrassPale: u(new Color("#d8dd98")),
    uGrassDeep: u(new Color("#9fad63")),
    uVary: u(0.55),
    uPatch: u(0.5),
    uWarm: u(new Color("#cfc06a")),
    uCold: u(new Color("#93b087")),
    uWidth: u(1),
    uEdge: u(1.8),
    uGust: u(0.75),
    uWindDir: u(new Vector2(1, 0.35).normalize()),
    uBall: u(new Vector4(0, 0, 0, 0)),
    uTrail: u(Array.from({ length: 8 }, () => new Vector4(0, 0, 0, 0))),
    uSunDir: u(new Vector3(0, 1, 0)),
    uSunSkew: u(new Vector2(0, 0)),
    uSunColor: u(new Color("#fff4d6")),
    uShadeColor: u(new Color("#333c66")),
    uSunAmount: u(0.22),
    uSunEdge: u(0.6),
    uShadowAmount: u(0.55),
    uShadowSoft: u(0.45),
    uGrassDepth: u(0.25),
    uCasters: u(Array.from({ length: 16 }, () => new Vector4(0, 0, 0, 0))),
    uDensity: u(1),
    uCullPad: u(new Vector2(2, 2)),
    uHills: u(1.4),
    uHillSize: u(13),
    uHillSeed: u(new Vector2(0, 0)),
    // the river (an addition to the source scene); set per time of day
    uWater: u(new Color("#86b9cc")),
    uWaterDeep: u(new Color("#4f8aa6")),
    uWaterLight: u(new Color("#eaf4f1")),
    uWaterInk: u(new Color("#2f5f78")),
  };
}

export type Uniforms = ReturnType<typeof makeUniforms>;

export const lightSlots = (m: Uniforms) => ({
  uSunDir: m.uSunDir,
  uSunColor: m.uSunColor,
  uShadeColor: m.uShadeColor,
  uSunAmount: m.uSunAmount,
  uSunEdge: m.uSunEdge,
});

export const shadowSlots = (m: Uniforms) => ({
  uCasters: m.uCasters,
  uSunSkew: m.uSunSkew,
  uShadowAmount: m.uShadowAmount,
  uShadowSoft: m.uShadowSoft,
});

export const hillSlots = (m: Uniforms) => ({
  uHills: m.uHills,
  uHillSize: m.uHillSize,
  uHillSeed: m.uHillSeed,
});

/** Deterministic PRNG; the field layout depends on the exact sequence. */
export function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let e = Math.imul(t ^ (t >>> 15), 1 | t);
    e = (e + Math.imul(e ^ (e >>> 7), 61 | e)) ^ e;
    return ((e ^ (e >>> 14)) >>> 0) / 0x100000000;
  };
}

const hash = (x: number, y: number) => {
  const v = 43758.5453123 * Math.sin(127.1 * x + 311.7 * y);
  return v - Math.floor(v);
};

/** CPU twin of the GLSL vnoise, so blade tips and hills match the shaders. */
export function vnoise(x: number, y: number) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  const top = a + (b - a) * sx;
  return top + sy * (c + (d - c) * sx - top);
}
