import { DataTexture, LinearFilter, MathUtils, NoColorSpace, RGBAFormat } from "three";
import { PAINT_EXTENT, mulberry32, vnoise, type Uniforms } from "./uniforms";

type Rng = () => number;

export type Island = {
  cx: number;
  cz: number;
  r: number;
  radiusAt: (angle: number) => number;
  fray: (x: number, z: number) => number;
};

/** A blobby island outline: a circle with a few sine harmonics on its radius. */
function makeIsland(rng: Rng, cx: number, cz: number, r: number, octaves = 4, fray?: (x: number, z: number) => number): Island {
  const waves: { f: number; a: number; p: number }[] = [];
  for (let t = 0; t < octaves; t++) {
    const f = 2 + 2 * t + (rng() < 0.5 ? 1 : 0);
    const a = (0.11 / Math.pow(t + 1, 1.7)) * (0.6 + 0.8 * rng());
    waves.push({ f, a, p: rng() * Math.PI * 2 });
  }
  for (let t = 0; t < 2; t++) {
    const f = 7 + Math.floor(7 * rng());
    const a = 0.03 + 0.032 * rng();
    waves.push({ f, a, p: rng() * Math.PI * 2 });
  }
  const scale = 1 / Math.max(r, 4);
  return {
    cx, cz, r,
    radiusAt: (angle) => {
      let k = 0;
      for (const w of waves) k += w.a * Math.sin(angle * w.f + w.p);
      return r * (1 + k);
    },
    fray: fray ? (x, z) => fray(x, z) * scale : () => 0,
  };
}

export type Field = ReturnType<typeof makeField>;

/** The island layout and the density map the blades are scattered by. */
export function makeField(seed: number) {
  const rng = mulberry32(seed);
  const cellHash = (x: number, y: number) => {
    let n = (Math.imul(x, 0x165667b1) + Math.imul(y, 0x27d4eb2f) + 0x4bf19f61 * seed) | 0;
    n = Math.imul(n ^ (n >>> 13), 0x4bf19f61);
    return ((n ^ (n >>> 16)) >>> 0) / 0x100000000;
  };
  const cellNoise = (x: number, y: number) => {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const a = cellHash(ix, iy), b = cellHash(ix + 1, iy), c = cellHash(ix, iy + 1), d = cellHash(ix + 1, iy + 1);
    const top = a + (b - a) * sx;
    return top + fy * fy * (3 - 2 * fy) * (c + (d - c) * sx - top);
  };
  const fray = (x: number, z: number) =>
    (cellNoise(0.125 * x, 0.125 * z) - 0.5) * 2.3 +
    (cellNoise(0.34 * x + 17, 0.34 * z + 17) - 0.5) * 1.4 +
    (cellNoise(0.66 * x + 40, 0.66 * z + 40) - 0.5) * 1.7;

  const islands = [makeIsland(rng, 0, 0, 12, 3, fray)];
  // Satellites are only generated to keep the random sequence identical to the source.
  const satellites = 6 + Math.floor(4 * rng());
  for (let i = 0; i < satellites; i++) {
    const angle = (i / satellites) * Math.PI * 2 + 0.9 * rng();
    const dist = 14.8 + 6.4 * rng();
    const radius = 1.1 + 2.1 * rng();
    islands.push(makeIsland(rng, Math.cos(angle) * dist * 1.15, Math.sin(angle) * dist * 0.8, radius, 2, fray));
  }
  const p1 = 6.28 * rng(), p2 = 6.28 * rng(), p3 = 6.28 * rng();

  return {
    rng,
    islands,
    density: (p: { x: number; z: number; u: number }) => {
      const wave = Math.sin(1.25 * p.x + p1) * Math.cos(1.05 * p.z + p2) + 0.55 * Math.sin((p.x + p.z) * 2.1 + p3);
      return MathUtils.clamp(0.46 + 0.4 * wave + 0.4 * p.u * p.u, 0.18, 1);
    },
  };
}

const N = 1024;
const CELLS = N * N;

export type Sample = { x: number; z: number; y: number; depth: number; thick: number; u: number; zone: number };
export type Paint = ReturnType<typeof makePaint>;
/** Raw access to the mask while it is being seeded, for features that reshape the ground. */
export type PaintCanvas = { data: Uint8Array; size: number; toWorld: (px: number) => number; toPx: (w: number) => number };

/**
 * The ground mask, as a 1024² texture over the 96-unit field:
 * r = coverage, g = thickness (128 = 1), b = blurred depth ("how far inside").
 */
export function makePaint() {
  const data = new Uint8Array(CELLS * 4);
  const depth = new Float32Array(CELLS);
  const blurA = new Float32Array(CELLS);
  const blurB = new Float32Array(CELLS);
  const tex = new DataTexture(data, N, N, RGBAFormat);
  tex.minFilter = tex.magFilter = LinearFilter;
  tex.colorSpace = NoColorSpace;
  tex.needsUpdate = true;

  const toWorld = (px: number) => (px / (N - 1) - 0.5) * PAINT_EXTENT;
  const toPx = (w: number) => MathUtils.clamp((w / PAINT_EXTENT + 0.5) * (N - 1), 0, N - 1);
  let inside: number[] = [], fringe: number[] = [], halo: number[] = [];

  // Three separable box blurs of radius 30 approximate a gaussian falloff.
  function blurDepth() {
    const R = 30, inv = 1 / (2 * R + 1), last = N - 1;
    for (let i = 0; i < CELLS; i++) blurA[i] = MathUtils.smoothstep(data[i * 4] / 255, 0.34, 0.66);
    const col = new Float32Array(64);
    for (let pass = 0; pass < 3; pass++) {
      for (let y = 0; y < N; y++) {
        const row = y * N;
        let sum = 0;
        for (let k = -R; k <= R; k++) sum += blurA[row + (k < 0 ? 0 : k > last ? last : k)];
        for (let x = 0; x < N; x++) {
          blurB[row + x] = sum * inv;
          sum += blurA[row + (x + R < last ? x + R + 1 : last)] - blurA[row + (x > R ? x - R : 0)];
        }
      }
      for (let x0 = 0; x0 < N; x0 += 64) {
        const w = Math.min(64, N - x0);
        col.fill(0, 0, w);
        for (let k = -R; k <= R; k++) {
          const base = (k < 0 ? 0 : k > last ? last : k) * N + x0;
          for (let c = 0; c < w; c++) col[c] += blurB[base + c];
        }
        for (let y = 0; y < N; y++) {
          const at = y * N + x0;
          const add = (y + R < last ? y + R + 1 : last) * N + x0;
          const sub = (y > R ? y - R : 0) * N + x0;
          for (let c = 0; c < w; c++) {
            blurA[at + c] = col[c] * inv;
            col[c] += blurB[add + c] - blurB[sub + c];
          }
        }
      }
    }
    for (let i = 0; i < CELLS; i++) {
      depth[i] = MathUtils.clamp(2.2 * blurA[i], 0, 1);
      data[i * 4 + 2] = Math.round(255 * depth[i]);
    }
  }

  function relax() {
    blurDepth();
    inside = []; fringe = []; halo = [];
    for (let i = 0; i < CELLS; i++) {
      const zone = data[i * 4];
      if (zone > 150) inside.push(i);
      else if (zone > 38) fringe.push(i);
      else if (zone > 3) halo.push(i);
    }
    tex.needsUpdate = true;
  }

  return {
    extent: PAINT_EXTENT,
    tex,
    seed(islands: Island[], shape?: (canvas: PaintCanvas) => void) {
      data.fill(0);
      for (let i = 0; i < CELLS; i++) data[i * 4 + 1] = 128;
      for (const isl of islands) {
        const reach = isl.r * 1.8 + 1.4;
        const x0 = Math.max(0, Math.floor(toPx(isl.cx - reach))), x1 = Math.min(N - 1, Math.ceil(toPx(isl.cx + reach)));
        const z0 = Math.max(0, Math.floor(toPx(isl.cz - reach))), z1 = Math.min(N - 1, Math.ceil(toPx(isl.cz + reach)));
        for (let pz = z0; pz <= z1; pz++) {
          const wz = toWorld(pz), dz = wz - isl.cz;
          for (let px = x0; px <= x1; px++) {
            const wx = toWorld(px), dx = wx - isl.cx;
            const k = Math.hypot(dx, dz) / isl.radiusAt(Math.atan2(dz, dx)) + isl.fray(wx, wz);
            if (k >= 1.44) continue;
            const cover = k <= 0.84 ? 1 : Math.pow(1 - (k - 0.84) / 0.6, 2.6);
            const o = (pz * N + px) * 4;
            data[o] = Math.max(data[o], Math.round(255 * cover));
          }
        }
      }
      shape?.({ data, size: N, toWorld, toPx });
      relax();
    },
    at(x: number, z: number, out = { zone: 0, thick: 0, depth: 0 }) {
      const o = (N * Math.round(toPx(z)) + Math.round(toPx(x))) * 4;
      out.zone = data[o] / 255;
      out.thick = data[o + 1] / 128;
      out.depth = data[o + 2] / 255;
      return out;
    },
    pointAt(index: number, rng: Rng, out = { x: 0, z: 0 }) {
      const px = index % N, pz = (index - px) / N, cell = PAINT_EXTENT / (N - 1);
      out.x = toWorld(px) + (rng() - 0.5) * cell;
      out.z = toWorld(pz) + (rng() - 0.5) * cell;
      return out;
    },
    lists: () => ({ inside, fringe, halo }),
  };
}

/** A random point from one of the paint lists, with the ground facts at it. */
export function samplePaint(rng: Rng, paint: Paint, list: number[]): Sample | null {
  if (!list.length) return null;
  const p = paint.pointAt(list[(rng() * list.length) | 0], rng);
  const g = paint.at(p.x, p.z);
  return { x: p.x, z: p.z, y: 0, depth: g.depth, thick: g.thick, u: 1 - g.depth, zone: g.zone };
}

/** CPU hills, matching HILLS_GLSL. */
export function makeTerrain(m: Uniforms) {
  return {
    hillsAt(x: number, z: number) {
      const amp = m.uHills.value;
      if (amp <= 0) return 0;
      const size = Math.max(m.uHillSize.value, 0.5), seed = m.uHillSeed.value;
      const sx = x / size + seed.x, sz = z / size + seed.y;
      return (0.72 * vnoise(sx, sz) + 0.28 * vnoise(2.31 * sx + 5.1, 2.31 * sz + 5.1) - 0.5) * 4 * amp;
    },
  };
}
