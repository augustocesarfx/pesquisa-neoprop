"use client";

/**
 * Painel de análise da pesquisa.
 *
 * A ordem das seções é a ordem de uma decisão, não a ordem do formulário:
 * primeiro o retrato (quanto e quão bem), depois o diagnóstico (o que
 * corrigir e o que preservar), depois o detalhe por pergunta e, no fim,
 * as palavras das pessoas — que é onde mora a explicação dos números.
 */

import { useCallback, useEffect, useState } from "react";
import type { Painel } from "@/lib/panel-metrics";
import { Heroi, Bloco, Barras, ComposicaoNps, NpsPorGrupo } from "./graficos";

type Estado =
  | { fase: "carregando" }
  | { fase: "login"; erro?: string }
  | { fase: "pronto"; painel: Painel; atualizadoEm: string }
  | { fase: "erro"; mensagem: string };

export function PainelCliente() {
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [busca, setBusca] = useState("");

  const carregar = useCallback(async () => {
    try {
      const r = await fetch("/api/painel/dados", { cache: "no-store" });
      if (r.status === 401) return setEstado({ fase: "login" });
      if (r.status === 503) {
        return setEstado({
          fase: "erro",
          mensagem:
            "O painel está sem senha configurada. Defina PANEL_PASSWORD no servidor para liberar o acesso.",
        });
      }
      const d = await r.json();
      if (!r.ok || !d?.ok) {
        return setEstado({
          fase: "erro",
          mensagem:
            d?.error === "sheet_not_configured"
              ? "O servidor não está ligado à planilha (falta SHEETS_WEBHOOK_URL)."
              : `Não foi possível ler a planilha (${d?.error ?? r.status}).`,
        });
      }
      setEstado({ fase: "pronto", painel: d.painel, atualizadoEm: d.atualizadoEm });
    } catch {
      setEstado({ fase: "erro", mensagem: "Falha de rede ao buscar os dados." });
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    try {
      const r = await fetch("/api/painel/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha }),
      });
      if (!r.ok) {
        setEstado({ fase: "login", erro: "Senha incorreta." });
        return;
      }
      setSenha("");
      setEstado({ fase: "carregando" });
      await carregar();
    } catch {
      setEstado({ fase: "login", erro: "Falha de rede." });
    } finally {
      setEnviando(false);
    }
  };

  const sair = async () => {
    await fetch("/api/painel/login", { method: "DELETE" });
    setEstado({ fase: "login" });
  };

  /* ---------------------------------------------------------------- */

  if (estado.fase === "carregando") {
    return (
      <main className="np-painel grid min-h-screen place-items-center">
        <p className="np-rotulo">Carregando</p>
      </main>
    );
  }

  if (estado.fase === "erro") {
    return (
      <main className="np-painel grid min-h-screen place-items-center px-6">
        <div className="np-card max-w-md text-center">
          <p className="np-rotulo">Painel indisponível</p>
          <p className="mt-4 leading-relaxed text-[var(--txt-2)]">{estado.mensagem}</p>
        </div>
      </main>
    );
  }

  if (estado.fase === "login") {
    return (
      <main className="np-painel grid min-h-screen place-items-center px-6">
        <form onSubmit={entrar} className="np-card w-full max-w-sm">
          <p className="np-rotulo">Pesquisa Neoprop</p>
          <h1 className="np-display mt-3 text-2xl">Painel de análise</h1>
          <p className="mt-2 text-sm text-[var(--txt-2)]">
            Os dados incluem contato e crítica de clientes. O acesso é restrito.
          </p>
          <label htmlFor="senha" className="mt-6 mb-2 block text-sm font-medium">
            Senha
          </label>
          <input
            id="senha"
            type="password"
            className="np-input"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="current-password"
            autoFocus
          />
          <div aria-live="polite" className="min-h-6 mt-3">
            {estado.erro && (
              <p className="text-sm text-[var(--polo-neg)]">{estado.erro}</p>
            )}
          </div>
          <button type="submit" className="np-botao mt-2 w-full" disabled={enviando || !senha}>
            {enviando ? "Verificando…" : "Entrar"}
          </button>
        </form>
      </main>
    );
  }

  const p = estado.painel;
  const r = p.resumo;

  const abertasFiltradas = busca.trim()
    ? p.abertas.filter((a) =>
        (a.texto + " " + a.nome + " " + a.campo).toLowerCase().includes(busca.toLowerCase())
      )
    : p.abertas;

  return (
    <main className="np-painel px-5 py-10 md:px-10">
      <div className="mx-auto max-w-6xl">
        {/* Cabeçalho */}
        <header className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="np-rotulo">Pesquisa de Experiência Neoprop</p>
            <h1 className="np-display mt-2 text-3xl md:text-4xl">Painel de análise</h1>
            <p className="mt-2 text-sm text-[var(--txt-2)]">
              Atualizado em{" "}
              {new Date(estado.atualizadoEm).toLocaleString("pt-BR", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => void carregar()} className="np-botao">
              Atualizar
            </button>
            <button
              onClick={() => void sair()}
              className="rounded-lg border border-[var(--linha-forte)] px-4 py-3 text-sm text-[var(--txt-2)] transition-colors hover:text-[var(--txt)]"
            >
              Sair
            </button>
          </div>
        </header>

        {r.total === 0 ? (
          <div className="np-card text-center">
            <p className="np-display text-xl">Nenhuma resposta ainda</p>
            <p className="mt-2 text-sm text-[var(--txt-2)]">
              Assim que a primeira pessoa responder, os números aparecem aqui.
            </p>
          </div>
        ) : (
          <>
            {/* --- Retrato ------------------------------------------- */}
            <section className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Heroi
                rotulo="NPS"
                valor={r.nps}
                cor={r.nps === null ? undefined : r.nps < 0 ? "var(--polo-neg)" : "var(--polo-pos)"}
                apoio={
                  r.comNota > 0
                    ? `Promotores menos detratores, sobre ${r.comNota} nota${r.comNota > 1 ? "s" : ""}. Vai de −100 a +100.`
                    : "Ninguém concluiu a pesquisa ainda."
                }
              />
              <Heroi
                rotulo="Respostas"
                valor={r.total}
                apoio={`${r.completas} concluíram · ${r.parciais} pararam no meio`}
              />
              <Heroi
                rotulo="Taxa de conclusão"
                valor={r.taxaConclusao}
                sufixo="%"
                apoio="De quem começou a preencher a identificação"
              />
              <Heroi
                rotulo="Confiança média"
                valor={r.confianca}
                apoio="Quanto confiam que a Neoprop cumpre o que comunica (0 a 10)"
              />
            </section>

            {/* --- Composição + tempo -------------------------------- */}
            <section className="mb-10 grid gap-4 lg:grid-cols-3">
              <div className="np-card lg:col-span-2">
                <h2 className="np-display text-lg">Composição do NPS</h2>
                <p className="mt-1 mb-5 text-xs text-[var(--txt-3)]">
                  Base: {r.comNota} resposta{r.comNota === 1 ? "" : "s"} concluída
                  {r.comNota === 1 ? "" : "s"} com nota
                </p>
                <ComposicaoNps
                  promotores={r.promotores}
                  neutros={r.neutros}
                  detratores={r.detratores}
                  pctPromotores={r.pctPromotores}
                  pctNeutros={r.pctNeutros}
                  pctDetratores={r.pctDetratores}
                />
              </div>
              <div className="np-card">
                <h2 className="np-display text-lg">Preenchimento</h2>
                <dl className="mt-5 grid gap-4 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-[var(--txt-2)]">Tempo mediano</dt>
                    <dd className="np-num">
                      {r.duracaoMediana === null
                        ? "—"
                        : `${Math.floor(r.duracaoMediana / 60)} min ${r.duracaoMediana % 60}s`}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-[var(--txt-2)]">Marcadas como suspeitas</dt>
                    <dd className="np-num">{r.suspeitas}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-[var(--txt-2)]">Pararam no meio</dt>
                    <dd className="np-num">{r.parciais}</dd>
                  </div>
                </dl>
                {r.suspeitas > 0 && (
                  <p className="mt-4 text-[11px] leading-relaxed text-[var(--txt-3)]">
                    Suspeitas continuam contando nos números — foram apenas sinalizadas
                    (preenchimento rápido demais ou campo-armadilha).
                  </p>
                )}
              </div>
            </section>

            {/* --- Diagnóstico --------------------------------------- */}
            <h2 className="np-display mb-4 mt-12 text-2xl">O que os números pedem</h2>
            <section className="mb-10 grid gap-4 lg:grid-cols-2">
              <div className="np-card">
                <h3 className="np-display text-lg">Corrigir primeiro</h3>
                <p className="mt-1 mb-5 text-xs text-[var(--txt-3)]">
                  O que os <strong className="text-[var(--polo-neg)]">detratores</strong> apontam
                  · base: {p.corrigirPrimeiro.base}
                </p>
                {p.corrigirPrimeiro.itens.length ? (
                  <Barras fatias={p.corrigirPrimeiro.itens} limite={6} destaque="var(--polo-neg)" />
                ) : (
                  <p className="text-sm text-[var(--txt-2)]">Nenhum detrator até agora.</p>
                )}
              </div>
              <div className="np-card">
                <h3 className="np-display text-lg">Preservar</h3>
                <p className="mt-1 mb-5 text-xs text-[var(--txt-3)]">
                  O que os <strong className="text-[var(--polo-pos)]">promotores</strong> valorizam
                  · base: {p.preservar.base}
                </p>
                {p.preservar.itens.length ? (
                  <Barras fatias={p.preservar.itens} limite={6} destaque="var(--polo-pos)" />
                ) : (
                  <p className="text-sm text-[var(--txt-2)]">Nenhum promotor até agora.</p>
                )}
              </div>
            </section>

            <section className="mb-10 grid gap-4 lg:grid-cols-2">
              <div className="np-card">
                <h3 className="np-display text-lg">NPS por expectativa</h3>
                <p className="mt-1 mb-5 text-xs text-[var(--txt-3)]">
                  Quem esperava e não recebeu é quem derruba o índice
                </p>
                <NpsPorGrupo grupos={p.npsPorExpectativa} />
              </div>
              <div className="np-card">
                <h3 className="np-display text-lg">NPS por momento da jornada</h3>
                <p className="mt-1 mb-5 text-xs text-[var(--txt-3)]">
                  Em que etapa a experiência azeda
                </p>
                <NpsPorGrupo grupos={p.npsPorJornada} />
              </div>
            </section>

            {p.abandono.length > 0 && (
              <section className="mb-10">
                <div className="np-card">
                  <h3 className="np-display text-lg">Onde as pessoas param</h3>
                  <p className="mt-1 mb-5 text-xs text-[var(--txt-3)]">
                    Base: {r.parciais} que não concluíram
                  </p>
                  <Barras fatias={p.abandono} limite={8} destaque="var(--polo-neg)" />
                </div>
              </section>
            )}

            {/* --- Respostas por pergunta ---------------------------- */}
            <h2 className="np-display mb-4 mt-12 text-2xl">Respostas por pergunta</h2>
            <section className="mb-10 grid gap-4 lg:grid-cols-2">
              {p.multiplas.map((d) => (
                <Bloco key={d.id} d={d} limite={8} />
              ))}
              {p.distribuicoes.map((d) => (
                <Bloco key={d.id} d={d} limite={8} />
              ))}
              {p.origem.length > 0 && (
                <section className="np-card">
                  <h3 className="np-display text-lg">Origem do acesso (UTM)</h3>
                  <p className="mt-1 mb-5 text-xs text-[var(--txt-3)]">
                    Base: {r.total} respostas
                  </p>
                  <Barras fatias={p.origem} limite={6} />
                </section>
              )}
            </section>

            {/* --- Palavras das pessoas ------------------------------ */}
            <h2 className="np-display mb-2 mt-12 text-2xl">O que escreveram</h2>
            <p className="mb-5 text-sm text-[var(--txt-2)]">
              {p.abertas.length} resposta{p.abertas.length === 1 ? "" : "s"} em texto livre.
              Detratores aparecem primeiro — é de onde sai a lista de correções.
            </p>
            <input
              type="search"
              className="np-input mb-5"
              placeholder="Buscar nas respostas (ex.: saque, suporte, plataforma)"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              aria-label="Buscar nas respostas abertas"
            />
            <div className="grid gap-4">
              {abertasFiltradas.length === 0 && (
                <p className="text-sm text-[var(--txt-2)]">Nada encontrado para essa busca.</p>
              )}
              {abertasFiltradas.slice(0, 200).map((a, i) => (
                <div key={i} className="np-card">
                  <div className="np-aberta" data-banda={a.banda}>
                    <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="np-rotulo">{a.campo}</span>
                      <span className="text-xs text-[var(--txt-3)]">{a.nome}</span>
                      {a.nota !== null && (
                        <span className="np-num text-xs text-[var(--txt-2)]">nota {a.nota}</span>
                      )}
                    </div>
                    <p className="leading-relaxed">{a.texto}</p>
                  </div>
                </div>
              ))}
              {abertasFiltradas.length > 200 && (
                <p className="text-sm text-[var(--txt-3)]">
                  Mostrando as primeiras 200 de {abertasFiltradas.length}.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
