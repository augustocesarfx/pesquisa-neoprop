/**
 * Gravação das respostas na planilha do Google.
 *
 * O destino é um Web App do Apps Script publicado a partir da própria
 * planilha (código em scripts/apps-script/Codigo.gs). Ele faz o upsert pelo
 * `id`: cria a linha na primeira gravação e atualiza a mesma linha nas
 * seguintes — é isso que permite registrar quem parou no meio e depois
 * completar a linha se a pessoa voltar.
 *
 * Falha de rede aqui NUNCA pode derrubar a resposta do usuário: quem chama
 * trata o `ok: false` e decide o que devolver ao cliente.
 */

import { COLUMNS, type SurveyRow } from "./survey-row";

const TIMEOUT_MS = 10_000;

export type SheetResult =
  | { ok: true; created: boolean }
  | { ok: false; error: string };

export function sheetConfigured(): boolean {
  return Boolean(process.env.SHEETS_WEBHOOK_URL && process.env.SHEETS_TOKEN);
}

export async function upsertRow(row: SurveyRow): Promise<SheetResult> {
  const url = process.env.SHEETS_WEBHOOK_URL;
  const token = process.env.SHEETS_TOKEN;
  if (!url || !token) return { ok: false, error: "sheet_not_configured" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      // text/plain evita o preflight CORS do Apps Script
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ token, columns: COLUMNS, row }),
      signal: controller.signal,
      redirect: "follow",
    });

    if (!res.ok) return { ok: false, error: `sheet_http_${res.status}` };

    const data = (await res.json()) as { ok?: boolean; created?: boolean; error?: string };
    if (!data.ok) return { ok: false, error: data.error || "sheet_rejected" };
    return { ok: true, created: Boolean(data.created) };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return { ok: false, error: aborted ? "sheet_timeout" : "sheet_unreachable" };
  } finally {
    clearTimeout(timer);
  }
}
