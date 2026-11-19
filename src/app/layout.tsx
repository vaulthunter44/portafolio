import type { Metadata } from "next";
import "./globals.css";

// The home page is the static plates page in public/plates (see next.config.ts).
// This layout only frames Next's own pages, such as the 404.
export const metadata: Metadata = {
  title: "Erick Mollinedo",
  description: "Automation engineer by training, AI engineer by trade. Co-Founder & CTO of Columbus Earth, founder of El3mentslab, R&D Testing Engineer at CAF.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
