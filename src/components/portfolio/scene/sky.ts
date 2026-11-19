import { Color, Mesh, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, Vector2, WebGLRenderer } from "three";
import { NOISE_GLSL } from "./glsl";
import { blend, type Drivers } from "../theme";

// A watercolour sky, painted in a shader like the river and the grass. It has
// its own canvas behind the title (the field's canvas sits in front of it).

const PALETTES = {
  day: { top: "#9ec4dd", horizon: "#f8e9d4", cloud: "#fffdf6", shade: "#c5d0db", ink: "#6b8aa3" },
  dusk: { top: "#b98aa8", horizon: "#f7c48e", cloud: "#ffe6c7", shade: "#d39b8f", ink: "#7a4a58" },
  night: { top: "#0d1626", horizon: "#26304a", cloud: "#2f3a4f", shade: "#1a2233", ink: "#070b12" },
};
const KEYS = ["top", "horizon", "cloud", "shade", "ink"] as const;

const SKY_VERT = /* glsl */ `
  void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const SKY_FRAG = /* glsl */ `
  uniform vec2  uRes;
  uniform float uTime, uAz, uNight;
  uniform vec3  uTop, uHorizon, uCloud, uShade, uInk;
  ${NOISE_GLSL}

  // The shared sin() hash loses precision at the large coordinates the high
  // octaves and the pixel grain reach, which drew streaks; wrap the lattice first.
  float hashS(vec2 i){ i = mod(i, 289.0); return fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoiseS(vec2 p){
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hashS(i), hashS(i + vec2(1.0, 0.0)), u.x),
               mix(hashS(i + vec2(0.0, 1.0)), hashS(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm5(vec2 p){
    float a = 0.5, s = 0.0;
    for (int i = 0; i < 5; i++) { s += a * vnoiseS(p); p = p * 2.03 + 17.1; a *= 0.5; }
    return s;
  }

  void main(){
    vec2 uv = gl_FragCoord.xy / uRes;            // 0 at the horizon, 1 at the top
    vec2 p = vec2(uv.x * uRes.x / uRes.y, uv.y);  // square units
    float drift = uAz * 0.35 + uTime * 0.006;     // turning the field nudges the sky

    // the wash: horizon to zenith, laid unevenly the way pigment settles
    float pigment = fbm5(p * 2.2 + vec2(drift * 0.4, 0.0));
    vec3 col = mix(uHorizon, uTop, clamp(smoothstep(0.02, 1.0, uv.y) + (pigment - 0.5) * 0.4, 0.0, 1.0));

    // blooms: paler patches where water ran back into the wet wash, with the
    // darker pigment line that collects at their edge
    float b = fbm5(p * 1.3 + vec2(7.3 + drift * 0.2, 2.1));
    col = mix(col, min(col * 1.22, vec3(1.0)), smoothstep(0.56, 0.72, b) * 0.65);
    col *= mix(0.93, 1.0, smoothstep(0.0, 0.035, abs(b - 0.6)));

    // clouds: stretched noise, fuller in the middle band, flatter underneath
    vec2 cp = vec2(p.x * 0.9 + drift, p.y * 2.1) * 1.6;
    float shape = fbm5(cp * 2.0);
    float band = smoothstep(0.12, 0.42, uv.y) * (1.0 - smoothstep(0.82, 1.0, uv.y));
    float c = shape + band * 0.2 - 0.66 + (vnoiseS(cp * 14.0) - 0.5) * 0.05;
    float cloud = smoothstep(0.0, 0.025, c);
    float under = clamp((fbm5(cp * 2.0 - vec2(0.0, 0.07)) - shape) * 6.0, 0.0, 1.0);
    vec3 cc = mix(uCloud, uShade, under * 0.7 + (1.0 - smoothstep(0.0, 0.2, c)) * 0.35);
    cc *= mix(0.965, 1.02, fbm5(cp * 5.0 + 9.0));   // uneven paint inside the cloud
    col = mix(col, cc, cloud);

    // a broken ink line round the clouds, the same weight as the grass outlines
    float w = max(fwidth(c), 1e-4);
    float line = 1.0 - smoothstep(w * 0.6, w * 1.7, abs(c));
    col = mix(col, uInk, line * smoothstep(0.42, 0.62, vnoiseS(cp * 3.1 + 2.0)) * 0.6);

    // stars, only at night and only in clear sky
    vec2 cell = floor(gl_FragCoord.xy / 3.0);
    float star = step(0.9975, hashS(cell)) * (0.65 + 0.35 * sin(uTime * 2.0 + hashS(cell + 3.0) * 30.0));
    col = mix(col, vec3(1.0, 0.97, 0.9), star * uNight * (1.0 - cloud) * smoothstep(0.3, 0.8, uv.y));

    // paper grain, proportional to the paint so dark skies stay quiet
    col *= 1.0 + (hashS(gl_FragCoord.xy) - 0.5) * 0.05 + (vnoiseS(gl_FragCoord.xy * 0.35) - 0.5) * 0.05;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export type Sky = ReturnType<typeof makeSky>;

export function makeSky(container: HTMLElement) {
  const renderer = new WebGLRenderer({ antialias: false, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  container.appendChild(renderer.domElement);
  const colours = Object.fromEntries(KEYS.map((k) => [k, new Color()])) as Record<(typeof KEYS)[number], Color>;
  const palettes = Object.fromEntries(
    Object.entries(PALETTES).map(([name, p]) => [name, Object.fromEntries(KEYS.map((k) => [k, new Color(p[k])]))]),
  ) as Record<keyof typeof PALETTES, Record<(typeof KEYS)[number], Color>>;
  const material = new ShaderMaterial({
    uniforms: {
      uRes: { value: new Vector2(1, 1) },
      uTime: { value: 0 },
      uAz: { value: 0 },
      uNight: { value: 0 },
      uTop: { value: colours.top },
      uHorizon: { value: colours.horizon },
      uCloud: { value: colours.cloud },
      uShade: { value: colours.shade },
      uInk: { value: colours.ink },
    },
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new Mesh(new PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const scene = new Scene();
  scene.add(quad);
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  return {
    resize() {
      const w = container.clientWidth, h = container.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      renderer.getDrawingBufferSize(material.uniforms.uRes.value);
    },
    setLight(d: Drivers) {
      for (const k of KEYS) {
        const c = colours[k];
        c.r = blend(palettes.day[k].r, palettes.dusk[k].r, palettes.night[k].r, d);
        c.g = blend(palettes.day[k].g, palettes.dusk[k].g, palettes.night[k].g, d);
        c.b = blend(palettes.day[k].b, palettes.dusk[k].b, palettes.night[k].b, d);
      }
      material.uniforms.uNight.value = d.night;
    },
    render(time: number, azimuth: number) {
      material.uniforms.uTime.value = time;
      material.uniforms.uAz.value = azimuth;
      renderer.render(scene, camera);
    },
    dispose() {
      material.dispose();
      quad.geometry.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
