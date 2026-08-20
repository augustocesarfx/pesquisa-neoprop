"use client";

/**
 * Entrada suave (fade + rise), uma única vez, quando o elemento entra no
 * viewport. IntersectionObserver como mecanismo primário e um listener de
 * scroll passivo como fallback defensivo — a copy nunca pode ficar presa
 * em opacity 0 (bfcache, observers throttled, browsers antigos).
 * Usa apenas transform/opacity; desativada em prefers-reduced-motion
 * (tratado no CSS — .ap-reveal vira estática).
 */

import { useEffect, useRef, type ReactNode } from "react";

export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  /** Atraso em ms (stagger máximo recomendado: 3 itens). */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let observer: IntersectionObserver | null = null;
    const cleanupFns: Array<() => void> = [];

    const show = () => {
      el.classList.add("ap-revealed");
      observer?.disconnect();
      cleanupFns.forEach((fn) => fn());
    };

    const isInViewport = () => {
      const rect = el.getBoundingClientRect();
      return rect.top < window.innerHeight * 0.95 && rect.bottom > 0;
    };

    if (typeof IntersectionObserver === "undefined" || isInViewport()) {
      show();
      return;
    }

    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) show();
      },
      { threshold: 0.15, rootMargin: "0px 0px -5% 0px" }
    );
    observer.observe(el);

    // Fallback: revela via scroll caso o observer não entregue.
    const onScroll = () => {
      if (isInViewport()) show();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    cleanupFns.push(() => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    });

    return () => {
      observer?.disconnect();
      cleanupFns.forEach((fn) => fn());
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`ap-reveal ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
