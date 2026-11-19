import {
  BufferAttribute, DoubleSide, MathUtils, Mesh, PlaneGeometry, SRGBColorSpace, ShaderMaterial, TextureLoader,
  Vector2, type Scene, type Texture,
} from "three";
import { REDUCED } from "./uniforms";
import type { Turntable } from "./turntable";
import { ART, CHAPTER_ART, CHAPTER_SCENES, SITUATIONS, type Situation } from "../scenes";

/** Gaussian reach of each landmark, in UV units. */
const LANDMARK_REACH = [0.18, 0.17, 0.2, 0.14, 0.19];

const MORPH_VERT = /* glsl */ `
  attribute vec2 targetUV;
  uniform float progress;
  uniform vec2 grounds;
  uniform float direction;
  varying vec2 uvA;
  varying vec2 uvB;
  varying float blendAt;
  void main() {
    uvA = uv;
    uvB = targetUV;
    // A wave crosses the sheet in the turning direction.
    float delay = (direction > 0.0 ? uv.x : 1.0 - uv.x) * 0.06;
    float t = smoothstep(delay, 0.94 + delay, progress);
    blendAt = t;
    vec2 movingUV = mix(uv, targetUV, t);
    vec3 p = vec3((movingUV - 0.5) * vec2(12.0, 8.0), 0.0);
    p.y += mix(grounds.x, grounds.y, t) * 8.0;
    // The sheet bows slightly mid-change, like paper being turned.
    float arc = sin(t * 3.14159265);
    p.x += direction * arc * 0.26 * sin(uv.y * 3.14159265);
    p.y += arc * 0.06;
    p.z += arc * 0.24 * sin(uv.x * 3.14159265);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const MORPH_FRAG = /* glsl */ `
  uniform sampler2D mapA;
  uniform sampler2D mapB;
  uniform float opacity;
  uniform float light;
  varying vec2 uvA;
  varying vec2 uvB;
  varying float blendAt;
  // The art is painted on magenta: key it out and pull the fringe back to neutral.
  vec4 cutout(sampler2D source, vec2 uv) {
    vec4 pixel = texture2D(source, uv);
    float key = min(pixel.r, pixel.b) - pixel.g;
    float a = (1.0 - smoothstep(0.12, 0.42, key)) * pixel.a;
    vec3 clean = mix(pixel.rgb, vec3(pixel.r, pixel.g, min(pixel.b, pixel.g)), 1.0 - a);
    return vec4(clean * a, a);
  }
  void main() {
    vec4 a = cutout(mapA, uvA);
    vec4 b = cutout(mapB, uvB);
    float paint = smoothstep(0.24, 0.76, blendAt);
    vec4 ink = mix(a, b, paint);   // premultiplied, so no magenta creeps in
    vec3 color = ink.rgb / max(ink.a, 0.001);
    float body = sin(paint * 3.14159265);   // keep the mass solid mid-morph
    float alpha = mix(ink.a, max(a.a, b.a), body * body * 0.88);
    alpha *= opacity;
    if (alpha < 0.04) discard;
    gl_FragColor = vec4(color * light, alpha);
    #include <colorspace_fragment>
  }
`;

type Loaded = Situation & { texture: Texture; ready: boolean };

/** The illustrated sheet standing in the field, morphing from one situation to the next. */
export function makeSituations(scene: Scene, hillsAt: (x: number, z: number) => number) {
  let disposed = false;
  let progress = 0;
  let ready = 0;          // the latest situation whose texture has arrived
  let from = 0, to = 0;
  let pendingDir = 1, dir = 1;
  let lastIndex = 0;
  const loader = new TextureLoader();
  // The scenes first, then the chapter objects the tour shows.
  const sources = [...SITUATIONS.map((s) => ({ ...s, src: ART + s.src })), ...CHAPTER_SCENES.map((s) => ({ ...s, src: CHAPTER_ART + s.src }))];
  const items: Loaded[] = sources.map((s) => {
    const item = { ...s, ready: false } as Loaded;
    item.texture = loader.load(s.src, () => { if (!disposed) item.ready = true; });
    item.texture.colorSpace = SRGBColorSpace;
    return item;
  });

  const geometry = new PlaneGeometry(12, 8, 100, 68);
  const uv = geometry.getAttribute("uv");
  const target = new BufferAttribute(new Float32Array(uv.array), 2);
  geometry.setAttribute("targetUV", target);

  // Bend the UVs so the landmarks of A slide towards those of B (capped by morphTravel).
  function mapLandmarks(a: Situation, b: Situation) {
    for (let v = 0; v < uv.count; v++) {
      const x = uv.getX(v), y = uv.getY(v);
      let dx = 0, dy = 0, weight = 0;
      for (let k = 0; k < LANDMARK_REACH.length; k++) {
        const la = a.landmarks[k], lb = b.landmarks[k];
        const w = Math.exp(-((x - la[0]) ** 2 + (y - la[1]) ** 2) / (LANDMARK_REACH[k] * LANDMARK_REACH[k] * 0.5));
        const cap = Math.min(1, Math.min(a.morphTravel ?? 0.08, b.morphTravel ?? 0.08) / Math.max(0.001, Math.hypot(lb[0] - la[0], lb[1] - la[1])));
        dx += (lb[0] - la[0]) * w * cap;
        dy += (lb[1] - la[1]) * w * cap;
        weight += w;
      }
      const edge = Math.min(1, 12 * Math.min(x, y, 1 - x, 1 - y));
      target.setXY(v, x + (dx / Math.max(1, weight)) * edge, y + (dy / Math.max(1, weight)) * edge);
    }
    target.needsUpdate = true;
  }

  const material = new ShaderMaterial({
    uniforms: {
      mapA: { value: items[0].texture },
      mapB: { value: items[1].texture },
      progress: { value: 0 },
      grounds: { value: new Vector2(items[0].ground, items[0].ground) },
      opacity: { value: 0 },
      light: { value: 1 },
      direction: { value: 1 },
    },
    transparent: true,
    depthWrite: true,
    side: DoubleSide,
    vertexShader: MORPH_VERT,
    fragmentShader: MORPH_FRAG,
  });
  const mesh = new Mesh(geometry, material);

  function begin(a: number, b: number) {
    from = a;
    to = b;
    progress = 0;
    dir = pendingDir;
    mapLandmarks(items[a], items[b]);
    material.uniforms.mapA.value = items[a].texture;
    material.uniforms.mapB.value = items[b].texture;
    material.uniforms.grounds.value.set(items[a].ground, items[b].ground);
  }

  mesh.visible = false;
  mesh.frustumCulled = false;
  scene.add(mesh);
  begin(0, 0);

  return {
    nameAt: (i: number) => SITUATIONS[((i % SITUATIONS.length) + SITUATIONS.length) % SITUATIONS.length].name,
    setLight(night: number) {
      material.uniforms.light.value = 1 - 0.64 * night;
    },
    /** `chapter` is set during the tour: show that chapter's object rather than the scene. */
    update(table: Turntable, dt: number, grow: number, chapter: number | null) {
      const scenes = SITUATIONS.length;
      const wanted = chapter === null ? ((table.index % scenes) + scenes) % scenes : scenes + chapter;
      if (table.index !== lastIndex) {
        pendingDir = Math.sign(table.index - lastIndex);
        lastIndex = table.index;
      }
      if (items[wanted].ready) ready = wanted;
      if (REDUCED) {
        if (from !== ready || to !== ready) begin(ready, ready);
      } else {
        if (from === to && ready !== from) begin(from, ready);
        if (from !== to) {
          // Head for B, or back to A if the visitor turned back mid-change.
          const goal = ready !== from ? 1 : 0;
          const speed = (Math.min(dt, 0.05) * (ready !== from && ready !== to ? 2.5 : 1)) / 0.42;
          progress = MathUtils.clamp(progress + Math.sign(goal - progress) * speed, Math.min(goal, progress), Math.max(goal, progress));
          if (progress === goal) {
            const settled = goal === 0 ? from : to;
            begin(settled, settled);
            if (ready !== settled) begin(settled, ready);
          }
        }
      }
      material.uniforms.progress.value = progress;
      material.uniforms.direction.value = dir;
      material.uniforms.opacity.value = Math.min(1, grow);
      mesh.visible = items[from].ready;

      // Stand 1.5 units towards the camera, facing it, on the hill.
      const x = 1.5 * Math.cos(table.azimuth), z = 1.5 * Math.sin(table.azimuth);
      mesh.rotation.y = Math.PI / 2 - table.azimuth;
      mesh.position.set(x, hillsAt(x, z), z);
    },
    dispose() {
      disposed = true;
      scene.remove(mesh);
      for (const item of items) item.texture.dispose();
      material.dispose();
      geometry.dispose();
    },
  };
}
