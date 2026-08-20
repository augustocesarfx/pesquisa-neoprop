/**
 * Logo oficial da Neoprop (versão branca, para fundos escuros).
 * Arquivo da identidade visual em public/neoprop/. Controle o tamanho
 * pela classe (ex.: "h-8 w-auto").
 */

export function NeopropLogo({
  className = "h-8 w-auto",
  variant = "horizontal",
}: {
  className?: string;
  variant?: "horizontal" | "vertical";
}) {
  const src =
    variant === "vertical"
      ? "/neoprop/vertical-branco.svg"
      : "/neoprop/horizontal-branco.svg";
  const size =
    variant === "vertical"
      ? { width: 547, height: 736 }
      : { width: 1034, height: 658 };
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Neoprop"
      width={size.width}
      height={size.height}
      className={className}
      decoding="async"
    />
  );
}
