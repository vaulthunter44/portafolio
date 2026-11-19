import {
  CanvasTexture, Color, DoubleSide, Float32BufferAttribute, InstancedBufferAttribute, InstancedBufferGeometry,
  Mesh, NoColorSpace, SRGBColorSpace, ShaderMaterial,
} from "three";
import { FIELD_GLSL } from "./glsl";
import { fieldSlots, type FieldBake } from "./field-bake";
import { samplePaint, type Field, type Paint } from "./field";
import { INK, type Uniforms } from "./uniforms";

/** The daisies that sit on top of the flower stalks. */
export const DAISY_KINDS = [
  { petals: 7, rx: 22, ry: 42, at: 62, eye: 26, fill: "#fdfdf7", core: "#e5dc82" },
  { petals: 5, rx: 30, ry: 34, at: 54, eye: 22, fill: "#f6e79a", core: "#d08b34" },
  { petals: 13, rx: 9, ry: 48, at: 60, eye: 30, fill: "#fbf6ec", core: "#c9772f" },
  { petals: 6, rx: 26, ry: 38, at: 58, eye: 20, fill: "#f0b9c6", core: "#b8577a" },
  { petals: 8, rx: 16, ry: 44, at: 60, eye: 24, fill: "#cfd6ee", core: "#7d6bb0" },
  { petals: 4, rx: 34, ry: 30, at: 50, eye: 18, fill: "#f8d9a4", core: "#a4562c" },
];

const PETAL_COLOURS = ["#f4dd86", "#fdf7e4", "#e8938a", "#e9adc5", "#c9b6dd", "#f0c874", "#f7f2e2", "#d9e3f0", "#eab8a0", "#cfe0a8", "#f2c9dd", "#e7d4f2"];
const CORE_COLOURS = ["#e6b953", "#d98f3c", "#7e5a2a", "#f0d67a", "#c2603f"];

export function daisyTexture(kind: (typeof DAISY_KINDS)[number]) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.translate(128, 128);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 7;
  ctx.lineJoin = ctx.lineCap = "round";
  ctx.fillStyle = kind.fill;
  for (let i = 0; i < kind.petals; i++) {
    ctx.save();
    ctx.rotate((i / kind.petals) * Math.PI * 2 + 0.2);
    ctx.beginPath();
    ctx.ellipse(0, -kind.at, kind.rx, kind.ry, 0, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 0, kind.eye, 0, 2 * Math.PI);
  ctx.fillStyle = kind.core;
  ctx.fill();
  ctx.stroke();
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** 2×2 atlas of tiny flower shapes: red channel = petal, green = centre, black = line. */
export function petalAtlas() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.strokeStyle = "#000";
  ctx.lineJoin = ctx.lineCap = "round";
  const petals = (count: number, rx: number, ry: number, at: number, turn: number) => {
    ctx.fillStyle = "#f00";
    for (let i = 0; i < count; i++) {
      ctx.save();
      ctx.rotate((i / count) * Math.PI * 2 + turn);
      ctx.beginPath();
      ctx.ellipse(0, -at, rx, ry, 0, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  };
  const eye = (r: number) => {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, 2 * Math.PI);
    ctx.fillStyle = "#0f0";
    ctx.fill();
    ctx.stroke();
  };
  const cell = (cx: number, cy: number, draw: () => void) => {
    ctx.save();
    ctx.translate(128 * cx + 64, 128 * cy + 64);
    draw();
    ctx.restore();
  };
  ctx.lineWidth = 5;
  cell(0, 0, () => { petals(5, 14, 22, 28, 0.3); eye(13); });
  cell(1, 0, () => { petals(11, 5, 27, 30, 0.1); eye(12); });
  cell(0, 1, () => { petals(4, 21, 17, 23, 0.8); eye(9); });
  cell(1, 1, () => {
    ctx.lineWidth = 3.5;
    for (const [x, y] of [[0, -17], [-16, 7], [16, 7], [0, 20]]) {
      ctx.save();
      ctx.translate(x, y);
      petals(5, 6, 9, 9, 0.2);
      eye(4.5);
      ctx.restore();
    }
  });
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = NoColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const SPECK_VERT = /* glsl */ `
  attribute vec3  iPos;
  attribute vec3  iColor;
  attribute vec3  iCore;
  attribute vec3  iSize;     // size, phase/turn, atlas cell
  uniform float uTime, uWind, uGrow;
  varying vec2 vUv;
  varying vec3 vColor;
  varying vec3 vCore;
  ${FIELD_GLSL}
  void main(){
    vec2 cell = vec2(mod(iSize.z, 2.0), floor(iSize.z * 0.5));
    vUv = (uv + cell) * 0.5;
    vColor = iColor;
    vCore = iCore;

    float g = clamp((uGrow - 0.72) / 0.3, 0.0, 1.0);   // flowers open last
    g = g * g * (3.0 - 2.0 * g);
    if (g <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }

    vec4 mv = modelViewMatrix * vec4(iPos + vec3(0.0, fieldAt(iPos.xz).a, 0.0), 1.0);
    float sway = sin(uTime * 1.3 + iSize.y) * 0.018 * uWind;
    float ca = cos(iSize.y), sa = sin(iSize.y);
    vec2 turned = vec2(position.x * ca - position.y * sa, position.x * sa + position.y * ca);
    mv.xy += turned * (iSize.x * g) + vec2(sway, 0.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const SPECK_FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uInkColor;
  varying vec2 vUv;
  varying vec3 vColor;
  varying vec3 vCore;
  void main(){
    vec4 t = texture2D(uMap, vUv);
    if (t.a < 0.5) discard;
    float petal = t.r, core = t.g;
    float line = clamp(1.0 - petal - core, 0.0, 1.0);
    vec3 c = (vColor * petal + vCore * core + uInkColor * line) / max(0.001, petal + core + line);
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }
`;

/** Small flat flowers scattered through the grass, favouring the sparser ground. */
export function buildSpecks(field: Field, paint: Paint, count: number, m: Uniforms, atlas: CanvasTexture, bake: FieldBake) {
  const { rng, density } = field;
  const { inside } = paint.lists();
  if (!inside.length) return null;
  const iPos = new Float32Array(3 * count), iColor = new Float32Array(3 * count);
  const iCore = new Float32Array(3 * count), iSize = new Float32Array(3 * count);
  const colour = new Color();
  for (let i = 0; i < count; i++) {
    let spot = samplePaint(rng, paint, inside)!;
    for (let k = 0; k < 6 && rng() < density(spot) * spot.thick * (0.35 + 0.65 * spot.depth); k++) spot = samplePaint(rng, paint, inside)!;
    const lift = 0.55 + 0.45 * (1 - spot.depth);
    iPos.set([spot.x, 0.04 + 0.3 * rng() * lift, spot.z], 3 * i);
    colour.set(PETAL_COLOURS[(rng() * PETAL_COLOURS.length) | 0]);
    iColor.set([colour.r, colour.g, colour.b], 3 * i);
    colour.set(CORE_COLOURS[(rng() * CORE_COLOURS.length) | 0]);
    iCore.set([colour.r, colour.g, colour.b], 3 * i);
    const cell = (4 * rng()) | 0;
    const scale = cell === 1 ? 0.78 : cell === 3 ? 1.15 : 1;
    iSize.set([(0.15 + 0.15 * rng()) * lift * scale, 6.28 * rng(), cell], 3 * i);
  }
  const geo = new InstancedBufferGeometry();
  geo.setAttribute("position", new Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
  geo.setAttribute("uv", new Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  geo.setAttribute("iPos", new InstancedBufferAttribute(iPos, 3));
  geo.setAttribute("iColor", new InstancedBufferAttribute(iColor, 3));
  geo.setAttribute("iCore", new InstancedBufferAttribute(iCore, 3));
  geo.setAttribute("iSize", new InstancedBufferAttribute(iSize, 3));
  geo.instanceCount = count;
  const mesh = new Mesh(geo, new ShaderMaterial({
    uniforms: { uTime: m.uTime, uWind: m.uWind, uGrow: m.uGrow, uInkColor: m.uInkColor, uMap: { value: atlas }, ...fieldSlots(bake) },
    vertexShader: SPECK_VERT,
    fragmentShader: SPECK_FRAG,
    side: DoubleSide,
  }));
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  return mesh;
}
