import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { THEME_BOOT } from "@/components/portfolio/theme";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/Geist-Variable.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
});

const fraunces = localFont({
  src: [
    { path: "./fonts/Fraunces-latin.woff2", weight: "100 900", style: "normal" },
    { path: "./fonts/Fraunces-latin-italic.woff2", weight: "100 900", style: "italic" },
  ],
  variable: "--font-display",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});

export const metadata: Metadata = {
  title: "Erick Mollinedo — AI, systems and mobility",
  description: "Industrial electronics and automation engineer working on geospatial AI, RAG and MLOps. R&D Testing Engineer at CAF and Co-Founder & CTO of Columbus Earth.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f2" },
    { media: "(prefers-color-scheme: dark)", color: "#14181c" },
  ],
};

// If the scene never loads, still reveal the page after 4s.
const UNCOVER = "window.__uncover=setTimeout(function(){var c=document.querySelector('.clearing');c&&c.classList.remove('is-entering')},4000)";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${fraunces.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <script dangerouslySetInnerHTML={{ __html: UNCOVER }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
