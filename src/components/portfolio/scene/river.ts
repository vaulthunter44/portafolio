import { CatmullRomCurve3, DoubleSide, MathUtils, Mesh, PlaneGeometry, ShaderMaterial, Vector3 } from "three";
import { FIELD_GLSL, NOISE_GLSL } from "./glsl";
import { fieldSlots, type FieldBake } from "./field-bake";
import type { PaintCanvas, Paint } from "./field";
import type { Uniforms } from "./uniforms";

// A meandering river crossing the island behind the illustration (the camera
// starts on +x, so negative x is the far side). Points are world (x, z).
const PATH: [number, number][] = [
  [-5.0, -17], [-7.4, -11], [-5.0, -5.5], [-7.0, 0], [-4.6, 5.5], [-6.8, 11], [-5.2, 17],
];
const SAMPLES = 240;

const curve = new CatmullRomCurve3(PATH.map(([x, z]) => new Vector3(x, 0, z)), false, "centripetal");
const points = curve.getSpacedPoints(SAMPLES).map((p, i) => ({
  x: p.x,
  z: p.z,
  // the banks breathe a little along the way
  half: 2.2 + 0.35 * Math.sin((i / SAMPLES) * Math.PI * 7.3) + 0.2 * Math.sin((i / SAMPLES) * Math.PI * 17.1),
}));

/** Distance from (x, z) to the river's centre line, and the half-width there. */
function nearest(x: number, z: number) {
  let best = Infinity, half = points[0].half;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const abx = b.x - a.x, abz = b.z - a.z;
    const t = MathUtils.clamp(((x - a.x) * abx + (z - a.z) * abz) / (abx * abx + abz * abz), 0, 1);
    const d = Math.hypot(x - (a.x + abx * t), z - (a.z + abz * t));
    if (d < best) { best = d; half = a.half + (b.half - a.half) * t; }
  }
  return { d: best, half };
}

/**
 * Cut the channel out of the ground mask (r), thin and shorten the grass along
 * the banks (g = thickness), and write the water mask into a, faded by the
 * island's own coverage so the river dissolves where the island does.
 *
 * The cut is hard on purpose: a soft ramp would file the banks under "coast",
 * and the blade scatter sends a fixed share of all clumps to the coast, which
 * piled grass up along the water and hid it.
 */
export function carveRiver({ data, size, toWorld, toPx }: PaintCanvas) {
  const reach = 4.5;
  const xs = points.map((p) => p.x), zs = points.map((p) => p.z);
  const x0 = Math.floor(toPx(Math.min(...xs) - reach)), x1 = Math.ceil(toPx(Math.max(...xs) + reach));
  const z0 = Math.floor(toPx(Math.min(...zs) - reach)), z1 = Math.ceil(toPx(Math.max(...zs) + reach));
  for (let pz = z0; pz <= z1; pz++) {
    const wz = toWorld(pz);
    for (let px = x0; px <= x1; px++) {
      const wx = toWorld(px);
      const { d, half } = nearest(wx, wz);
      const bank = d - half;           // < 0 in the water, > 0 on land
      if (bank > reach) continue;
      const o = (pz * size + px) * 4;
      const cover = data[o] / 255;
      if (bank < 0.15) data[o] = 0;
      data[o + 1] = Math.round(data[o + 1] * (0.12 + 0.88 * MathUtils.smoothstep(bank, 0.15, 3.8)));
      const water = (1 - MathUtils.smoothstep(bank, 0.25, 1.15)) * MathUtils.smoothstep(cover, 0.15, 0.6);
      data[o + 3] = Math.max(data[o + 3], Math.round(255 * water));
    }
  }
}

const WATER_VERT = /* glsl */ `
  varying vec2 vXZ;
  ${FIELD_GLSL}
  void main(){
    vXZ = position.xz;
    // a touch below the ground, so the banks sit over the water's edge
    gl_Position = projectionMatrix * modelViewMatrix
      * vec4(position + vec3(0.0, fieldAt(vXZ).a - 0.07, 0.0), 1.0);
  }
`;

const WATER_FRAG = /* glsl */ `
  uniform sampler2D uPaint;
  uniform float uExtent, uTime, uReveal;
  uniform vec3  uWater, uWaterDeep, uWaterLight, uWaterInk;
  varying vec2  vXZ;
  ${NOISE_GLSL}
  ${FIELD_GLSL}
  void main(){
    vec4 p = texture2D(uPaint, vXZ / uExtent + 0.5);
    // a ragged, painted edge rather than a clean curve
    float rag = (fbm(vXZ * 1.4) - 0.5) * 0.34 + (vnoise(vXZ * 5.5) - 0.5) * 0.16;
    float e = p.a + rag * (1.0 - p.a * 0.6);
    if (e < 0.5) discard;
    if ((1.0 - p.b) * 0.85 > uReveal) discard;

    // deeper, darker water towards the middle of the channel
    vec3 c = mix(uWater, uWaterDeep, smoothstep(0.6, 1.0, p.a) * 0.55);
    c = mix(c, uWaterDeep, (fbm(vXZ * 0.45 + 3.1) - 0.5) * 0.5);

    // current lines: noise stretched along the flow (the river runs along z) and drifting
    float lines = fbm(vec2(vXZ.x * 3.2, vXZ.y * 0.3 - uTime * 0.55));
    float glints = fbm(vec2(vXZ.x * 5.0 + 7.0, vXZ.y * 0.7 - uTime * 0.9));
    float band = abs(lines - 0.66);   // thin strokes along an iso-line, not filled blotches
    c = mix(c, uWaterLight, (1.0 - smoothstep(0.0, 0.035, band)) * 0.7);
    c = mix(c, uWaterLight, smoothstep(0.78, 0.84, glints) * 0.4);

    // ink along the bank, measured in pixels like the grass outlines
    float ink = 1.0 - smoothstep(0.0, fwidth(e) * 1.6, e - 0.5);
    c = mix(c, uWaterInk, ink * 0.85);
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }
`;

export function buildWater(paint: Paint, m: Uniforms, bake: FieldBake) {
  const xs = points.map((p) => p.x), zs = points.map((p) => p.z);
  const pad = 4;
  const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad;
  const minZ = Math.min(...zs) - pad, maxZ = Math.max(...zs) + pad;
  const geometry = new PlaneGeometry(maxX - minX, maxZ - minZ, 48, 160);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
  const mesh = new Mesh(
    geometry,
    new ShaderMaterial({
      uniforms: {
        uPaint: { value: paint.tex },
        uExtent: { value: paint.extent },
        uTime: m.uTime,
        uReveal: m.uReveal,
        uWater: m.uWater,
        uWaterDeep: m.uWaterDeep,
        uWaterLight: m.uWaterLight,
        uWaterInk: m.uWaterInk,
        ...fieldSlots(bake),
      },
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG,
      side: DoubleSide,
    }),
  );
  mesh.frustumCulled = false;
  return mesh;
}
