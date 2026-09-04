import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Sessão do painel: uma senha (PANEL_PASSWORD) troca por um cookie httpOnly.
 *
 * O cookie guarda um HMAC da senha, não a senha — quem ler o cookie no
 * navegador não descobre a credencial. httpOnly + sameSite=lax impedem que
 * JavaScript de terceiros ou um link externo o usem.
 *
 * Sem PANEL_PASSWORD configurada o painel fica FECHADO (nega tudo), em vez de
 * abrir sem senha: um painel com e-mail, WhatsApp e crítica de cliente não
 * pode ficar público por esquecimento de variável.
 */

const COOKIE = "np_painel";
const DURACAO = 60 * 60 * 12; // 12 horas

function segredo(): string | null {
  const senha = process.env.PANEL_PASSWORD;
  return senha && senha.length >= 8 ? senha : null;
}

function assinatura(senha: string): string {
  return createHmac("sha256", senha).update("painel-neoprop-v1").digest("hex");
}

/** Compara sem vazar tempo — evita descobrir a senha medindo a resposta. */
function iguais(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function senhaConfere(tentativa: string): boolean {
  const s = segredo();
  if (!s) return false;
  return iguais(tentativa, s);
}

export function painelConfigurado(): boolean {
  return segredo() !== null;
}

export async function abrirSessao(): Promise<void> {
  const s = segredo();
  if (!s) return;
  const jar = await cookies();
  jar.set(COOKIE, assinatura(s), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DURACAO,
  });
}

export async function fecharSessao(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function temSessao(): Promise<boolean> {
  const s = segredo();
  if (!s) return false;
  const jar = await cookies();
  const valor = jar.get(COOKIE)?.value;
  return Boolean(valor && iguais(valor, assinatura(s)));
}
