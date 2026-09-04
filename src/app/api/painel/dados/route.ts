import { NextResponse } from "next/server";
import { listRows } from "@/lib/sheet";
import { calcularPainel } from "@/lib/panel-metrics";
import { painelConfigurado, temSessao } from "@/lib/panel-auth";

export const dynamic = "force-dynamic";

/**
 * Métricas do painel. Exige sessão — a resposta contém nome, e-mail,
 * WhatsApp e a crítica de cada cliente.
 */
export async function GET() {
  if (!painelConfigurado()) {
    return NextResponse.json(
      { ok: false, error: "painel_sem_senha" },
      { status: 503 }
    );
  }
  if (!(await temSessao())) {
    return NextResponse.json({ ok: false, error: "sem_sessao" }, { status: 401 });
  }

  const planilha = await listRows();
  if (!planilha.ok) {
    return NextResponse.json(
      { ok: false, error: planilha.error },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    atualizadoEm: new Date().toISOString(),
    painel: calcularPainel(planilha.rows),
  });
}
