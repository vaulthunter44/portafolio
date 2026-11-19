import {
  HalfFloatType, LinearFilter, Mesh, NoColorSpace, OrthographicCamera, PlaneGeometry, RGBAFormat,
  Scene, ShaderMaterial, WebGLRenderTarget, type WebGLRenderer,
} from "three";
import { FIELD_GLSL, HILLS_GLSL, HILL_SHADOW_GLSL, LIGHT_GLSL, NOISE_GLSL } from "./glsl";
import { hillSlots, lightSlots, type Uniforms } from "./uniforms";

const BAKE_VERT = /* glsl */ `
  varying vec2 vXZ;
  uniform float uFieldExtent;
  void main(){
    vXZ = (uv - 0.5) * uFieldExtent;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// Ground colour after wash, patches, sun, slope and the hills' own shadow; alpha is height.
const BAKE_FRAG = /* glsl */ `
  uniform vec3  uGrass, uGrassPale, uGrassDeep, uWarm, uCold;
  uniform float uVary, uPatch, uRelief;
  uniform float uShadowAmount;
  varying vec2  vXZ;
  ${NOISE_GLSL}
  ${HILLS_GLSL}
  ${LIGHT_GLSL}
  ${HILL_SHADOW_GLSL}
  void main(){
    float h = hillsAt(vXZ);
    vec3 c = washAt(vXZ, uGrass, uGrassPale, uGrassDeep, uVary);
    c = patchAt(vXZ, c, uWarm, uCold, uPatch);
    c = sunTone(c, vec3(0.0, 1.0, 0.0));
    c = reliefTone(c, hillNormal(vXZ, h), uSunAmount * uRelief);
    c = tone(c, uShadeColor, hillShadow(vXZ, h, uSunDir) * uShadowAmount);
    gl_FragColor = vec4(c, h);
  }
`;

const SCALARS = ["uHills", "uHillSize", "uSunAmount", "uSunEdge", "uShadowAmount", "uShadowSoft", "uVary", "uPatch"] as const;
const COLOURS = ["uGrass", "uGrassPale", "uGrassDeep", "uWarm", "uCold", "uSunColor", "uShadeColor"] as const;

export type FieldBake = ReturnType<typeof makeFieldBake>;

/**
 * Everything about the ground that does not move, rendered once into a texture
 * and re-rendered only when an input changes (the sun follows the camera).
 */
export function makeFieldBake(m: Uniforms, extent: number, relief: number) {
  const target = new WebGLRenderTarget(1024, 1024, {
    type: HalfFloatType, format: RGBAFormat, minFilter: LinearFilter, magFilter: LinearFilter,
    depthBuffer: false, generateMipmaps: false,
  });
  target.texture.colorSpace = NoColorSpace;

  const material = new ShaderMaterial({
    uniforms: {
      uGrass: m.uGrass, uGrassPale: m.uGrassPale, uGrassDeep: m.uGrassDeep, uWarm: m.uWarm, uCold: m.uCold,
      uVary: m.uVary, uPatch: m.uPatch, uRelief: { value: relief }, uFieldExtent: { value: extent },
      ...lightSlots(m), ...hillSlots(m), uShadowAmount: m.uShadowAmount, uShadowSoft: m.uShadowSoft,
    },
    vertexShader: BAKE_VERT,
    fragmentShader: BAKE_FRAG,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new Mesh(new PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const scene = new Scene();
  scene.add(quad);
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let lastKey: string | null = null;

  const key = () => {
    const parts: (number | string)[] = [m.uHillSeed.value.x, m.uHillSeed.value.y, ...m.uSunDir.value.toArray(), material.uniforms.uRelief.value];
    for (const k of SCALARS) parts.push(m[k].value);
    for (const k of COLOURS) parts.push(m[k].value.getHex());
    return parts.join(",");
  };

  return {
    texture: target.texture,
    extent,
    set relief(v: number) { material.uniforms.uRelief.value = v; },
    ensure(renderer: WebGLRenderer) {
      const k = key();
      if (k === lastKey) return false;
      lastKey = k;
      const previous = renderer.getRenderTarget();
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      renderer.setRenderTarget(previous);
      return true;
    },
    dispose() {
      target.dispose();
      material.dispose();
      quad.geometry.dispose();
    },
  };
}

export const fieldSlots = (bake: FieldBake) => ({
  uField: { value: bake.texture },
  uFieldExtent: { value: bake.extent },
});

export { FIELD_GLSL };
