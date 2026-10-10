import type { Metadata } from "next";
import "./globals.css";
import { Shell } from "@/components/layout/Shell";

export const metadata: Metadata = {
  title: "Higgs Clone",
  description: "Nachbau-Prototyp einer KI-Bild- und Video-Plattform (Mock-Daten)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className="dark" suppressHydrationWarning>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
