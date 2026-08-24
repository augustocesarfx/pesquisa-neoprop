import type { ReactNode } from "react";

export function Container({
  children,
  className = "",
  narrow = false,
  gutter = "default",
}: {
  children: ReactNode;
  className?: string;
  narrow?: boolean;
  /**
   * Respiro lateral. "tight" usa 17px no mobile — é o que permite a coluna
   * de 340px do Figma caber inteira num viewport de 375px.
   */
  gutter?: "default" | "tight";
}) {
  return (
    <div
      className={`mx-auto w-full ${
        gutter === "tight" ? "px-[17px] md:px-8" : "px-5 md:px-8"
      } ${narrow ? "max-w-3xl" : "max-w-6xl"} ${className}`}
    >
      {children}
    </div>
  );
}
