"use client";

/**
 * Peças de visualização do painel.
 *
 * Regra que atravessa todas: **o número aparece escrito ao lado da barra**.
 * A barra dá a comparação num relance; o rótulo garante que ninguém dependa
 * de enxergar cor ou estimar comprimento. É também o que dispensa uma
 * "visão de tabela" separada — a tabela já está na tela.
 */

import type { Distribuicao, Fatia } from "@/lib/panel-metrics";

/** Número-herói: uma manchete, não um gráfico. */
export function Heroi({
  valor,
  sufixo,
  rotulo,
  apoio,
  cor,
}: {
  valor: string | number | null;
  sufixo?: string;
  rotulo: string;
  apoio?: string;
  cor?: string;
}) {
  return (
    <div className="np-card">
      <p className="np-rotulo">{rotulo}</p>
      <p className="np-heroi mt-3" style={cor ? { color: cor } : undefined}>
        {valor === null ? "—" : valor}
        {valor !== null && sufixo ? (
          <span className="text-[0.4em] ml-1 align-top">{sufixo}</span>
        ) : null}
      </p>
      {apoio && <p className="mt-2 text-xs leading-relaxed text-[var(--txt-2)]">{apoio}</p>}
    </div>
  );
}

/** Barras horizontais de magnitude: uma cor só, rótulo direto. */
export function Barras({
  fatias,
  limite,
  destaque,
}: {
  fatias: Fatia[];
  limite?: number;
  /** Cor alternativa (usada quando a barra representa algo negativo). */
  destaque?: string;
}) {
  const itens = limite ? fatias.slice(0, limite) : fatias;
  const maior = Math.max(...itens.map((f) => f.quantidade), 1);

  return (
    <div className="grid gap-3">
      {itens.map((f) => (
        <div key={f.valor}>
          <div className="mb-1.5 flex items-baseline justify-between gap-4">
            <span className="text-[0.9rem] leading-snug">{f.rotulo}</span>
            <span className="np-num shrink-0 text-sm text-[var(--txt-2)]">
              {f.percentual}% <span className="text-[var(--txt-3)]">· {f.quantidade}</span>
            </span>
          </div>
          <div className="np-trilho">
            <div
              className="np-preenche"
              style={{
                width: `${(f.quantidade / maior) * 100}%`,
                ...(destaque ? { background: destaque } : {}),
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Bloco de uma pergunta: título, base e barras. */
export function Bloco({
  d,
  limite,
  destaque,
}: {
  d: Distribuicao;
  limite?: number;
  destaque?: string;
}) {
  return (
    <section className="np-card">
      <h3 className="np-display text-lg">{d.pergunta}</h3>
      <p className="mt-1 mb-5 text-xs text-[var(--txt-3)]">
        Base: {d.base} {d.baseRotulo}
      </p>
      <Barras fatias={d.fatias} limite={limite} destaque={destaque} />
    </section>
  );
}

/**
 * Composição do NPS. Escala divergente: vermelho (detrator) ← cinza (neutro)
 * → azul (promotor). Vermelho/verde seria o esperado, mas os dois medem
 * ΔE 4,1 em deuteranopia — um daltônico não os separaria.
 */
export function ComposicaoNps({
  promotores,
  neutros,
  detratores,
  pctPromotores,
  pctNeutros,
  pctDetratores,
}: {
  promotores: number;
  neutros: number;
  detratores: number;
  pctPromotores: number;
  pctNeutros: number;
  pctDetratores: number;
}) {
  const total = promotores + neutros + detratores;
  if (total === 0) {
    return <p className="text-sm text-[var(--txt-2)]">Nenhuma resposta concluída ainda.</p>;
  }

  const faixas = [
    { chave: "det", nome: "Detratores", desc: "notas 0 a 6", n: detratores, p: pctDetratores, cor: "var(--polo-neg)" },
    { chave: "neu", nome: "Neutros", desc: "notas 7 e 8", n: neutros, p: pctNeutros, cor: "var(--neutro)" },
    { chave: "pro", nome: "Promotores", desc: "notas 9 e 10", n: promotores, p: pctPromotores, cor: "var(--polo-pos)" },
  ];

  return (
    <div>
      <div className="np-empilhada" role="img" aria-label={`Composição: ${detratores} detratores, ${neutros} neutros, ${promotores} promotores`}>
        {faixas.map((f) =>
          f.n > 0 ? (
            <div key={f.chave} className="np-segmento" style={{ width: `${f.p}%`, background: f.cor }} />
          ) : null
        )}
      </div>
      <ul className="mt-5 grid gap-3">
        {faixas.map((f) => (
          <li key={f.chave} className="flex items-baseline gap-3">
            <span
              className="mt-1 size-2.5 shrink-0 rounded-[3px]"
              style={{ background: f.cor }}
              aria-hidden="true"
            />
            <span className="flex-1 text-[0.9rem]">
              {f.nome} <span className="text-[var(--txt-3)]">({f.desc})</span>
            </span>
            <span className="np-num text-sm text-[var(--txt-2)]">
              {f.p}% <span className="text-[var(--txt-3)]">· {f.n}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * NPS por segmento. Escala divergente com zero no meio: barra para a
 * esquerda quando o grupo é negativo, para a direita quando é positivo.
 */
export function NpsPorGrupo({
  grupos,
}: {
  grupos: { valor: string; rotulo: string; quantidade: number; nps: number }[];
}) {
  if (!grupos.length) {
    return <p className="text-sm text-[var(--txt-2)]">Ainda sem dados suficientes.</p>;
  }
  return (
    <div className="grid gap-3">
      {grupos.map((g) => {
        const largura = Math.min(Math.abs(g.nps), 100) / 2; // metade da faixa por lado
        const negativo = g.nps < 0;
        return (
          <div key={g.valor}>
            <div className="mb-1.5 flex items-baseline justify-between gap-4">
              <span className="text-[0.9rem] leading-snug">{g.rotulo}</span>
              <span className="np-num shrink-0 text-sm">
                <span style={{ color: negativo ? "var(--polo-neg)" : "var(--polo-pos)" }}>
                  {g.nps > 0 ? "+" : ""}
                  {g.nps}
                </span>
                <span className="text-[var(--txt-3)]"> · {g.quantidade} resp.</span>
              </span>
            </div>
            <div className="relative h-2.5">
              {/* eixo do zero */}
              <div className="absolute left-1/2 top-0 h-full w-px bg-[var(--linha-forte)]" />
              <div
                className="absolute top-0 h-full rounded-[3px]"
                style={{
                  width: `${largura}%`,
                  left: negativo ? `${50 - largura}%` : "50%",
                  background: negativo ? "var(--polo-neg)" : "var(--polo-pos)",
                }}
              />
            </div>
          </div>
        );
      })}
      <p className="mt-1 text-[11px] text-[var(--txt-3)]">
        Linha central = NPS zero. Barra à esquerda: mais detratores que promotores.
      </p>
    </div>
  );
}
