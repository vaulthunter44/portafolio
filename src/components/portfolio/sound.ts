// A soft key-tick for the typing animation. Browsers only allow audio after a
// gesture, so the context is created on the first pointer/key/touch.

const GESTURES = ["pointerdown", "keydown", "touchstart"] as const;
let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let armed = false;

function unlock() {
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx = new Ctor();
  }
  ctx.resume().then(() => {
    if (ctx?.state === "running") for (const g of GESTURES) removeEventListener(g, unlock);
  }).catch(() => {});
}

export function armSound(signal: AbortSignal) {
  if (armed) return;
  armed = true;
  for (const g of GESTURES) addEventListener(g, unlock, { passive: true, signal });
  signal.addEventListener("abort", () => { armed = false; }, { once: true });
}

export function tick() {
  if (!ctx || ctx.state !== "running") return;
  const now = ctx.currentTime;
  if (!noise) {
    const length = Math.floor(0.035 * ctx.sampleRate);
    noise = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (2 * Math.random() - 1) * (1 - i / length);
  }
  const source = ctx.createBufferSource();
  source.buffer = noise;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 1650 + 900 * Math.random();
  band.Q.value = 0.9;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.05, now);
  gain.gain.exponentialRampToValueAtTime(1e-4, now + 0.035);
  source.connect(band).connect(gain).connect(ctx.destination);
  source.start(now);
  source.stop(now + 0.04);
}
