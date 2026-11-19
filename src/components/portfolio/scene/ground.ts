import { DoubleSide, Mesh, PlaneGeometry, ShaderMaterial } from "three";
import { FIELD_GLSL, LIGHT_GLSL, NOISE_GLSL, SHADOW_GLSL } from "./glsl";
import { fieldSlots, type FieldBake } from "./field-bake";
import type { Paint } from "./field";
import { lightSlots, shadowSlots, type Uniforms } from "./uniforms";

const GROUND_VERT = /* glsl */ `
  varying vec2 vXZ;
  ${FIELD_GLSL}
  void main(){
    vXZ = position.xz;
    gl_Position = projectionMatrix * modelViewMatrix
      * vec4(position + vec3(0.0, fieldAt(vXZ).a, 0.0), 1.0);
  }
`;

const GROUND_FRAG = /* glsl */ `
  uniform sampler2D uPaint;
  uniform float uExtent, uReveal, uEdge;
  uniform vec3  uInkColor;
  varying vec2  vXZ;
  ${NOISE_GLSL}
  ${FIELD_GLSL}
  ${LIGHT_GLSL}
  ${SHADOW_GLSL}
  void main(){
    vec4 p = texture2D(uPaint, vXZ / uExtent + 0.5);

    // Only the rim dissolves: p.b is the blurred "how far inside".
    float rim = 1.0 - smoothstep(0.0, 0.30, p.b);
    rim *= rim;

    // Coastline raggedness at three scales; the fastest breaks the edge into flecks.
    float coast = (fbm(vXZ * 0.55)   - 0.5) * 0.36
                + (fbm(vXZ * 1.90)   - 0.5) * 0.30
                + (vnoise(vXZ * 6.2) - 0.5) * 0.22;
    float wobble = (fbm(vXZ * 2.1) - 0.5) * 0.09;
    float e = p.r + wobble + coast * rim;
    if (e < 0.5) discard;
    if ((1.0 - p.b) > uReveal) discard;   // the reveal spreads outwards from the middle

    if ((e - 0.5) < fwidth(e) * uEdge) {   // optional ink contour, in screen pixels
      gl_FragColor = vec4(uInkColor, 1.0);
    } else {
      vec3 c = fieldAt(vXZ).rgb;
      c = tone(c, uShadeColor, castShadow(vXZ));
      gl_FragColor = vec4(c, 1.0);
    }
    #include <colorspace_fragment>
  }
`;

export function buildGround(paint: Paint, m: Uniforms, bake: FieldBake) {
  const geometry = new PlaneGeometry(paint.extent, paint.extent, 160, 160);
  geometry.rotateX(-Math.PI / 2);
  const mesh = new Mesh(
    geometry,
    new ShaderMaterial({
      uniforms: {
        uPaint: { value: paint.tex },
        uExtent: { value: paint.extent },
        uReveal: m.uReveal,
        uEdge: m.uEdge,
        uInkColor: m.uInkColor,
        ...lightSlots(m),
        ...shadowSlots(m),
        ...fieldSlots(bake),
      },
      vertexShader: GROUND_VERT,
      fragmentShader: GROUND_FRAG,
      side: DoubleSide,
    }),
  );
  mesh.frustumCulled = false;
  return mesh;
}
