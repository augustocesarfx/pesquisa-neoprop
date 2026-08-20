/**
 * Definições da pesquisa de experiência Neoprop: opções, rótulos e regras
 * de ramificação. Nenhum termo interno (detrator/promotor/CES) aparece nos
 * rótulos exibidos ao participante — a classificação fica no servidor.
 */

export type Option = { value: string; label: string };

export type SurveyAnswers = {
  respondentName: string;
  respondentEmail: string;
  respondentWhatsapp: string;
  npsScore: number | null;
  npsReason: string;
  journeyStage: string;
  journeyStageSource: "form" | "url";
  firstContact: string;
  firstContactDetail: string;
  otherFirms: "" | "yes" | "no";
  otherFirmsNames: string;
  tradeMotivation: string;
  tradeMotivationOther: string;
  deskMotivations: string[];
  deskMotivationsOther: string;
  expectation: string;
  valuePoints: string[];
  valuePointsOther: string;
  improvePoints: string[];
  improvePointsOther: string;
  improveDetail: string;
  supportOutcome: string;
  supportEase: number | null;
  failureFactor: string;
  failureFactorOther: string;
  realAccountTransition: string;
  withdrawalExperience: string;
  withdrawalDetail: string;
  trustScore: number | null;
  communication: string;
  desiredContents: string[];
  repurchaseIntent: string;
  repurchaseBarrier: string[];
  repurchaseBarrierOther: string;
  priorityFix: string;
  priorityFixOther: string;
  preserve: string;
};

export const emptyAnswers: SurveyAnswers = {
  respondentName: "",
  respondentEmail: "",
  respondentWhatsapp: "",
  npsScore: null,
  npsReason: "",
  journeyStage: "",
  journeyStageSource: "form",
  firstContact: "",
  firstContactDetail: "",
  otherFirms: "",
  otherFirmsNames: "",
  tradeMotivation: "",
  tradeMotivationOther: "",
  deskMotivations: [],
  deskMotivationsOther: "",
  expectation: "",
  valuePoints: [],
  valuePointsOther: "",
  improvePoints: [],
  improvePointsOther: "",
  improveDetail: "",
  supportOutcome: "",
  supportEase: null,
  failureFactor: "",
  failureFactorOther: "",
  realAccountTransition: "",
  withdrawalExperience: "",
  withdrawalDetail: "",
  trustScore: null,
  communication: "",
  desiredContents: [],
  repurchaseIntent: "",
  repurchaseBarrier: [],
  repurchaseBarrierOther: "",
  priorityFix: "",
  priorityFixOther: "",
  preserve: "",
};

/* ------------------------------------------------------------------ */
/* Opções                                                              */
/* ------------------------------------------------------------------ */

export const journeyStages: Option[] = [
  { value: "bought_not_started", label: "Comprei, mas ainda não comecei" },
  { value: "in_evaluation", label: "Estou realizando a avaliação" },
  { value: "approved_waiting", label: "Fui aprovado e estou aguardando a conta real" },
  { value: "real_no_withdrawal", label: "Estou operando na conta real e ainda não solicitei saque" },
  { value: "withdrawal_requested", label: "Já solicitei um saque e estou aguardando a conclusão" },
  { value: "withdrawal_received", label: "Já recebi um ou mais saques" },
  { value: "reproved_retry", label: "Fui reprovado e pretendo tentar novamente" },
  { value: "reproved_no_retry", label: "Fui reprovado e não pretendo tentar novamente" },
  { value: "abandoned", label: "Parei ou abandonei antes de concluir" },
  { value: "former_customer", label: "Não sou mais cliente" },
  { value: "other", label: "Outro" },
];

export const firstContacts: Option[] = [
  { value: "instagram", label: "Pelo Instagram da Neoprop" },
  { value: "youtube", label: "Pelo YouTube da Neoprop" },
  { value: "google", label: "Por meio de uma pesquisa no Google" },
  { value: "referral", label: "Por indicação de um amigo ou de outro trader" },
  { value: "partner", label: "Por meio de um parceiro ou afiliado da Neoprop" },
  { value: "creator", label: "Por meio de um professor, influenciador ou criador de conteúdo" },
  { value: "community", label: "Em um grupo ou comunidade de traders" },
  { value: "other", label: "Outro" },
];

/** Rótulo do campo complementar da origem, por opção que o abre. */
export const firstContactDetailLabel: Record<string, string> = {
  partner: "Se você se lembrar, qual parceiro apresentou a Neoprop para você?",
  creator: "Quem apresentou a Neoprop para você?",
  other: "Conte para a gente como você conheceu a Neoprop.",
};

export const tradeMotivations: Option[] = [
  { value: "extra_income", label: "Construir uma fonte de renda complementar" },
  { value: "live_from_market", label: "Viver exclusivamente do mercado" },
  { value: "financial_freedom", label: "Conquistar mais liberdade financeira" },
  { value: "flexibility", label: "Ter mais flexibilidade de horário e localização" },
  { value: "change_reality", label: "Mudar minha realidade financeira e a da minha família" },
  { value: "build_wealth", label: "Construir e aumentar meu patrimônio" },
  { value: "new_career", label: "Começar uma nova profissão ou mudar de carreira" },
  { value: "own_results", label: "Buscar uma atividade em que meu resultado dependesse mais de mim" },
  { value: "market_interest", label: "Interesse pelo mercado financeiro e pelo desafio" },
  { value: "influence", label: "Influência de amigos, familiares ou criadores de conteúdo" },
  { value: "other", label: "Outro" },
];

export const deskMotivations: Option[] = [
  { value: "no_capital", label: "Eu não tinha capital próprio suficiente para operar" },
  { value: "more_capital", label: "Queria ter acesso a mais capital e margem" },
  { value: "protect_savings", label: "Queria evitar colocar minhas economias em risco" },
  { value: "less_pressure", label: "Queria reduzir a pressão de operar com meu próprio dinheiro" },
  { value: "scale_strategy", label: "Queria escalar uma estratégia que já apresentava bons resultados" },
  { value: "bigger_positions", label: "Queria operar posições que meu capital próprio não permitia" },
  { value: "structure", label: "Buscava uma estrutura mais profissional e regras de risco definidas" },
  { value: "income_from_performance", label: "Queria transformar meu desempenho em possibilidade de saque e renda" },
  { value: "comeback", label: "Queria voltar ao mercado após perder ou comprometer meu próprio capital" },
  { value: "accessible", label: "Considerei mais acessível do que construir sozinho o mesmo capital" },
  { value: "try_model", label: "Queria conhecer e testar o modelo de mesa proprietária" },
  { value: "trusted_referral", label: "Entrei por indicação de alguém em quem confio" },
  { value: "other", label: "Outro" },
];

export const expectations: Option[] = [
  { value: "far_below", label: "Muito abaixo do esperado" },
  { value: "below", label: "Um pouco abaixo do esperado" },
  { value: "as_expected", label: "Exatamente como eu esperava" },
  { value: "above", label: "Um pouco acima do esperado" },
  { value: "far_above", label: "Muito acima do esperado" },
  { value: "too_early", label: "Ainda não tive experiência suficiente para avaliar" },
];

/** Temas comuns a "pontos de valor" e "pontos de melhoria". */
const themeLabels: Record<string, string> = {
  purchase: "Compra e acesso à conta",
  rules_clarity: "Clareza das regras",
  rules_fit: "Adequação das regras ao meu perfil",
  platform: "Plataforma e estabilidade técnica",
  support: "Atendimento e suporte",
  evaluation: "Processo de avaliação",
  transition: "Transição depois da aprovação",
  real_account: "Experiência na conta real",
  withdrawal: "Solicitação e recebimento de saque",
  communication: "Comunicação e conteúdo",
  frequency: "Frequência de mensagens, lives e ofertas",
  price: "Preço e condições",
  trader_area: "Área do trader",
};

/** Etapas vividas por estágio — temas fora da vivência são ocultados. */
function livedThemes(stage: string): Set<string> {
  const base = new Set([
    "purchase",
    "rules_clarity",
    "rules_fit",
    "support",
    "communication",
    "frequency",
    "price",
    "trader_area",
  ]);
  const addEvaluation = () => {
    base.add("platform");
    base.add("evaluation");
  };
  switch (stage) {
    case "bought_not_started":
      break;
    case "in_evaluation":
    case "reproved_retry":
    case "reproved_no_retry":
    case "abandoned":
      addEvaluation();
      break;
    case "approved_waiting":
      addEvaluation();
      base.add("transition");
      break;
    case "real_no_withdrawal":
      addEvaluation();
      base.add("transition");
      base.add("real_account");
      break;
    case "withdrawal_requested":
    case "withdrawal_received":
      addEvaluation();
      base.add("transition");
      base.add("real_account");
      base.add("withdrawal");
      break;
    default:
      // "former_customer" | "other" | desconhecido: histórico incerto — mostra tudo
      Object.keys(themeLabels).forEach((t) => base.add(t));
  }
  return base;
}

const valueThemeOrder = [
  "purchase",
  "rules_clarity",
  "rules_fit",
  "platform",
  "support",
  "evaluation",
  "transition",
  "real_account",
  "withdrawal",
  "communication",
  "price",
  "trader_area",
];

const improveThemeOrder = [
  "purchase",
  "rules_clarity",
  "rules_fit",
  "platform",
  "support",
  "evaluation",
  "transition",
  "real_account",
  "withdrawal",
  "communication",
  "frequency",
  "price",
  "trader_area",
];

export const VALUE_NONE = "none";
export const IMPROVE_NONE = "none";

export function valueOptions(stage: string): Option[] {
  const lived = livedThemes(stage);
  const opts = valueThemeOrder
    .filter((t) => lived.has(t))
    .map((t) => ({ value: t, label: themeLabels[t] }));
  opts.push({ value: VALUE_NONE, label: "Não identifico um ponto de destaque" });
  opts.push({ value: "other", label: "Outro" });
  return opts;
}

export function improveOptions(stage: string): Option[] {
  const lived = livedThemes(stage);
  const opts = improveThemeOrder
    .filter((t) => lived.has(t))
    .map((t) => ({ value: t, label: themeLabels[t] }));
  opts.push({ value: IMPROVE_NONE, label: "Não identifiquei um problema relevante" });
  opts.push({ value: "other", label: "Outro" });
  return opts;
}

/** Temas críticos (confiança) que abrem UM campo complementar, em ordem de prioridade. */
const criticalThemes = ["withdrawal", "support", "rules_clarity", "platform", "real_account", "other"];

export function criticalTheme(improvePoints: string[]): string | null {
  return criticalThemes.find((t) => improvePoints.includes(t)) ?? null;
}

export function themeLabel(theme: string): string {
  if (theme === "other") return "Outro";
  return themeLabels[theme] ?? theme;
}

export const supportOutcomes: Option[] = [
  { value: "first_contact", label: "Resolvido no primeiro contato" },
  { value: "multiple_contacts", label: "Resolvido depois de mais de um contato" },
  { value: "partially", label: "Parcialmente resolvido" },
  { value: "unresolved", label: "Não resolvido" },
  { value: "in_progress", label: "Ainda está em andamento" },
];

export const failureFactors: Option[] = [
  { value: "risk_discipline", label: "Gestão de risco ou disciplina da minha parte" },
  { value: "rule_misunderstood", label: "Não compreendi alguma regra" },
  { value: "rules_mismatch", label: "As regras não se encaixaram no meu operacional" },
  { value: "platform_issue", label: "Problema de plataforma ou tecnologia" },
  { value: "no_support", label: "Falta de suporte no momento necessário" },
  { value: "no_time", label: "Falta de tempo para operar" },
  { value: "lost_confidence", label: "Perdi a confiança na jornada" },
  { value: "other", label: "Outro" },
];

export const transitions: Option[] = [
  { value: "fast_clear", label: "Foi rápida, clara e simples" },
  { value: "clear_slow", label: "Foi clara, mas demorou mais do que eu esperava" },
  { value: "had_doubts", label: "Tive dúvidas durante o processo" },
  { value: "needed_support", label: "Precisei procurar o suporte para conseguir avançar" },
  { value: "confusing", label: "O processo foi confuso ou difícil" },
  { value: "still_waiting", label: "Ainda estou aguardando a conclusão" },
  { value: "cannot_evaluate", label: "Não consigo avaliar" },
];

export const withdrawalExperiences: Option[] = [
  { value: "smooth", label: "O processo foi simples e concluído dentro do prazo" },
  { value: "unclear", label: "Recebi o saque, mas o processo poderia ser mais claro" },
  { value: "needed_support", label: "Precisei procurar o suporte" },
  { value: "delayed", label: "O processo demorou mais do que eu esperava" },
  { value: "in_review", label: "A solicitação ainda está em análise" },
  { value: "unresolved", label: "Tive um problema que ainda não foi resolvido" },
  { value: "no_answer", label: "Prefiro não responder" },
];

/** Experiências de saque que abrem o campo "O que aconteceu?". */
export const withdrawalProblemValues = new Set(["needed_support", "delayed", "unresolved"]);

export const communications: Option[] = [
  { value: "adequate", label: "A quantidade está adequada e geralmente é relevante" },
  { value: "slightly_high", label: "Está um pouco acima do ideal, mas ainda acompanho" },
  { value: "too_high", label: "Está muito acima do ideal e comecei a ignorar boa parte" },
  { value: "repetitive", label: "A quantidade não é o principal problema, mas o conteúdo ficou repetitivo" },
  { value: "mismatched", label: "A quantidade não é o principal problema, mas as mensagens não combinam com o meu momento" },
  { value: "barely_any", label: "Recebi pouco ou não me lembro" },
];

export const NO_MARKETING = "no_marketing";

export const desiredContents: Option[] = [
  { value: "account_alerts", label: "Avisos operacionais sobre minha conta" },
  { value: "rule_changes", label: "Mudanças de regras, planos e produtos" },
  { value: "education", label: "Conteúdo educacional objetivo" },
  { value: "lives", label: "Lives de operação ou análise" },
  { value: "real_cases", label: "Cases com aprendizados reais, inclusive erros" },
  { value: "transparency", label: "Informações sobre saques e transparência da operação" },
  { value: "exceptional_offers", label: "Ofertas somente quando forem realmente excepcionais" },
  { value: "community", label: "Bastidores, comunidade e histórias de clientes" },
  { value: NO_MARKETING, label: "Prefiro não receber comunicações de marketing" },
  { value: "other", label: "Outro" },
];

export const REPURCHASE_FIRST_CHOICE = "first_choice";

export const repurchaseIntents: Option[] = [
  { value: REPURCHASE_FIRST_CHOICE, label: "A Neoprop seria minha primeira opção" },
  { value: "would_compare", label: "Eu consideraria a Neoprop, mas compararia com outras" },
  { value: "another_company", label: "Provavelmente escolheria outra empresa" },
  { value: "not_now", label: "Não compraria nenhuma conta neste momento" },
  { value: "no_interest", label: "Não tenho mais interesse em mesa proprietária" },
  { value: "unsure", label: "Ainda não sei" },
];

export const PRIORITY_NOTHING = "nothing";

/**
 * Opções da prioridade de correção (30 dias): mesmos temas dos pontos de
 * melhoria vividos pelo participante, mais uma saída neutra e "Outro".
 */
export function priorityOptions(stage: string): Option[] {
  const opts = improveOptions(stage).filter(
    (o) => o.value !== IMPROVE_NONE && o.value !== "other"
  );
  opts.push({ value: PRIORITY_NOTHING, label: "Não mudaria nada agora" });
  opts.push({ value: "other", label: "Outro" });
  return opts;
}

export const repurchaseBarriers: Option[] = [
  { value: "price", label: "Preço ou condição comercial" },
  { value: "rules", label: "Regras e limites de perda" },
  { value: "platform", label: "Plataforma" },
  { value: "support", label: "Atendimento" },
  { value: "trust", label: "Confiança na empresa ou no saque" },
  { value: "bad_experience", label: "Uma experiência anterior negativa" },
  { value: "too_much_communication", label: "Excesso de comunicação e ofertas" },
  { value: "better_offer", label: "Uma oferta melhor de outra empresa" },
  { value: "finances", label: "Meu momento financeiro" },
  { value: "own_performance", label: "Minha própria performance ou disciplina" },
  { value: "no_need", label: "Não preciso de outra conta agora" },
  { value: "other", label: "Outro" },
];

/* ------------------------------------------------------------------ */
/* Ramificações (visibilidade de etapas)                               */
/* ------------------------------------------------------------------ */

export const reprovedOrAbandonedStages = new Set([
  "reproved_retry",
  "reproved_no_retry",
  "abandoned",
]);

export const realAccountStages = new Set([
  "approved_waiting",
  "real_no_withdrawal",
  "withdrawal_requested",
  "withdrawal_received",
]);

export const withdrawalStages = new Set([
  "withdrawal_requested",
  "withdrawal_received",
]);

export function supportBranchActive(a: SurveyAnswers): boolean {
  return a.valuePoints.includes("support") || a.improvePoints.includes("support");
}

/** Texto da pergunta 2, adaptado à nota (sem expor a classificação). */
export function npsReasonQuestion(score: number): string {
  if (score <= 6) return "Qual foi o principal motivo da sua nota?";
  if (score <= 8) return "O que faltou para sua experiência merecer uma nota 9 ou 10?";
  return "O que mais pesou para você dar essa nota?";
}
