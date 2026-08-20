import type { NextConfig } from "next";

/**
 * `output: "standalone"` serve ao Dockerfile (deploy próprio). Na Vercel a
 * plataforma monta a própria saída, então o modo fica desligado lá — a
 * variável VERCEL é definida por ela durante o build.
 */
const nextConfig: NextConfig = {
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
};

export default nextConfig;
