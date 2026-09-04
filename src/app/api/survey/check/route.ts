import { NextRequest, NextResponse } from "next/server";
import { alreadyCompleted } from "@/lib/sheet";

export const dynamic = "force-dynamic";

/**
 * Responde se um e-mail ou WhatsApp já concluiu a pesquisa.
 *
 * Chamada quando a pessoa termina a etapa de identificação: se ela já
 * respondeu tudo antes (em outro aparelho, outro navegador, ou depois de
 * limpar o histórico), a página mostra o agradecimento em vez de fazer ela
 * responder 17 perguntas de novo.
 *
 * Devolve apenas `found: true|false` — nunca nome, nota ou qualquer resposta
 * de quem já participou. Ainda assim é um endpoint público que aceita um
 * e-mail e diz se ele está na base, então tem limite por IP: sem isso daria
 * para varrer uma lista de e-mails e descobrir quem respondeu.
 */

const RATE_LIMIT = 40; // consultas por IP por hora
const rateMap = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const windowStart = now - 60 * 60 * 1000;
  const hits = (rateMap.get(ip) ?? []).filter((t) => t > windowStart);
  if (hits.length >= RATE_LIMIT) {
    rateMap.set(ip, hits);
    return true;
  }
  hits.push(now);
  rateMap.set(ip, hits);
  if (rateMap.size > 5000) {
    for (const [key, value] of rateMap) {
      if (value.every((t) => t <= windowStart)) rateMap.delete(key);
    }
  }
  return false;
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  // Estourar o limite não pode travar quem está respondendo de boa-fé:
  // devolve "não encontrado" e a pessoa segue para a pesquisa.
  if (rateLimited(ip)) return NextResponse.json({ found: false });

  let body: { email?: string; whatsapp?: string };
  try {
    body = (await req.json()) as { email?: string; whatsapp?: string };
  } catch {
    return NextResponse.json({ found: false });
  }

  const email = String(body.email ?? "").trim().toLowerCase().slice(0, 200);
  const whatsapp = String(body.whatsapp ?? "").replace(/\D/g, "").slice(0, 20);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const phoneOk = whatsapp.length >= 10 && whatsapp.length <= 13;
  if (!emailOk && !phoneOk) return NextResponse.json({ found: false });

  const result = await alreadyCompleted(emailOk ? email : "", phoneOk ? whatsapp : "");
  return NextResponse.json({ found: result.found });
}
