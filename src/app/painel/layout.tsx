import type { Metadata } from "next";
import { Instrument_Sans, IBM_Plex_Mono, Bricolage_Grotesque } from "next/font/google";
import "./painel.css";

const sans = Instrument_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-np-sans",
  display: "swap",
});
const mono = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-np-mono",
  display: "swap",
});
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-np-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Painel — Pesquisa Neoprop",
  robots: { index: false, follow: false, nocache: true },
};

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${sans.variable} ${mono.variable} ${display.variable}`}>
      {children}
    </div>
  );
}
