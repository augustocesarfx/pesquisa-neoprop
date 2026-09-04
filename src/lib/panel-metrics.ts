/**
 * Transforma as linhas da planilha nas métricas do painel.
 *
 * Tudo aqui é função pura sobre `Record<string,string>` — é o que a planilha
 * devolve. Nenhuma métrica inventa dado: quando não há resposta suficiente
 * para um cálculo, o campo vem `null` e a tela mostra isso em vez de zero.
 *
 * Uma decisão que atravessa o arquivo: **o NPS só considera quem concluiu**.
 * Quem parou no meio pode ter dado a nota e desistido depois; misturar os dois
 * inflaria ou afundaria o índice sem que ninguém soubesse por quê.
 */

import {
  journeyStages,
  firstContacts,
  tradeMotivations,
  deskMotivations,
  expectations,
  communications,
  desiredContents,
  repurchaseIntents,
  repurchaseBarriers,
  supportOutcomes,
  failureFactors,
  transitions,
  withdrawalExperiences,
  themeLabel,
  type Option,
} from "@/components/pesquisa/survey-data";

export type Row = Record<string, string>;

export type Fatia = {
  valor: string;
  rotulo: string;
  quantidade: number;
  percentual: number;
};

export type Distribuicao = {
  id: string;
  pergunta: string;
  base: number;
  baseRotulo: string;
  fatias: Fatia[];
};

export type Aberta = {
  banda: "promoter" | "neutral" | "detractor" | "";
  nota: number | null;
  nome: string;
  texto: string;
  campo: string;
};

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

const rotulo = (opcoes: Option[], valor: string) =>
  opcoes.find((o) => o.value === valor)?.label ?? valor;

/** Múltipla escolha chega como "a; b; c" (o formato que o site grava). */
const lista = (v: string): string[] =>
  (v || "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

const numero = (v: string): number | null => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const pct = (parte: number, total: number) =>
  total > 0 ? Math.round((parte / total) * 1000) / 10 : 0;

export const bandaDaNota = (nota: number | null) => {
  if (nota === null) return "" as const;
  if (nota <= 6) return "detractor" as const;
  if (nota <= 8) return "neutral" as const;
  return "promoter" as const;
};

/**
 * Conta uma pergunta de escolha única. Só entram linhas que responderam —
 * o percentual é sobre quem respondeu aquela pergunta, não sobre o total,
 * senão perguntas que só aparecem para parte das pessoas (as ramificações)
 * pareceriam sempre irrelevantes.
 */
function distribuicaoUnica(
  id: string,
  pergunta: string,
  linhas: Row[],
  campo: string,
  opcoes: Option[]
): Distribuicao {
  const respondidas = linhas.filter((l) => (l[campo] ?? "") !== "");
  const contagem = new Map<string, number>();
  for (const l of respondidas) {
    const v = l[campo];
    contagem.set(v, (contagem.get(v) ?? 0) + 1);
  }
  const fatias = [...contagem.entries()]
    .map(([valor, quantidade]) => ({
      valor,
      rotulo: rotulo(opcoes, valor),
      quantidade,
      percentual: pct(quantidade, respondidas.length),
    }))
    .sort((a, b) => b.quantidade - a.quantidade);

  return {
    id,
    pergunta,
    base: respondidas.length,
    baseRotulo: "de quem respondeu esta pergunta",
    fatias,
  };
}

/**
 * Conta uma pergunta de múltipla escolha. O percentual é de PESSOAS que
 * marcaram a opção (não do total de marcações), que é o número que responde
 * "quantos dos meus clientes citaram isso".
 */
function distribuicaoMultipla(
  id: string,
  pergunta: string,
  linhas: Row[],
  campo: string,
  opcoes: Option[]
): Distribuicao {
  const respondidas = linhas.filter((l) => lista(l[campo] ?? "").length > 0);
  const contagem = new Map<string, number>();
  for (const l of respondidas) {
    for (const v of lista(l[campo])) {
      contagem.set(v, (contagem.get(v) ?? 0) + 1);
    }
  }
  const fatias = [...contagem.entries()]
    .map(([valor, quantidade]) => ({
      valor,
      rotulo: opcoes.length ? rotulo(opcoes, valor) : themeLabel(valor),
      quantidade,
      percentual: pct(quantidade, respondidas.length),
    }))
    .sort((a, b) => b.quantidade - a.quantidade);

  return {
    id,
    pergunta,
    base: respondidas.length,
    baseRotulo: "de quem respondeu (pode marcar mais de uma)",
    fatias,
  };
}

/* ------------------------------------------------------------------ */
/* Métrica principal                                                   */
/* ------------------------------------------------------------------ */

export function calcularPainel(todas: Row[]) {
  const linhas = todas.filter((l) => (l.id ?? "") !== "");
  const completas = linhas.filter((l) => l.status === "completo");
  const parciais = linhas.filter((l) => l.status !== "completo");

  /* --- NPS (só quem concluiu) ------------------------------------- */
  const comNota = completas
    .map((l) => numero(l.npsScore))
    .filter((n): n is number => n !== null);

  const promotores = comNota.filter((n) => n >= 9).length;
  const neutros = comNota.filter((n) => n >= 7 && n <= 8).length;
  const detratores = comNota.filter((n) => n <= 6).length;
  const nps =
    comNota.length > 0
      ? Math.round(((promotores - detratores) / comNota.length) * 100)
      : null;

  const media = (ns: number[]) =>
    ns.length ? Math.round((ns.reduce((a, b) => a + b, 0) / ns.length) * 10) / 10 : null;

  const confianca = media(
    completas.map((l) => numero(l.trustScore)).filter((n): n is number => n !== null)
  );

  const duracoes = completas
    .map((l) => numero(l.clientDurationMs))
    .filter((n): n is number => n !== null && n > 0 && n < 2 * 60 * 60 * 1000);
  const duracaoMediana = (() => {
    if (!duracoes.length) return null;
    const ord = [...duracoes].sort((a, b) => a - b);
    const meio = Math.floor(ord.length / 2);
    const ms = ord.length % 2 ? ord[meio] : (ord[meio - 1] + ord[meio]) / 2;
    return Math.round(ms / 1000);
  })();

  /* --- Onde as pessoas param -------------------------------------- */
  const abandono = (() => {
    const contagem = new Map<string, number>();
    for (const l of parciais) {
      const passo = l.progress || l.lastStep || "(logo no início)";
      contagem.set(passo, (contagem.get(passo) ?? 0) + 1);
    }
    return [...contagem.entries()]
      .map(([valor, quantidade]) => ({
        valor,
        rotulo: valor,
        quantidade,
        percentual: pct(quantidade, parciais.length),
      }))
      .sort((a, b) => b.quantidade - a.quantidade);
  })();

  /* --- Distribuições ----------------------------------------------- */
  const distribuicoes: Distribuicao[] = [
    distribuicaoUnica("expectation", "Expectativa versus entrega", completas, "expectation", expectations),
    distribuicaoUnica("journeyStage", "Momento da jornada", linhas, "journeyStage", journeyStages),
    distribuicaoUnica("communication", "Percepção da comunicação (60 dias)", completas, "communication", communications),
    distribuicaoUnica("repurchaseIntent", "Intenção de recompra", completas, "repurchaseIntent", repurchaseIntents),
    distribuicaoUnica("firstContact", "Como conheceu a Neoprop", linhas, "firstContact", firstContacts),
    distribuicaoUnica("tradeMotivation", "Por que começou no trade", linhas, "tradeMotivation", tradeMotivations),
    distribuicaoUnica("otherFirms", "Já comprou em outra mesa", linhas, "otherFirms", [
      { value: "yes", label: "Sim, já comprou em outra mesa" },
      { value: "no", label: "A Neoprop foi a primeira" },
    ]),
    distribuicaoUnica("supportOutcome", "Resultado do último atendimento", completas, "supportOutcome", supportOutcomes),
    distribuicaoUnica("failureFactor", "O que levou à reprovação ou abandono", completas, "failureFactor", failureFactors),
    distribuicaoUnica("realAccountTransition", "Transição para a conta real", completas, "realAccountTransition", transitions),
    distribuicaoUnica("withdrawalExperience", "Experiência de saque", completas, "withdrawalExperience", withdrawalExperiences),
  ].filter((d) => d.base > 0);

  const multiplas: Distribuicao[] = [
    distribuicaoMultipla("improvePoints", "Onde a Neoprop precisa melhorar", completas, "improvePoints", []),
    distribuicaoMultipla("valuePoints", "Onde a Neoprop entrega valor", completas, "valuePoints", []),
    distribuicaoMultipla("deskMotivations", "Por que operar por uma mesa", linhas, "deskMotivations", deskMotivations),
    distribuicaoMultipla("desiredContents", "O que gostariam de receber", completas, "desiredContents", desiredContents),
    distribuicaoMultipla("repurchaseBarrier", "O que pesa contra recomprar", completas, "repurchaseBarrier", repurchaseBarriers),
  ].filter((d) => d.base > 0);

  /* --- Cruzamentos: onde está o diagnóstico ------------------------ */
  const npsPor = (campo: string, opcoes: Option[]) => {
    const grupos = new Map<string, number[]>();
    for (const l of completas) {
      const chave = l[campo];
      const n = numero(l.npsScore);
      if (!chave || n === null) continue;
      grupos.set(chave, [...(grupos.get(chave) ?? []), n]);
    }
    return [...grupos.entries()]
      .map(([valor, notas]) => {
        const p = notas.filter((n) => n >= 9).length;
        const d = notas.filter((n) => n <= 6).length;
        return {
          valor,
          rotulo: rotulo(opcoes, valor),
          quantidade: notas.length,
          nps: Math.round(((p - d) / notas.length) * 100),
          notaMedia: media(notas),
        };
      })
      .filter((g) => g.quantidade > 0)
      .sort((a, b) => a.nps - b.nps);
  };

  /** Temas de melhoria citados só por quem é detrator — a fila de correção. */
  const temasPorBanda = (banda: "detractor" | "promoter", campo: string) => {
    const alvo = completas.filter((l) => bandaDaNota(numero(l.npsScore)) === banda);
    const contagem = new Map<string, number>();
    for (const l of alvo) {
      for (const t of lista(l[campo] ?? "")) contagem.set(t, (contagem.get(t) ?? 0) + 1);
    }
    return {
      base: alvo.length,
      itens: [...contagem.entries()]
        .map(([valor, quantidade]) => ({
          valor,
          rotulo: themeLabel(valor),
          quantidade,
          percentual: pct(quantidade, alvo.length),
        }))
        .sort((a, b) => b.quantidade - a.quantidade),
    };
  };

  /* --- Respostas abertas ------------------------------------------- */
  const camposAbertos: { campo: string; titulo: string }[] = [
    { campo: "npsReason", titulo: "Motivo da nota" },
    { campo: "improveDetail", titulo: "Detalhe do problema relatado" },
    { campo: "preserve", titulo: "O que não deve mudar" },
    { campo: "priorityFixOther", titulo: "Prioridade (outro)" },
    { campo: "withdrawalDetail", titulo: "O que aconteceu no saque" },
    { campo: "failureFactorOther", titulo: "Motivo da reprovação (outro)" },
    { campo: "otherFirmsNames", titulo: "Outras mesas citadas" },
  ];

  const abertas: Aberta[] = [];
  for (const l of linhas) {
    const nota = numero(l.npsScore);
    for (const { campo, titulo } of camposAbertos) {
      const texto = (l[campo] ?? "").trim();
      if (texto.length < 2) continue;
      abertas.push({
        banda: bandaDaNota(nota),
        nota,
        nome: l.respondentName || "(sem nome)",
        texto,
        campo: titulo,
      });
    }
  }
  // Detratores primeiro: é de onde sai a lista de correções.
  const ordem = { detractor: 0, neutral: 1, promoter: 2, "": 3 } as const;
  abertas.sort((a, b) => ordem[a.banda] - ordem[b.banda] || (a.nota ?? 0) - (b.nota ?? 0));

  /* --- Origem ------------------------------------------------------- */
  const origem = (() => {
    const contagem = new Map<string, number>();
    for (const l of linhas) {
      const v = (l.utmSource || "").trim() || "(sem utm)";
      contagem.set(v, (contagem.get(v) ?? 0) + 1);
    }
    return [...contagem.entries()]
      .map(([valor, quantidade]) => ({
        valor,
        rotulo: valor,
        quantidade,
        percentual: pct(quantidade, linhas.length),
      }))
      .sort((a, b) => b.quantidade - a.quantidade);
  })();

  const suspeitas = linhas.filter((l) => (l.flagged ?? "") !== "").length;

  return {
    resumo: {
      total: linhas.length,
      completas: completas.length,
      parciais: parciais.length,
      taxaConclusao: pct(completas.length, linhas.length),
      nps,
      comNota: comNota.length,
      promotores,
      neutros,
      detratores,
      pctPromotores: pct(promotores, comNota.length),
      pctNeutros: pct(neutros, comNota.length),
      pctDetratores: pct(detratores, comNota.length),
      confianca,
      duracaoMediana,
      suspeitas,
    },
    abandono,
    distribuicoes,
    multiplas,
    npsPorJornada: npsPor("journeyStage", journeyStages),
    npsPorExpectativa: npsPor("expectation", expectations),
    npsPorComunicacao: npsPor("communication", communications),
    corrigirPrimeiro: temasPorBanda("detractor", "improvePoints"),
    preservar: temasPorBanda("promoter", "valuePoints"),
    abertas,
    origem,
  };
}

export type Painel = ReturnType<typeof calcularPainel>;
