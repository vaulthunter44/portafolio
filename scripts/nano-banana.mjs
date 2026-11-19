// Shared by the scene scripts: one call to Nano Banana (Gemini's image model)
// with your own Google project's key, and the background cut-out.
//
// The key is read from GEMINI_API_KEY (or GOOGLE_API_KEY), in .env.local or the
// environment. GEMINI_IMAGE_MODEL picks another model (e.g. a Nano Banana Pro id).
// Vertex AI keys (they start with "AQ.") go to Vertex, in VERTEX_LOCATION
// (us-central1 by default); AI Studio keys go to the Gemini API.

import { readFileSync, writeFileSync } from "node:fs";

try { process.loadEnvFile(".env.local"); } catch {}

const KEY = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
const MODEL = process.env.GEMINI_IMAGE_MODEL ?? "gemini-2.5-flash-image";
const ENDPOINT = KEY?.startsWith("AQ.")
  ? `https://${process.env.VERTEX_LOCATION ?? "us-central1"}-aiplatform.googleapis.com/v1/publishers/google/models/${MODEL}:generateContent`
  : `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export function requireKey() {
  if (KEY) return;
  console.error("Add GEMINI_API_KEY=… to .env.local (the key of your Google project) and run again.");
  process.exit(1);
}

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A local picture as a request part, shrunk so photos from a phone stay small. */
export async function imagePart(file, longest = 1536) {
  const { default: sharp } = await import("sharp");
  const data = await sharp(readFileSync(file)).rotate().resize(longest, longest, { fit: "inside", withoutEnlargement: true }).png().toBuffer();
  return { inlineData: { mimeType: "image/png", data: data.toString("base64") } };
}

/**
 * Asks for one 3:2 picture from text and reference images, and saves it as
 * `${base}.png` (or .jpg). Vertex allows only a few image requests a minute,
 * so a 429 backs off and tries again.
 */
export async function paint(parts, base, attempt = 0) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": KEY },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "3:2" } },
    }),
  });
  const json = await res.json();
  if (res.status === 429 && attempt < 5) {
    const seconds = 20 * (attempt + 1);
    console.log(`  … rate limited, retrying ${base} in ${seconds}s`);
    await wait(seconds * 1000);
    return paint(parts, base, attempt + 1);
  }
  if (!res.ok) throw new Error(json.error?.message ?? `HTTP ${res.status}`);
  const image = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
  if (!image) throw new Error(`no image in the reply (${json.candidates?.[0]?.finishReason ?? "no candidates"})`);
  const file = `${base}.${image.mimeType.split("/")[1].replace("jpeg", "jpg")}`;
  writeFileSync(file, Buffer.from(image.data, "base64"));
  return file;
}

// Colour distance from the background at which a pixel starts to show, and is fully solid.
const NEAR = 28, FAR = 64;

/**
 * Nano Banana paints the "magenta" as a textured pink, which the page's key
 * would leave as a haze. Cut it out here instead: find the background colour
 * on the border, fade pixels in by their distance from it, and pull the pink
 * out of the soft edges. The page uses the alpha as it is.
 */
export async function cutout(from, to) {
  const { default: sharp } = await import("sharp");
  const { data, info } = await sharp(from).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const border = [];
  for (let x = 0; x < width; x += 4) border.push(x, x + (height - 1) * width);
  for (let y = 0; y < height; y += 4) border.push(y * width, y * width + width - 1);
  const median = (c) => border.map((p) => data[p * 3 + c]).sort((a, b) => a - b)[border.length >> 1];
  const bg = [median(0), median(1), median(2)];
  const out = Buffer.alloc(width * height * 4);
  for (let p = 0; p < width * height; p++) {
    const rgb = [data[p * 3], data[p * 3 + 1], data[p * 3 + 2]];
    const t = Math.min(1, Math.max(0, (Math.hypot(rgb[0] - bg[0], rgb[1] - bg[1], rgb[2] - bg[2]) - NEAR) / (FAR - NEAR)));
    const a = t * t * (3 - 2 * t);
    for (let c = 0; c < 3; c++) out[p * 4 + c] = a > 0 ? Math.min(255, Math.max(0, Math.round((rgb[c] - (1 - a) * bg[c]) / a))) : 0;
    out[p * 4 + 3] = Math.round(a * 255);
  }
  await sharp(out, { raw: { width, height, channels: 4 } }).png().toFile(to);
  return bg;
}
