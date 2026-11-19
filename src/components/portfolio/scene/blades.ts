import {
  BufferAttribute, DoubleSide, Float32BufferAttribute, Group, InstancedBufferAttribute,
  InstancedBufferGeometry, MathUtils, Mesh, ShaderMaterial, Vector3,
} from "three";
import { FIELD_GLSL, LIGHT_GLSL, NOISE_GLSL, SHADOW_GLSL } from "./glsl";
import { fieldSlots, type FieldBake } from "./field-bake";
import { samplePaint, type Field, type Paint } from "./field";
import { lightSlots, shadowSlots, vnoise, type Uniforms } from "./uniforms";
import { DAISY_KINDS } from "./flowers";

const BLADE_VERT = /* glsl */ `
  attribute vec3  iPos;      // root (y > 0 marks a loose, drifting leaf)
  attribute vec4  iParams;   // height, width, resting lean, phase
  attribute vec2  iFace;     // yaw off camera-facing
  attribute vec2  iLean;     // world direction of the resting lean
  attribute float iDelay;    // when it sprouts during the reveal
  attribute float iInk;      // rank for keeping an outline
  attribute float iShape;    // profile roundness: 1.6 wispy … 4 leafy
  attribute float iRank;     // rank for thinning out

  uniform float uTime, uWind, uGust, uGrow, uCrop, uInkAmount, uWidth;
  uniform vec2  uWindDir;
  uniform vec4  uBall;       // xz centre, w radius
  uniform vec4  uTrail[8];   // xz, strength
  uniform float uGrassDepth, uDensity;
  uniform vec2  uCullPad;
  varying vec3  vColor;
  varying float vAcross;
  varying float vHalf;
  varying float vToTip;
  varying float vInked;
  ${NOISE_GLSL}
  ${FIELD_GLSL}
  ${LIGHT_GLSL}
  ${SHADOW_GLSL}

  void main(){
    float t = position.y;   // 0 root → 1 tip

    // Cheap exits first: off screen, thinned out, or not sprouted yet.
    vec4 rootClip = projectionMatrix * modelViewMatrix * vec4(iPos.x, 0.0, iPos.z, 1.0);
    vec2 rootNdc = rootClip.xy / rootClip.w;
    if (abs(rootNdc.x) > uCullPad.x || abs(rootNdc.y) > uCullPad.y) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return;
    }
    float thin = smoothstep(uDensity, uDensity - 0.14, iRank);
    if (thin <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }

    vec4 field = fieldAt(iPos.xz);
    float ground = field.a;

    float g = clamp((uGrow - iDelay) / 0.32, 0.0, 1.0);
    g = g * g * (3.0 - 2.0 * g);
    if (g <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }

    vInked = 1.0 - step(uInkAmount, iInk);

    // Billboard about Y, turned slightly per blade.
    vec3 toCam = cameraPosition - iPos;
    toCam.y = 0.0;
    vec3 f = normalize(toCam);
    vec3 r = normalize(cross(vec3(0.0, 1.0, 0.0), f));
    vec3 side = normalize(r * iFace.x + f * iFace.y);
    float phase = iParams.w;

    vec3 push = vec3(iLean.x, 0.0, iLean.y) * iParams.z;

    // Gusts travel: the noise is sampled in a frame sliding downwind.
    float wave = fbm(iPos.xz * 0.13 - uWindDir * uTime * 1.15) * 2.0 - 1.0;
    float flutter = sin(uTime * 3.3 + phase * 2.1) * 0.09;
    float force = max(0.0, uWind * (0.42 + uGust * wave) + flutter * uWind);
    push += vec3(uWindDir.x, 0.0, uWindDir.y) * force;

    // The pointer "ball" parts the grass; its trail fades so the wake stands back up.
    float squash = 0.0;
    if (uBall.w > 0.0) {
      vec2 d = iPos.xz - uBall.xz;
      float dist = length(d);
      float k = 1.0 - smoothstep(uBall.w * 0.5, uBall.w * 2.1, dist);
      push += vec3(d.x, 0.0, d.y) / max(dist, 0.001) * k * 1.7;
      squash = k;
      for (int i = 0; i < 8; i++) {
        vec2 td = iPos.xz - uTrail[i].xy;
        float tdist = length(td);
        float tk = (1.0 - smoothstep(uBall.w * 0.4, uBall.w * 1.7, tdist)) * uTrail[i].z;
        push += vec3(td.x, 0.0, td.y) / max(tdist, 0.001) * tk * 1.1;
        squash = max(squash, tk * 0.8);
      }
    }
    float pl = length(push);
    if (pl > 1.5) push *= 1.5 / pl;

    float h = iParams.x * g * uCrop * (1.0 - 0.6 * clamp(squash, 0.0, 1.0)) * thin;

    // Elliptical profile: full width most of the way up, rounded at the tip.
    float outer = mix(0.5, 0.36, clamp((iShape - 2.0) / 2.6, 0.0, 1.0));
    float w = iParams.y * uWidth * pow(max(0.0, 1.0 - pow(t, iShape)), outer);

    vAcross = position.x * 2.0;
    vHalf = w * 0.5;
    vToTip = (1.0 - t) * h;

    float curve = t * t;
    float wobble = sin(t * 6.5 + phase * 4.0) * 0.018;
    float over = dot(push, push);

    vec3 p = iPos + vec3(0.0, ground, 0.0)
      + side * (position.x * w + wobble * h)
      + push * (curve * h)
      + vec3(0.0, 1.0, 0.0) * (t * h * (1.0 - 0.18 * min(over, 2.0) * curve));

    float loose = step(0.05, iPos.y);
    p += loose * (
      vec3(uWindDir.x, 0.0, uWindDir.y) * (sin(uTime * 0.31 + phase) * 0.5 + 0.5) * (0.7 + uWind)
      + vec3(0.0, sin(uTime * 0.47 + phase * 1.4) * 0.17, 0.0)
      + vec3(-uWindDir.y, 0.0, uWindDir.x) * cos(uTime * 0.26 + phase * 0.8) * 0.45);

    // Same green as the ground under the root, darker down in the sward.
    vec3 green = field.rgb;
    green = tone(green, uShadeColor, uGrassDepth * (1.0 - smoothstep(0.0, 0.62, t)));
    green = tone(green, uShadeColor, castShadow(iPos.xz));

    vColor = green;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const BLADE_FRAG = /* glsl */ `
  uniform float uLine;
  uniform vec3  uInkColor;
  varying vec3  vColor;
  varying float vAcross;
  varying float vHalf;
  varying float vToTip;
  varying float vInked;
  void main(){
    // Distance to the blade's own edge, converted to pixels for a constant line weight.
    float d = min((1.0 - abs(vAcross)) * vHalf, vToTip);
    float px = max(fwidth(d), 1e-6);
    float e = 1.0 - smoothstep(uLine * px * 0.35, uLine * px * 1.15, d);
    gl_FragColor = vec4(mix(vColor, uInkColor, e * vInked), 1.0);
    #include <colorspace_fragment>
  }
`;

/** A ribbon of `segments` quads, denser towards the tip. */
function ribbon(segments: number) {
  const pos: number[] = [], idx: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const y = 1 - Math.pow(1 - i / segments, 1.7);
    pos.push(-0.5, y, 0, 0.5, y, 0);
  }
  for (let i = 0; i < segments; i++) {
    const a = 2 * i;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  return { position: new Float32BufferAttribute(pos, 3), index: new BufferAttribute(new Uint16Array(idx), 1) };
}

type Kind = "single" | "tuft" | "puff" | "flower";
export type FlowerSeat = { i: number; size: number; kind: number };
export type Blades = NonNullable<ReturnType<typeof buildBlades>>;

export function buildBlades(field: Field, paint: Paint, count: number, m: Uniforms, size: { min: number; max: number }, bake: FieldBake) {
  const { rng: h, density } = field;
  const { inside, fringe, halo } = paint.lists();
  if (!inside.length) return null;

  const iPos = new Float32Array(3 * count), iParams = new Float32Array(4 * count);
  const iFace = new Float32Array(2 * count), iLean = new Float32Array(2 * count);
  const iDelay = new Float32Array(count), iInk = new Float32Array(count);
  const iShape = new Float32Array(count), iRank = new Float32Array(count);
  const flowers: FlowerSeat[] = [];
  const maxFlowers = MathUtils.clamp(Math.round(count / 110), 5, 40);
  const looseLeaves = MathUtils.clamp(Math.round(0.012 * count), 3, 40);

  let at = 0;
  while (at < count - looseLeaves) {
    const roll = h();
    const inHalo = halo.length > 0 && roll < 0.36;
    const inFringe = !inHalo && roll < 0.56;
    const edge = inHalo || inFringe;
    let spot = samplePaint(h, paint, inHalo ? halo : inFringe && fringe.length ? fringe : inside);
    if (!spot) break;
    if (inHalo) {
      if (h() > 8 * spot.zone) continue;
    } else if (!inFringe) {
      // Rejection sampling against the density map; give up after four tries.
      for (let k = 0; k < 4 && h() > density(spot) * spot.thick; k++) spot = samplePaint(h, paint, inside)!;
    }
    const haloShare = inHalo ? MathUtils.clamp(8 * spot.zone, 0.15, 1) : 1;

    const pick = h();
    const kind: Kind = inHalo
      ? pick < 0.5 ? "single" : pick < 0.82 || haloShare < 0.55 ? "tuft" : "puff"
      : inFringe
        ? pick < 0.45 ? "single" : pick < 0.8 ? "tuft" : "puff"
        : pick < 0.1 ? "single" : pick < 0.42 ? "tuft" : pick < 0.93 ? "puff" : "flower";
    const D = spot.depth;
    const tall = h() < 0.1 ? 1.5 + 0.8 * h() : 1;
    const big = kind === "puff" && h() < 0.28 * D + 0.04 ? 1.6 + 0.6 * h() : 1;
    const base = kind === "single" ? (h() < 0.35 ? 2 : 1)
      : kind === "puff" ? (inHalo ? 5 + 4 * h() : 10 + h() * (edge ? 6 : 14))
      : 4 + h() * (edge ? 3 : 8);
    const blades = Math.max(1, Math.round(base * (big > 1 ? 1.8 : 1) * (inHalo ? 0.3 + 0.7 * haloShare : 1)));
    const spread = kind === "single" ? 0.02
      : kind === "puff" ? (0.17 + 0.2 * h()) * big * (0.5 + 0.5 * D)
      : (0.07 + 0.2 * h()) * (0.6 + 0.4 * D) * (inHalo ? 0.6 : 1);
    const height = (0.34 + 0.72 * D) * (size.min + h() * Math.max(0.02, size.max - size.min))
      * (inHalo ? 0.44 + 0.36 * haloShare : inFringe ? 0.55 : 1) * big * tall * MathUtils.clamp(spot.thick, 0.35, 1.8);
    const width = 0.105 * (0.75 + 0.55 * h());
    const lean = 0.45 + 0.95 * h();
    const delay = MathUtils.clamp(0.45 * spot.u + 0.3 * h(), 0, 0.75);
    const withFlower = kind === "flower" && flowers.length < maxFlowers;
    const total = Math.min(blades + (withFlower ? 1 : 0), count - at);

    for (let e = 0; e < total; e++, at++) {
      const stalk = withFlower && e === 0;
      const angle = h() * Math.PI * 2;
      const radius = stalk ? 0 : Math.sqrt(h());
      const ox = Math.cos(angle) * radius * spread, oz = Math.sin(angle) * radius * spread;
      const leafy = kind === "puff" ? h() < 0.88 : h() < 0.3;
      const wispy = !leafy && h() < (kind === "puff" ? 0.45 : 0.3);
      let bh = kind === "puff"
        ? height * (0.35 + 0.8 * Math.sqrt(Math.max(0, 1 - radius * radius))) * (0.9 + 0.2 * h())
        : height * (0.5 + 0.62 * (1 - radius)) * (0.85 + 0.3 * h());
      let bw = width * (0.75 + 0.5 * h());
      let shape = 2.6;
      if (leafy) { bh *= 0.85; bw *= 2.4 + 0.9 * h(); shape = 3.4 + 1.3 * h(); }
      if (wispy) { bh *= 1.9 + 0.7 * h(); bw *= 0.55; shape = 1.5 + 0.4 * h(); }
      const leanDir = angle + (total > 1 ? e / (total - 1) - 0.5 : 0) * 2.4;
      const leanAmount = lean * (0.3 + 0.7 * radius) * (wispy ? 1.5 : 1) * (0.35 + 0.65 * h());
      const yaw = (h() - 0.5) * 0.95;
      iPos.set([spot.x + ox, 0, spot.z + oz], 3 * at);
      iParams.set(stalk ? [1.7 * height + 0.52, 0.42 * width, 0.3 * leanAmount, 6.28 * h()] : [bh, bw, leanAmount, 6.28 * h()], 4 * at);
      iFace.set([Math.cos(yaw), Math.sin(yaw)], 2 * at);
      iLean.set([Math.cos(leanDir), Math.sin(leanDir)], 2 * at);
      iDelay[at] = MathUtils.clamp(delay + 0.04 * h(), 0, 0.75);
      iInk[at] = stalk ? 0 : Math.min(0.999, h() * (0.45 + 0.75 * (1 - radius)));
      iRank[at] = stalk ? 0 : h();
      iShape[at] = stalk ? 2.2 : shape;
      if (stalk) {
        const flowerSize = 0.3 + 0.14 * h();
        flowers.push({ i: at, size: flowerSize, kind: (h() * DAISY_KINDS.length) | 0 });
      }
    }
  }

  // A few loose leaves drifting above the field.
  for (; at < count; at++) {
    const spot = samplePaint(h, paint, inside)!;
    const yaw = (h() - 0.5) * 0.95, dir = h() * Math.PI * 2;
    iPos.set([spot.x, 0.55 + 1.9 * h(), spot.z], 3 * at);
    iParams.set([0.2 + 0.16 * h(), 0.1 + 0.05 * h(), 0.6 + 1.6 * h(), 6.28 * h()], 4 * at);
    iFace.set([Math.cos(yaw), Math.sin(yaw)], 2 * at);
    iLean.set([Math.cos(dir), Math.sin(dir)], 2 * at);
    iDelay[at] = 0.68 + 0.07 * h();
    iInk[at] = 0.6 * h();
    iShape[at] = 3.2 + 1.2 * h();
  }

  const strip = ribbon(10);
  const geo = new InstancedBufferGeometry();
  geo.setAttribute("position", strip.position);
  geo.setIndex(strip.index);
  geo.setAttribute("iPos", new InstancedBufferAttribute(iPos, 3));
  geo.setAttribute("iParams", new InstancedBufferAttribute(iParams, 4));
  geo.setAttribute("iFace", new InstancedBufferAttribute(iFace, 2));
  geo.setAttribute("iLean", new InstancedBufferAttribute(iLean, 2));
  geo.setAttribute("iDelay", new InstancedBufferAttribute(iDelay, 1));
  geo.setAttribute("iInk", new InstancedBufferAttribute(iInk, 1));
  geo.setAttribute("iShape", new InstancedBufferAttribute(iShape, 1));
  geo.setAttribute("iRank", new InstancedBufferAttribute(iRank, 1));
  geo.instanceCount = count;

  const material = new ShaderMaterial({
    uniforms: {
      uTime: m.uTime, uWind: m.uWind, uGrow: m.uGrow, uCrop: m.uCrop, uLine: m.uLine,
      uInkAmount: m.uInkAmount, uInkColor: m.uInkColor, uWidth: m.uWidth, uGust: m.uGust,
      uWindDir: m.uWindDir, uBall: m.uBall, uTrail: m.uTrail, uGrassDepth: m.uGrassDepth,
      uDensity: m.uDensity, uCullPad: m.uCullPad,
      ...lightSlots(m), ...shadowSlots(m), ...fieldSlots(bake),
    },
    vertexShader: BLADE_VERT,
    fragmentShader: BLADE_FRAG,
    side: DoubleSide,
  });
  const mesh = new Mesh(geo, material);
  mesh.frustumCulled = false;
  const group = new Group();
  group.add(mesh);
  return { group, flowers, data: { iPos, iParams, iLean, iDelay } };
}

/** Where a blade's tip is right now: the CPU twin of the vertex shader, for flower heads. */
export function makeTipOf(blades: Blades, m: Uniforms, hillsAt: (x: number, z: number) => number) {
  const push = new Vector3();
  const fbm = (x: number, z: number) =>
    0.58 * vnoise(x, z) + 0.28 * vnoise(2.13 * x + 3.7, 2.13 * z + 3.7) + 0.14 * vnoise(4.37 * x + 11.2, 4.37 * z + 11.2);
  return (i: number, time: number) => {
    const { iPos, iParams, iLean, iDelay } = blades.data;
    const x = iPos[3 * i], z = iPos[3 * i + 2];
    const y = iPos[3 * i + 1] + hillsAt(x, z);
    const height = iParams[4 * i], lean = iParams[4 * i + 2], phase = iParams[4 * i + 3];
    let g = MathUtils.clamp((m.uGrow.value - iDelay[i]) / 0.32, 0, 1);
    g = g * g * (3 - 2 * g);
    const wind = m.uWindDir.value;
    push.set(iLean[2 * i] * lean, 0, iLean[2 * i + 1] * lean);
    const wave = 2 * fbm(0.13 * x - wind.x * time * 1.15, 0.13 * z - wind.y * time * 1.15) - 1;
    const strength = m.uWind.value;
    const flutter = 0.09 * Math.sin(3.3 * time + 2.1 * phase);
    const force = Math.max(0, strength * (0.42 + m.uGust.value * wave) + flutter * strength);
    push.x += wind.x * force;
    push.z += wind.y * force;
    let squash = 0;
    const ball = m.uBall.value;
    if (ball.w > 0) {
      const dx = x - ball.x, dz = z - ball.z, dist = Math.hypot(dx, dz) || 0.001;
      const k = 1 - MathUtils.smoothstep(dist, 0.5 * ball.w, 2.1 * ball.w);
      push.x += (dx / dist) * k * 1.7;
      push.z += (dz / dist) * k * 1.7;
      squash = k;
    }
    const tipHeight = height * g * m.uCrop.value * (1 - 0.6 * MathUtils.clamp(squash, 0, 1));
    const over = Math.min(push.lengthSq(), 2);
    return { x: x + push.x * tipHeight, y: y + tipHeight * (1 - 0.18 * over), z: z + push.z * tipHeight };
  };
}
