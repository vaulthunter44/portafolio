// Everything the page says, in English and Spanish. The scene and the React
// parts both read from here, so a chapter is added or reworded in one place.

import type { Lang } from "./lang";

export const LINKEDIN_URL = "https://www.linkedin.com/in/erickmollinedolara/";
/** Shown in Contact once set. Left empty on purpose until there is a real address. */
export const EMAIL: string | null = null;
/** A PDF in /public, e.g. "/cv/erick-mollinedo-cv.pdf". The download link appears once set. */
export const CV_URL: string | null = null;

type Text = Record<Lang, string>;

export type Chapter = {
  id: string;
  kicker: Text;
  title: Text;
  meta?: Text;
  body?: Text;
  tags?: string[];
  list?: { label: Text; note?: Text }[];
};

export const CHAPTERS: Chapter[] = [
  {
    id: "about",
    kicker: { en: "Who I am", es: "Quién soy" },
    title: { en: "From automation to AI", es: "De la automática a la IA" },
    body: {
      en: "I trained as an Industrial Electronics and Automation engineer. Today I work in machine learning and AI infrastructure, designing the systems that let AI models run at scale.",
      es: "Me formé como Ingeniero en Electrónica Industrial y Automática. Hoy trabajo en aprendizaje automático e infraestructura de IA, diseñando los sistemas que permiten que los modelos funcionen a gran escala.",
    },
    tags: ["Machine Learning", "AI infrastructure", "Systems", "Mobility"],
  },
  {
    id: "caf",
    kicker: { en: "Now · CAF", es: "Ahora · CAF" },
    title: { en: "R&D Testing Engineer, ERTMS & RBC", es: "R&D Testing Engineer, ERTMS y RBC" },
    meta: {
      en: "Construcciones y Auxiliar de Ferrocarriles · Oct 2026 – present · Alcobendas, Madrid · Hybrid",
      es: "Construcciones y Auxiliar de Ferrocarriles · oct. 2026 – actualidad · Alcobendas, Madrid · Híbrido",
    },
    body: {
      en: "Testing and validation in R&D for ERTMS, the European Rail Traffic Management System, and its Radio Block Centre.",
      es: "Pruebas y validación en I+D para ERTMS, el sistema europeo de gestión del tráfico ferroviario, y su Radio Block Centre.",
    },
    tags: ["ERTMS", "RBC", "Rail"],
  },
  {
    id: "columbus",
    kicker: { en: "Now · Columbus Earth", es: "Ahora · Columbus Earth" },
    title: { en: "Co-Founder & CTO", es: "Cofundador y CTO" },
    meta: {
      en: "Aug 2025 – present · Madrid · Hybrid",
      es: "ago. 2025 – actualidad · Madrid · Híbrido",
    },
    body: {
      en: "Geospatial AI: systems that turn geospatial data into decision-making tools. RAG systems and model deployment on Microsoft Azure AI, and end-to-end pipelines for data ingestion and processing.",
      es: "IA geoespacial: sistemas que convierten datos geoespaciales en herramientas para tomar decisiones. Sistemas RAG y despliegue de modelos en Microsoft Azure AI, y canalizaciones de punta a punta para la ingesta y el procesamiento de datos.",
    },
    tags: ["Geospatial AI", "RAG", "MLOps", "Azure AI"],
  },
  {
    id: "education",
    kicker: { en: "Education", es: "Formación" },
    title: { en: "Universidad Politécnica de Madrid", es: "Universidad Politécnica de Madrid" },
    meta: {
      en: "BEng in Industrial Electronics and Automation Engineering · 2021 – 2026",
      es: "Grado en Ingeniería Electrónica Industrial y Automática · 2021 – 2026",
    },
    body: {
      en: "Where the automation side comes from: control systems, electronics and programming.",
      es: "De aquí viene la parte de automática: sistemas de control, electrónica y programación.",
    },
  },
  {
    id: "certifications",
    kicker: { en: "Certifications", es: "Certificaciones" },
    title: { en: "Still learning", es: "Siempre aprendiendo" },
    list: [
      { label: { en: "Microsoft Certified: Azure AI Engineer Associate", es: "Microsoft Certified: Azure AI Engineer Associate" }, note: { en: "2026", es: "2026" } },
      { label: { en: "Databricks: AI Agent Fundamentals", es: "Databricks: AI Agent Fundamentals" }, note: { en: "2026", es: "2026" } },
      { label: { en: "Databricks Fundamentals", es: "Databricks Fundamentals" }, note: { en: "2026", es: "2026" } },
      { label: { en: "NVIDIA: Building RAG Agents with LLMs", es: "NVIDIA: Building RAG Agents with LLMs" }, note: { en: "2025", es: "2025" } },
      { label: { en: "NVIDIA: Getting Started with Deep Learning", es: "NVIDIA: Getting Started with Deep Learning" }, note: { en: "2025", es: "2025" } },
      { label: { en: "NVIDIA: Disaster Risk Monitoring Using Satellite Imagery", es: "NVIDIA: Disaster Risk Monitoring Using Satellite Imagery" }, note: { en: "2025", es: "2025" } },
      { label: { en: "NVIDIA: Deploying a Model for Inference at Production Scale", es: "NVIDIA: Deploying a Model for Inference at Production Scale" }, note: { en: "2024", es: "2024" } },
      { label: { en: "Cognitive Class: Machine Learning with Python", es: "Cognitive Class: Machine Learning with Python" }, note: { en: "2024", es: "2024" } },
      { label: { en: "Microsoft Certified: Azure AI Fundamentals", es: "Microsoft Certified: Azure AI Fundamentals" }, note: { en: "2024", es: "2024" } },
      { label: { en: "University of Cambridge: First Certificate C1", es: "University of Cambridge: First Certificate C1" }, note: { en: "2020", es: "2020" } },
    ],
  },
  {
    id: "languages",
    kicker: { en: "Languages", es: "Idiomas" },
    title: { en: "Hola · Hello · Bonjour · こんにちは", es: "Hola · Hello · Bonjour · こんにちは" },
    list: [
      { label: { en: "Spanish", es: "Español" }, note: { en: "Native", es: "Nativo" } },
      { label: { en: "English", es: "Inglés" }, note: { en: "C1, Cambridge", es: "C1, Cambridge" } },
      { label: { en: "French", es: "Francés" } },
      { label: { en: "Japanese", es: "Japonés" } },
    ],
  },
  {
    id: "contact",
    kicker: { en: "Contact", es: "Contacto" },
    title: { en: "Let's talk", es: "Hablemos" },
    body: {
      en: "I'm drawn to projects where machine learning, systems, mobility and AI come together to solve real-world problems.",
      es: "Me interesan los proyectos donde el machine learning, los sistemas, la movilidad y la IA se unen para resolver problemas del mundo real.",
    },
  },
];

// The field has more scenes than the tour has chapters, so each chapter covers
// a run of consecutive scenes (3 or 4 of the 24).
export const chapterAt = (scene: number, scenes: number) => Math.floor((scene * CHAPTERS.length) / scenes);
export const firstSceneOf = (chapter: number, scenes: number) => Math.ceil((chapter * scenes) / CHAPTERS.length);

export const UI = {
  title: { en: "Erick Mollinedo — AI, systems and mobility", es: "Erick Mollinedo — IA, sistemas y movilidad" },
  blurb: {
    en: "An automation engineer who ended up teaching machines to read the Earth.",
    es: "Un ingeniero en automática que acabó enseñando a las máquinas a leer la Tierra.",
  },
  view: { en: "View portfolio", es: "Ver portafolio" },
  home: { en: "Home", es: "Inicio" },
  here: { en: "You are here.", es: "Estás aquí." },
  sunDown: { en: "Put the sun down", es: "Bajar el sol" },
  sunUp: { en: "Bring the sun back up", es: "Volver a subir el sol" },
  switchLang: { en: "Ver en español", es: "View in English" },
  contact: { en: "Contact", es: "Contacto" },
  talk: { en: "Let's talk.", es: "Hablemos." },
  contactLede: {
    en: "Open to conversations about AI, geospatial systems and mobility.",
    es: "Abierto a hablar de IA, sistemas geoespaciales y movilidad.",
  },
  email: { en: "Email", es: "Email" },
  cv: { en: "Download CV (PDF)", es: "Descargar CV (PDF)" },
  drag: { en: "Drag to turn", es: "Arrastra para girar" },
  turnField: { en: "Turn the field", es: "Girar el campo" },
  turnLeft: { en: "Turn left", es: "Girar a la izquierda" },
  turnRight: { en: "Turn right", es: "Girar a la derecha" },
  previous: { en: "Previous chapter", es: "Capítulo anterior" },
  next: { en: "Next chapter", es: "Capítulo siguiente" },
  chapterOf: { en: "Chapter", es: "Capítulo" },
  field: {
    en: "A field you can turn. Left and right arrows turn it one step.",
    es: "Un campo que puedes girar. Las flechas izquierda y derecha lo giran un paso.",
  },
  sky: { en: "sky", es: "cielo" },
  skyOn: { en: "The sky is showing. Switch to false to hide it", es: "El cielo se ve. Cambiar a false para quitarlo" },
  skyOff: { en: "The sky is hidden. Switch to true to show it", es: "El cielo está quitado. Cambiar a true para mostrarlo" },
} satisfies Record<string, Text>;
