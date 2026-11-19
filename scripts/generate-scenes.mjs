// Paints the seven chapter scenes with Nano Banana (Gemini's image model),
// using the API key of your own Google project.
//
//   npm run scenes                      every chapter, 2 drafts each → art/drafts/
//   npm run scenes -- caf columbus      only these chapters
//   npm run scenes -- --drafts 4        more drafts per chapter
//   npm run scenes -- --pick caf 2      use art/drafts/caf-2.* as the caf scene
//
// The key and the model are set up in nano-banana.mjs.

import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { cutout, paint, requireKey } from "./nano-banana.mjs";

const DRAFTS = "art/drafts";
const SCENES = "public/portfolio/scenes";

// The page keys out magenta and stands the painting in the grass, so every
// scene shares one look and one layout: a single subject, low and centred.
const STYLE = [
  "A single hand-painted illustration in soft watercolour and gouache with fine, slightly wobbly dark ink outlines and a gentle paper grain.",
  "Warm, muted storybook palette: sage and olive greens, cream, warm greys, charcoal, with a few accents of brick red (#b8431f).",
  "Cosy, quiet, a little whimsical. Soft light from the upper left.",
  "Composition: one group of objects, centred, resting on an invisible ground line about 20% above the bottom edge, filling about 55% of the image width, nothing cropped.",
  "No ground, no grass, no cast shadow plane, no people, no text, no letters, no numbers, no logos, no frame or border.",
  "The entire background is a perfectly flat, uniform pure magenta (#FF00FF), with no gradient, no texture and no magenta reflected on the objects.",
].join(" ");

const SUBJECTS = {
  about: "A friendly little vintage robot with a rounded screen face showing a gentle smile and one jointed industrial robot arm, sitting next to a small industrial control cabinet with switches, indicator lights and a coil of cable.",
  caf: "The front car of a modern high-speed passenger train, generic and unbranded, on a short piece of track, beside a small railway signal showing a red light and a slim trackside radio mast with an antenna.",
  columbus: "A large antique desk globe showing the continents, with a small satellite orbiting it along a thin dotted arc, and a few folded paper maps leaning against its wooden base.",
  education: "An open vintage laptop showing a simple circuit diagram, a graduation cap resting on its lid, a small stack of engineering books and an electronics breadboard with a few coloured wires.",
  certifications: "A small graphics card with two cooling fans standing upright like a trophy, surrounded by three ribbon medals and a rolled certificate tied with a red ribbon.",
  languages: "A round Japanese paper lantern, a small vintage suitcase covered in travel stickers without any writing, a stack of blank postcards and an open notebook.",
  contact: "A large folded paper airplane gliding just above a small red vintage mailbox with its flag raised, with two sealed envelopes beside it.",
};

function parse(argv) {
  const opts = { ids: [], drafts: 2, pick: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--drafts") opts.drafts = Number(argv[++i]);
    else if (argv[i] === "--pick") opts.pick = { id: argv[++i], n: argv[++i] };
    else opts.ids.push(argv[i]);
  }
  return opts;
}

async function pick({ id, n }) {
  const draft = existsSync(DRAFTS) && readdirSync(DRAFTS).find((f) => f.startsWith(`${id}-${n}.`));
  if (!draft) throw new Error(`no draft ${id}-${n} in ${DRAFTS}`);
  const from = join(DRAFTS, draft), to = join(SCENES, `${id}.png`);
  mkdirSync(SCENES, { recursive: true });
  const bg = await cutout(from, to);
  console.log(`${from} → ${to} (background rgb(${bg.join(", ")}) cut out)`);
}

const opts = parse(process.argv.slice(2));
if (opts.pick) {
  await pick(opts.pick);
} else {
  requireKey();
  const ids = opts.ids.length ? opts.ids : Object.keys(SUBJECTS);
  const unknown = ids.filter((id) => !SUBJECTS[id]);
  if (unknown.length) throw new Error(`unknown chapter: ${unknown.join(", ")} (known: ${Object.keys(SUBJECTS).join(", ")})`);
  mkdirSync(DRAFTS, { recursive: true });
  for (const id of ids) {
    for (let n = 1; n <= opts.drafts; n++) {
      try {
        console.log(`✓ ${await paint([{ text: `${SUBJECTS[id]} ${STYLE}` }], join(DRAFTS, `${id}-${n}`))}`);
      } catch (e) {
        console.error(`✗ ${id}-${n}: ${e.message}`);
      }
    }
  }
  console.log(`\nLook through ${DRAFTS}/ and keep one per chapter with: npm run scenes -- --pick <chapter> <n>`);
}
