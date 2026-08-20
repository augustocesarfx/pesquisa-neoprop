import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Pesquisa de Experiência Neoprop";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Preview do link (WhatsApp/redes) da pesquisa — identidade 100% Neoprop:
 * grafite profundo, verde institucional e o logo oficial (public/neoprop).
 */
export default async function OpengraphImage() {
  let logoSrc: string | null = null;
  try {
    const svg = await readFile(
      join(process.cwd(), "public", "neoprop", "horizontal-branco.svg")
    );
    logoSrc = `data:image/svg+xml;base64,${svg.toString("base64")}`;
  } catch {
    // sem o arquivo no build, segue só com o texto
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#070a09",
          backgroundImage:
            "radial-gradient(ellipse 60% 50% at 50% 20%, rgba(15,167,80,0.14), transparent)",
          padding: "60px",
        }}
      >
        {logoSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoSrc} alt="" width={190} height={121} />
        )}
        <div
          style={{
            marginTop: 42,
            fontSize: 24,
            letterSpacing: "0.3em",
            color: "#16c463",
            textTransform: "uppercase",
          }}
        >
          Pesquisa de Experiência
        </div>
        <div
          style={{
            marginTop: 24,
            maxWidth: 950,
            textAlign: "center",
            fontSize: 46,
            fontWeight: 700,
            lineHeight: 1.2,
            color: "#e9f0ec",
            letterSpacing: "-0.02em",
          }}
        >
          Você fez parte da nossa história. Agora, sua voz precisa fazer parte
          do próximo capítulo.
        </div>
        <div
          style={{
            marginTop: 26,
            fontSize: 24,
            color: "#9dada5",
          }}
        >
          Três minutos, sem oferta — só a sua experiência.
        </div>
      </div>
    ),
    { ...size }
  );
}
