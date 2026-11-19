// The 24 painted situations standing in the field, as on the cloned page, with
// Erick and Pikachu repainted in (scripts/paint-me.mjs; the *-pikachu.png
// versions with the boy are kept beside them). Plain data, so the page can
// count them without three.js.

import { CHAPTERS } from "./content";

type Point = [number, number];
export type Situation = {
  name: string;
  src: string;
  /** Height of the figures' feet in the picture, as a fraction from the bottom (offset). */
  ground: number;
  /** Matching features across pictures (head, body, …) used to steer the morph. */
  landmarks: Point[];
  morphTravel?: number;
};

export const ART = "/portfolio/situations/";
const SAME: Point[] = [[0.33, 0.69], [0.33, 0.49], [0.3, 0.25], [0.72, 0.55], [0.78, 0.37]];

export const SITUATIONS: Situation[] = [
  { name: "A small creative break", src: "creative-break-erick.png", ground: 0.395, landmarks: [[0.4, 0.683], [0.397, 0.507], [0.51, 0.3], [0.692, 0.359], [0.792, 0.328]] },
  { name: "An unscheduled collaborator", src: "cat-on-keyboard-erick.png", ground: 0.35, landmarks: [[0.363, 0.692], [0.368, 0.49], [0.408, 0.267], [0.748, 0.406], [0.675, 0.4]] },
  { name: "A very small observatory", src: "tiny-observatory-erick.png", ground: 0.38, landmarks: [[0.303, 0.697], [0.26, 0.5], [0.25, 0.27], [0.716, 0.585], [0.78, 0.395]] },
  { name: "The book has been claimed", src: "claimed-book-erick.png", ground: 0.4, landmarks: [[0.34, 0.7], [0.35, 0.47], [0.31, 0.25], [0.615, 0.32], [0.715, 0.365]] },
  { name: "A very small flight school", src: "paper-pilot-erick.png", ground: 0.35, landmarks: [[0.33, 0.71], [0.35, 0.5], [0.38, 0.25], [0.68, 0.57], [0.73, 0.36]] },
  { name: "An unexpected duet", src: "piano-duet-erick.png", ground: 0.35, landmarks: SAME },
  { name: "The camera inspector", src: "camera-inspector-erick.png", ground: 0.395, landmarks: [[0.395, 0.72], [0.335, 0.5], [0.32, 0.25], [0.56, 0.6], [0.69, 0.38]] },
  { name: "The missing lunch", src: "picnic-thief-erick.png", ground: 0.36, landmarks: [[0.33, 0.72], [0.35, 0.5], [0.29, 0.25], [0.715, 0.54], [0.775, 0.38]] },
  { name: "Quality control", src: "robot-inspector-erick.png", ground: 0.35, landmarks: SAME },
  { name: "Wet paint", src: "wet-paint-erick.png", ground: 0.35, landmarks: SAME },
  { name: "Checkmate, apparently", src: "cat-checkmate-erick.png", morphTravel: 0.065, ground: 0.35, landmarks: [[0.36, 0.69], [0.32, 0.49], [0.3, 0.25], [0.68, 0.56], [0.76, 0.36]] },
  { name: "A tangled hobby", src: "tangled-hobby-erick.png", ground: 0.34, landmarks: [[0.33, 0.69], [0.33, 0.49], [0.3, 0.25], [0.665, 0.41], [0.78, 0.34]] },
  { name: "Rain for two", src: "rain-for-two-erick.png", ground: 0.35, landmarks: [[0.35, 0.64], [0.34, 0.46], [0.34, 0.24], [0.61, 0.41], [0.69, 0.27]] },
  { name: "Do not disturb", src: "do-not-disturb-erick.png", morphTravel: 0.065, ground: 0.26, landmarks: [[0.2, 0.65], [0.28, 0.44], [0.72, 0.3], [0.3, 0.59], [0.4, 0.48]] },
  { name: "An ambitious tower", src: "block-tower-erick.png", ground: 0.35, morphTravel: 0.05, landmarks: [[0.32, 0.7], [0.29, 0.49], [0.3, 0.25], [0.71, 0.49], [0.78, 0.31]] },
  { name: "Box beats gift", src: "box-beats-gift-erick.png", ground: 0.35, morphTravel: 0.05, landmarks: [[0.32, 0.71], [0.32, 0.49], [0.32, 0.24], [0.72, 0.5], [0.76, 0.33]] },
  { name: "Bubble inspector", src: "bubble-inspector-erick.png", ground: 0.35, morphTravel: 0.05, landmarks: [[0.29, 0.72], [0.31, 0.48], [0.33, 0.24], [0.72, 0.62], [0.74, 0.36]] },
  { name: "Pottery assistant", src: "pottery-assistant-erick.png", ground: 0.35, morphTravel: 0.05, landmarks: [[0.35, 0.7], [0.32, 0.49], [0.29, 0.24], [0.68, 0.58], [0.77, 0.32]] },
  { name: "A familiar giant", src: "familiar-giant-erick.png", ground: 0.35, morphTravel: 0.05, landmarks: [[0.26, 0.67], [0.23, 0.47], [0.22, 0.24], [0.5, 0.55], [0.47, 0.34]] },
  { name: "Cloud delivery", src: "cloud-delivery-erick.png", ground: 0.35, morphTravel: 0.05, landmarks: [[0.28, 0.7], [0.27, 0.48], [0.29, 0.24], [0.67, 0.52], [0.78, 0.51]] },
  { name: "The laundry portal", src: "laundry-portal-erick.png", ground: 0.35, morphTravel: 0.05, landmarks: [[0.4, 0.69], [0.33, 0.48], [0.28, 0.24], [0.61, 0.76], [0.74, 0.76]] },
  { name: "Borrowed moonlight", src: "borrowed-moonlight-erick.png", ground: 0.35, morphTravel: 0.05, landmarks: [[0.34, 0.69], [0.32, 0.48], [0.32, 0.24], [0.64, 0.45], [0.75, 0.38]] },
  { name: "A very slow voyage", src: "slow-voyage-erick.png", ground: 0.38, morphTravel: 0.05, landmarks: [[0.33, 0.7], [0.33, 0.49], [0.4, 0.35], [0.67, 0.51], [0.69, 0.36]] },
  { name: "Stars on the line", src: "stars-on-line-erick.png", ground: 0.35, morphTravel: 0.05, landmarks: [[0.25, 0.7], [0.23, 0.49], [0.26, 0.24], [0.77, 0.52], [0.81, 0.33]] },
];

/** Where the chapter objects live (painted by scripts/generate-scenes.mjs). */
export const CHAPTER_ART = "/portfolio/scenes/";

/**
 * Once "View portfolio" walks into the field, the sheet shows one object per
 * chapter instead of the scenes, in chapter order.
 */
export const CHAPTER_SCENES: Situation[] = CHAPTERS.map((c) => ({ name: c.id, src: `${c.id}.png`, ground: 0.6, landmarks: SAME }));
