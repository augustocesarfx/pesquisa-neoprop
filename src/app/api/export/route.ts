import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Exporta as respostas da pesquisa.
 *
 * Autenticação por token próprio (variável EXPORT_TOKEN), enviado no
 * header `Authorization: Bearer <token>` ou em `?token=`:
 *
 *   GET /api/export?token=…            → JSON (resumo NPS + últimas 500)
 *   GET /api/export?token=…&format=csv → download CSV completo
 */

const CSV_COLUMNS = [
  "id",
  "createdAt",
  "respondentName",
  "respondentEmail",
  "respondentWhatsapp",
  "customerRef",
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
  "utmSource",
  "utmMedium",
  "utmCampaign",
  "utmContent",
  "utmTerm",
  "referrer",
  "clientDurationMs",
  "flagged",
] as const;

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text: string;
  if (Array.isArray(value)) text = value.join("; ");
  else if (value instanceof Date) text = value.toISOString();
  else text = String(value);
  if (/[",;\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

function authorized(req: NextRequest): boolean {
  const expected = process.env.EXPORT_TOKEN;
  if (!expected) return false; // sem token configurado, o export fica fechado
  const header = req.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  const provided = bearer || req.nextUrl.searchParams.get("token") || "";
  return provided.length > 0 && provided === expected;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (req.nextUrl.searchParams.get("format") === "csv") {
    const rows = await prisma.surveyResponse.findMany({
      orderBy: { createdAt: "desc" },
    });
    const lines = [
      CSV_COLUMNS.join(","),
      ...rows.map((row) => CSV_COLUMNS.map((col) => csvCell(row[col])).join(",")),
    ];
    // BOM para o Excel abrir acentuação corretamente
    return new NextResponse("﻿" + lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="pesquisa-neoprop-${new Date()
          .toISOString()
          .slice(0, 10)}.csv"`,
      },
    });
  }

  const [responses, total, bands] = await Promise.all([
    prisma.surveyResponse.findMany({ orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.surveyResponse.count(),
    prisma.surveyResponse.groupBy({ by: ["npsBand"], _count: { _all: true } }),
  ]);

  const bandCount = (band: string) =>
    bands.find((b) => b.npsBand === band)?._count._all ?? 0;
  const promoters = bandCount("promoter");
  const detractors = bandCount("detractor");
  const nps = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : null;

  return NextResponse.json({
    total,
    nps,
    promoters,
    neutrals: bandCount("neutral"),
    detractors,
    responses,
  });
}
