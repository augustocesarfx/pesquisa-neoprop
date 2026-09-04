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

/**
 * Pergunta à planilha se este e-mail ou WhatsApp já CONCLUIU a pesquisa.
 *
 * Só o status `completo` bloqueia. Quem está em `parcial` parou no meio e
 * precisa poder continuar de onde estava — barrar essa pessoa seria perder
 * justamente a resposta que ainda dá para recuperar.
 *
 * Qualquer falha aqui (rede, script fora do ar, timeout) devolve
 * `found: false`: na dúvida, deixa a pessoa responder. Um respondente
 * duplicado é um problema muito menor do que barrar quem nunca respondeu.
 */
export async function alreadyCompleted(
  email: string,
  whatsapp: string
): Promise<{ found: boolean; by?: string }> {
  const url = process.env.SHEETS_WEBHOOK_URL;
  const token = process.env.SHEETS_TOKEN;
  if (!url || !token) return { found: false };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ token, action: "check", email, whatsapp }),
      signal: controller.signal,
      redirect: "follow",
    });
    if (!res.ok) return { found: false };
    const data = (await res.json()) as { ok?: boolean; found?: boolean; by?: string };
    return { found: Boolean(data?.ok && data.found), by: data?.by };
  } catch {
    return { found: false };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Baixa a planilha inteira para o painel de análise.
 *
 * Devolve linhas já convertidas em objetos {coluna: valor}, usando o
 * cabeçalho real da planilha — se alguém acrescentar uma coluna à mão, ela
 * vem junto em vez de quebrar a leitura.
 */
export async function listRows(): Promise<
  { ok: true; rows: Record<string, string>[] } | { ok: false; error: string }
> {
  const url = process.env.SHEETS_WEBHOOK_URL;
  const token = process.env.SHEETS_TOKEN;
  if (!url || !token) return { ok: false, error: "sheet_not_configured" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ token, action: "list" }),
      signal: controller.signal,
      redirect: "follow",
    });
    if (!res.ok) return { ok: false, error: `http_${res.status}` };
    const data = (await res.json()) as {
      ok?: boolean;
      header?: string[];
      rows?: unknown[][];
    };
    if (!data?.ok || !Array.isArray(data.header)) {
      return { ok: false, error: "resposta_invalida" };
    }
    const header = data.header.map((h) => String(h));
    const rows = (data.rows ?? []).map((linha) => {
      const obj: Record<string, string> = {};
      header.forEach((coluna, i) => {
        const v = linha[i];
        obj[coluna] = v === null || v === undefined ? "" : String(v);
      });
      return obj;
    });
    return { ok: true, rows };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "erro" };
  } finally {
    clearTimeout(timer);
  }
}
