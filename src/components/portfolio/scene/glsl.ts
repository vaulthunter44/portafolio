// Shared GLSL chunks for the field. Every shader that needs ground colour, hills or
// light pulls from here so the ground, the blades and the bake agree to the bit.

export const NOISE_GLSL = /* glsl */ `
  float hash21(vec2 p){
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }
  float vnoise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
               mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p){
    return 0.58 * vnoise(p) + 0.28 * vnoise(p * 2.13 + 3.7) + 0.14 * vnoise(p * 4.37 + 11.2);
  }

  // Broad tonal wash between the deep and pale greens.
  vec3 washAt(vec2 xz, vec3 base, vec3 pale, vec3 deep, float amount){
    float n = fbm(xz * 0.34);
    return mix(base, mix(deep, pale, smoothstep(0.24, 0.76, n)), amount);
  }

  // Small strong patches (warm or cool) that only appear on the noise peaks.
  vec3 patchAt(vec2 xz, vec3 c, vec3 warm, vec3 cold, float amount){
    float m = fbm(xz * 1.05 + 21.7);
    float here = smoothstep(0.58, 0.79, m);
    float side = smoothstep(0.42, 0.58, fbm(xz * 0.17 + 5.1));
    return mix(c, mix(cold, warm, side), here * amount);
  }
`;

export const HILLS_GLSL = /* glsl */ `
  uniform float uHills, uHillSize;
  uniform vec2  uHillSeed;

  // Height in world units; uHills is the amplitude of a hill.
  float hillsAt(vec2 xz){
    if (uHills <= 0.0) return 0.0;
    vec2 p = xz / max(uHillSize, 0.5) + uHillSeed;
    return (vnoise(p) * 0.72 + vnoise(p * 2.31 + 5.1) * 0.28 - 0.5) * 4.0 * uHills;
  }

  vec3 hillNormal(vec2 xz, float h0){
    if (uHills <= 0.0) return vec3(0.0, 1.0, 0.0);
    float d = max(uHillSize, 0.5) * 0.08;
    return normalize(vec3(h0 - hillsAt(xz + vec2(d, 0.0)), d, h0 - hillsAt(xz + vec2(0.0, d))));
  }
`;

export const HILL_SHADOW_GLSL = /* glsl */ `
  // March towards the sun and report how far the terrain rises above the ray.
  float hillShadow(vec2 xz, float h0, vec3 sunDir){
    if (uHills <= 0.0) return 0.0;
    float run = max(length(sunDir.xz), 1e-3);
    vec2  dir = sunDir.xz / run;
    float climb = sunDir.y / run;
    float reach = min(uHills * 3.0 / max(climb, 0.12), uHillSize * 2.5);
    float s = 0.0;
    for (int k = 1; k <= 10; k++) {
      float d = reach * float(k) * 0.1;
      float over = hillsAt(xz + dir * d) - (h0 + climb * d);
      s = max(s, over / max(uHills, 0.001));
    }
    return clamp(s * 2.5, 0.0, 1.0);
  }
`;

const TONE_GLSL = /* glsl */ `
  vec3 softLight(vec3 b, vec3 s){
    return mix(2.0 * b * s, 1.0 - 2.0 * (1.0 - b) * (1.0 - s), step(0.5, s));
  }
  // Every light/shade adjustment is a soft-light push away from neutral grey.
  vec3 tone(vec3 c, vec3 colour, float amount){
    return softLight(c, mix(vec3(0.5), colour, clamp(amount, 0.0, 1.0)));
  }
`;

export const LIGHT_GLSL = /* glsl */ `
  uniform vec3  uSunDir;
  uniform vec3  uSunColor, uShadeColor;
  uniform float uSunAmount, uSunEdge;
  ${TONE_GLSL}

  // How much more (or less) than flat ground a slope faces the sun.
  vec3 reliefTone(vec3 c, vec3 n, float amount){
    if (amount <= 0.0) return c;
    float rel = dot(normalize(n), uSunDir) - uSunDir.y;
    return tone(c, rel > 0.0 ? uSunColor : uShadeColor, abs(rel) * amount);
  }

  // Two-tone terminator; uSunEdge 1 is a hard edge, 0 a soft gradient.
  vec3 sunTone(vec3 c, vec3 n){
    if (uSunAmount <= 0.0) return c;
    float w = mix(1.0, 0.02, uSunEdge);
    float k = smoothstep(-w, w, dot(normalize(n), uSunDir));
    return tone(c, mix(uShadeColor, uSunColor, k), uSunAmount);
  }
`;

export const SHADOW_GLSL = /* glsl */ `
  uniform vec4  uCasters[16];   // x, height, z, radius (radius 0 = empty slot)
  uniform vec2  uSunSkew;
  uniform float uShadowAmount, uShadowSoft;

  float castShadow(vec2 xz){
    if (uShadowAmount <= 0.0) return 0.0;
    float s = 0.0;
    for (int i = 0; i < 16; i++) {
      vec4 c = uCasters[i];
      vec2 pa = xz - c.xz;
      vec2 ba = uSunSkew * c.y;
      float t = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
      float d = length(pa - ba * t) / max(c.w, 1e-4);
      float here = 1.0 - smoothstep(mix(0.96, 0.05, uShadowSoft), 1.0, d);
      s = max(s, step(1e-4, c.w) * here * mix(1.0, 0.45, t));
    }
    return s * uShadowAmount;
  }
`;

// Reads the baked field texture: rgb = lit ground colour, a = ground height.
export const FIELD_GLSL = /* glsl */ `
  uniform sampler2D uField;
  uniform float uFieldExtent;

  vec4 fieldAt(vec2 xz){
    return texture2D(uField, xz / uFieldExtent + 0.5);
  }
`;
