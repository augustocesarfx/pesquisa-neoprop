"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
  size?: "md" | "lg";
  loading?: boolean;
  /** Aplica a animação/sombra de CTA recém-liberado pelo vídeo. */
  emphasized?: boolean;
  children: ReactNode;
};

export function Button({
  variant = "primary",
  size = "lg",
  loading = false,
  emphasized = false,
  disabled,
  className = "",
  children,
  ...rest
}: Props) {
  const base =
    "ap-btn inline-flex items-center justify-center gap-2 rounded-full font-normal transition-[transform,box-shadow,background-color,border-color] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ap-green)] select-none";
  const sizes =
    size === "lg"
      ? "min-h-14 px-7 py-4 text-sm md:text-base"
      : "min-h-11 px-5 py-3 text-xs md:text-sm";
  const variants =
    variant === "primary"
      ? "bg-[var(--ap-green)] text-[var(--ap-green-ink)] hover:bg-[var(--ap-green-hover)] hover:-translate-y-px active:translate-y-0 active:scale-[.99]"
      : "border border-[var(--ap-border-strong)] text-[var(--ap-text)] bg-transparent hover:border-[var(--ap-green)] hover:-translate-y-px active:translate-y-0";
  const state =
    disabled || loading
      ? "opacity-50 cursor-not-allowed hover:translate-y-0 hover:bg-[var(--ap-green)]"
      : "cursor-pointer";
  const emphasis = emphasized ? "ap-cta-enter ap-cta-glow" : "";

  return (
    <button
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${base} ${sizes} ${variants} ${state} ${emphasis} ${className}`}
      {...rest}
    >
      {loading && (
        <svg
          className="ap-spin size-4 shrink-0"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <circle
            cx="8"
            cy="8"
            r="6.5"
            stroke="currentColor"
            strokeOpacity=".3"
            strokeWidth="2"
          />
          <path
            d="M14.5 8a6.5 6.5 0 0 0-6.5-6.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      )}
      <span>{children}</span>
    </button>
  );
}
