// Puts Erick in the field: draws him in the scenes' style from his photos, then
// repaints each Pikachu scene with him in place of the boy.
//
//   npm run me -- character                 2 character sheets from art/me/photo-* → art/me/character-N
//   npm run me -- scenes --character 1      repaint all 24 scenes with character-1 → art/me/scenes/
//   npm run me -- scenes wet-paint …        only these scenes
//   npm run me -- scenes x --character art/me/scenes/wet-paint.png
//                                           use a good repaint as the reference (fewer stray copies)
//   npm run me -- use                       cut the repaints out into public/portfolio/situations/*-erick.png
//   npm run me -- objects [ids…]            put him with the tour's chapter objects → art/me/objects/
//   npm run me -- use-objects [ids…]        cut those out into public/portfolio/scenes/<chapter>.png
//
// The key and the model are set up in nano-banana.mjs.

import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { cutout, imagePart, paint, requireKey } from "./nano-banana.mjs";

const ME = "art/me";
const REPAINTS = "art/me/scenes";
const WITH_OBJECTS = "art/me/objects";
const DRAFTS = "art/drafts";
const CHAPTER_SCENES = "public/portfolio/scenes";
const SITUATIONS = "public/portfolio/situations";
/** The scene whose boy sets the drawing style of the character sheet. */
const STYLE_SCENE = "robot-inspector";

const LOOK = [
  "Keep his likeness: thick, dark brown, messy wavy hair with a fringe falling over the forehead; warm light-brown skin; dark eyes under thick dark eyebrows; light stubble on the jaw and chin; slim build; no glasses, no hat.",
  "His outfit, exactly as in the photos: an open navy-blue coach jacket with a small white X embroidered on the left chest, a plain white crew-neck t-shirt, black trousers with a black belt, and black shoes.",
].join(" ");

const CHARACTER = [
  "Images 1 and 2 are photos of a young man. Image 3 is an illustration whose drawing style must be matched exactly.",
  "Create a character reference sheet of the young man from the photos, drawn in the exact style of the boy in image 3: soft watercolour and gouache, fine dark ink outlines, gentle paper grain, the same storybook proportions and the same way of drawing the face.",
  LOOK,
  "Show him three times side by side, full body: standing facing the viewer, standing in three-quarter view, and sitting cross-legged on the ground.",
  "Only him: no Pikachu, no other characters, no objects, no text, no labels.",
  "The entire background is a flat, uniform pure magenta (#FF00FF).",
].join(" ");

const REPAINT = [
  "Image 1 is an illustration. Image 2 shows the character.",
  "Repaint image 1, replacing the boy (the person with a cap, glasses and a red shirt) with the character from image 2.",
  "There is exactly one person in the result, where the boy was: do not add a second, smaller copy of him or copy any other pose from image 2.",
  "Same pose, same position and size, same action, same direction of gaze and the same kind of expression as the boy.",
  LOOK,
  "Change his clothes completely: the boy's red shirt, cap and glasses must not appear anywhere; he wears the navy jacket open over the white t-shirt.",
  "Keep everything else exactly the same: Pikachu, every object, their positions, the composition and framing, and the illustration style. Do not add anything.",
  "Keep the flat, uniform magenta background exactly as it is: no gradient, no shadow, no glow. No text.",
].join(" ");

/** The object drafts picked for the tour, and what he is doing with each. */
const OBJECTS = {
  about: { draft: "about-1", action: "sitting cross-legged beside the robot, adjusting its jointed arm with a small screwdriver" },
  caf: { draft: "caf-2", action: "standing beside the railway signal, holding a tablet and looking at the train as he tests it" },
  columbus: { draft: "columbus-2", action: "crouching beside the globe, pointing at a spot on it while holding one of the folded maps" },
  education: { draft: "education-2", action: "sitting cross-legged in front of the laptop, typing, wearing the graduation cap that was on the laptop" },
  certifications: { draft: "certifications-1", action: "sitting beside the graphics card, proudly holding up one of the ribbon medals" },
  languages: { draft: "languages-1", action: "sitting on the suitcase, writing in the open notebook, with the paper lantern beside him" },
  contact: { draft: "contact-2", action: "standing beside the mailbox, his arm still raised after throwing the paper airplane, smiling and waving" },
};

const WITH_OBJECT = (action) => [
  "Image 1 is an illustration of some objects. Image 2 shows a character.",
  `Add the character from image 2 to image 1, ${action}.`,
  "Draw him once: exactly one person, in a single pose, at a size that fits the objects, standing on the same ground line as them.",
  LOOK,
  "Keep the objects, their look and the illustration style; you may shift them slightly so he fits, but keep the whole group centred with nothing cropped.",
  "No Pikachu, no other characters, no text.",
  "Keep the flat, uniform background colour of image 1: no gradient, no shadow, no glow.",
].join(" ");

function parse(argv) {
  const opts = { command: argv[0], names: [], drafts: 2, character: "1" };
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === "--drafts") opts.drafts = Number(argv[++i]);
    else if (argv[i] === "--character") opts.character = argv[++i];
    else opts.names.push(argv[i]);
  }
  return opts;
}

const find = (dir, prefix) => existsSync(dir) && readdirSync(dir).find((f) => f.startsWith(prefix) && /\.(png|jpe?g)$/.test(f));
const sceneNames = () => readdirSync(SITUATIONS).filter((f) => f.endsWith("-pikachu.png")).map((f) => f.replace("-pikachu.png", "")).sort();

async function character({ drafts }) {
  const photos = readdirSync(ME).filter((f) => /^photo-.*\.(png|jpe?g)$/.test(f)).sort();
  if (!photos.length) throw new Error(`put your photos in ${ME}/ as photo-1.jpg, photo-2.jpg…`);
  const parts = [
    { text: CHARACTER },
    ...(await Promise.all(photos.slice(0, 2).map((f) => imagePart(join(ME, f))))),
    await imagePart(join(SITUATIONS, `${STYLE_SCENE}-pikachu.png`)),
  ];
  for (let n = 1; n <= drafts; n++) {
    try { console.log(`✓ ${await paint(parts, join(ME, `character-${n}`))}`); }
    catch (e) { console.error(`✗ character-${n}: ${e.message}`); }
  }
}

async function scenes({ names, character: n }) {
  const sheet = existsSync(n) ? n : find(ME, `character-${n}.`) && join(ME, find(ME, `character-${n}.`));
  if (!sheet) throw new Error(`no ${ME}/character-${n}; run "npm run me -- character" first`);
  const sheetPart = await imagePart(sheet);
  mkdirSync(REPAINTS, { recursive: true });
  for (const name of names.length ? names : sceneNames()) {
    try {
      const parts = [{ text: REPAINT }, await imagePart(join(SITUATIONS, `${name}-pikachu.png`)), sheetPart];
      console.log(`✓ ${await paint(parts, join(REPAINTS, name))}`);
    } catch (e) {
      console.error(`✗ ${name}: ${e.message}`);
    }
  }
}

async function use({ names }) {
  for (const name of names.length ? names : sceneNames()) {
    const repaint = find(REPAINTS, `${name}.`);
    if (!repaint) { console.error(`✗ ${name}: not repainted yet`); continue; }
    const to = join(SITUATIONS, `${name}-erick.png`);
    await cutout(join(REPAINTS, repaint), to);
    console.log(`✓ ${to}`);
  }
}

async function objects({ names, character: n }) {
  const sheet = existsSync(n) ? n : find(ME, `character-${n}.`) && join(ME, find(ME, `character-${n}.`));
  if (!sheet) throw new Error(`no ${ME}/character-${n}; run "npm run me -- character" first`);
  const sheetPart = await imagePart(sheet);
  mkdirSync(WITH_OBJECTS, { recursive: true });
  for (const id of names.length ? names : Object.keys(OBJECTS)) {
    try {
      const draft = find(DRAFTS, `${OBJECTS[id].draft}.`);
      if (!draft) throw new Error(`no ${DRAFTS}/${OBJECTS[id].draft}`);
      const parts = [{ text: WITH_OBJECT(OBJECTS[id].action) }, await imagePart(join(DRAFTS, draft)), sheetPart];
      console.log(`✓ ${await paint(parts, join(WITH_OBJECTS, id))}`);
    } catch (e) {
      console.error(`✗ ${id}: ${e.message}`);
    }
  }
}

async function useObjects({ names }) {
  for (const id of names.length ? names : Object.keys(OBJECTS)) {
    const painted = find(WITH_OBJECTS, `${id}.`);
    if (!painted) { console.error(`✗ ${id}: not painted yet`); continue; }
    const to = join(CHAPTER_SCENES, `${id}.png`);
    await cutout(join(WITH_OBJECTS, painted), to);
    console.log(`✓ ${to}`);
  }
}

const opts = parse(process.argv.slice(2));
const commands = { character, scenes, use, objects, "use-objects": useObjects };
if (!commands[opts.command]) {
  console.error("Usage: npm run me -- character | scenes [names…] [--character N] | use [names…] | objects [ids…] | use-objects [ids…]");
  process.exit(1);
}
if (!opts.command.startsWith("use")) requireKey();
await commands[opts.command](opts);
