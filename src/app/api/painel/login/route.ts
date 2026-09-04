import { NextRequest, NextResponse } from "next/server";
import { abrirSessao, fecharSessao, painelConfigurado, senhaConfere } from "@/lib/panel-auth";

export const dynamic = "force-dynamic";

/** Troca a senha do painel por um cookie de sessão. */
export async function POST(req: NextRequest) {
  if (!painelConfigurado()) {
    return NextResponse.json(
      { ok: false, error: "painel_sem_senha" },
      { status: 503 }
    );
  }

  let body: { senha?: string };
  try {
    body = (await req.json()) as { senha?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "invalido" }, { status: 400 });
  }

  // Freio simples contra tentativa em série: a resposta demora um pouco.
  await new Promise((r) => setTimeout(r, 400));

  if (!senhaConfere(String(body.senha ?? ""))) {
    return NextResponse.json({ ok: false, error: "senha_incorreta" }, { status: 401 });
  }

  await abrirSessao();
  return NextResponse.json({ ok: true });
}

/** Sair do painel. */
export async function DELETE() {
  await fecharSessao();
  return NextResponse.json({ ok: true });
}
