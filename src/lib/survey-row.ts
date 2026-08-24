/**
 * Formato de uma linha da planilha de respostas.
 *
 * A ordem de COLUMNS é o contrato com a planilha: é ela que define a ordem
 * do cabeçalho criado pelo Apps Script. Colunas novas devem ser adicionadas
 * NO FIM — inserir no meio desalinha as linhas já gravadas.
 */

export const COLUMNS = [
  // Controle
  "id",
  "createdAt",
  "updatedAt",
  "status", // parcial | completo
  "lastStep", // id da última pergunta alcançada
  "progress", // ex.: "7/19"
  // Identificação
  "respondentName",
  "respondentEmail",
  "respondentWhatsapp",
  "customerRef",
  // Respostas
  "npsScore",
  "npsBand",
  "npsReason",
  "journeyStage",
  "journeyStageSource",
  "firstContact",
  "firstContactDetail",
  "otherFirms",
  "otherFirmsNames",
  "tradeMotivation",
  "tradeMotivationOther",
  "deskMotivations",
  "deskMotivationsOther",
  "expectation",
  "valuePoints",
  "valuePointsOther",
  "improvePoints",
  "improvePointsOther",
  "improveDetailTheme",
  "improveDetail",
  "supportOutcome",
  "supportEase",
  "failureFactor",
  "failureFactorOther",
  "realAccountTransition",
  "withdrawalExperience",
  "withdrawalDetail",
  "trustScore",
  "communication",
  "desiredContents",
  "repurchaseIntent",
  "repurchaseBarrier",
  "repurchaseBarrierOther",
  "priorityFix",
  "priorityFixOther",
  "preserve",
  // Origem e qualidade do dado
  "utmSource",
  "utmMedium",
  "utmCampaign",
  "utmContent",
  "utmTerm",
  "referrer",
  "clientDurationMs",
  "flagged",
] as const;

export type Column = (typeof COLUMNS)[number];

/** Valores aceitos numa célula. Arrays viram texto separado por "; ". */
export type CellValue = string | number | null;

export type SurveyRow = Partial<Record<Column, CellValue>> & { id: string };

/** Normaliza um valor para célula: array vira lista legível, vazio vira null. */
export function cell(value: unknown): CellValue {
  if (value === null || value === undefined || value === "") return null;
  if (Array.isArray(value)) return value.length ? value.join("; ") : null;
  if (typeof value === "number") return value;
  return String(value);
}
