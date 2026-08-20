import type { Metadata } from "next";
import {
  Instrument_Sans,
  IBM_Plex_Mono,
  Bricolage_Grotesque,
} from "next/font/google";
import "./globals.css";

/**
 * Pesquisa de Experiência Neoprop — aplicação dedicada.
 * Três vozes tipográficas: Bricolage Grotesque no display (personalidade),
 * Instrument Sans no corpo (a voz do site da Neoprop) e IBM Plex Mono nos
 * rótulos técnicos e números — o DNA "grid técnico" da marca.
 * noindex: o link é enviado direto à base de clientes.
 */

const instrumentSans = Instrument_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-np-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-np-mono",
  display: "swap",
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-np-display",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "https://pesquisa.neoprop.com.br"),
  title: "Pesquisa de Experiência — Neoprop",
  description:
    "Você fez parte da nossa história. Em três minutos, conte o que te surpreendeu, o que te frustrou e o que precisa mudar — sem oferta, sem venda.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Pesquisa de Experiência — Neoprop",
    description:
      "Você fez parte da nossa história. Em três minutos, conte o que precisa mudar — sem oferta, sem venda.",
    type: "website",
    locale: "pt_BR",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      className={`${instrumentSans.variable} ${plexMono.variable} ${bricolage.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
