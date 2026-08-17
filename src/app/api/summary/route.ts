import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { simulateImprovements, rankOpportunities } from "@/lib/improvement-simulator";
import { buildMonthlySummary } from "@/lib/monthly-summary";
import { AnalysisMode, kpiVisibleInMode } from "@/lib/analysis-mode";

/**
 * GET /api/summary?clinicId=xxx&yearMonth=2026-07
 *
 * ダッシュボード最上部に出す「今月のまとめ」と「今月やること トップ3」を返す。
 * 数字を並べる前に日本語で状況を伝えるためのエンドポイント。
 */

/** 傾向の判定に使う直近月（新しい順） */
const TREND_MONTHS = 4;
const TREND_CODES = ["newPatientCount", "totalPatientCount", "uniquePatientCount", "totalRevenue"];

function prevMonth(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 - n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    const userId = (session.user as { id?: string }).id;
    if (!userId) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const clinicId = searchParams.get("clinicId");
    const yearMonth = searchParams.get("yearMonth");
    if (!clinicId || !yearMonth) {
      return NextResponse.json({ error: "clinicId, yearMonthが必要です" }, { status: 400 });
    }

    const clinicUser = await prisma.clinicUser.findUnique({
      where: { userId_clinicId: { userId, clinicId } },
    });
    if (!clinicUser) {
      return NextResponse.json({ error: "アクセス権がありません" }, { status: 403 });
    }

    const months = Array.from({ length: TREND_MONTHS }, (_, i) => prevMonth(yearMonth, i));

    const [kpis, trendKpis, target, profile, clinic] = await Promise.all([
      prisma.monthlyKpis.findMany({
        where: { clinicId, yearMonth },
        select: { kpiCode: true, kpiValue: true, comparisonPrevMonth: true },
      }),
      prisma.monthlyKpis.findMany({
        where: { clinicId, yearMonth: { in: months }, kpiCode: { in: TREND_CODES } },
        select: { kpiCode: true, kpiValue: true, yearMonth: true },
      }),
      prisma.clinicTarget.findFirst({ where: { clinicId }, orderBy: { createdAt: "desc" } }),
      prisma.clinicProfile.findFirst({ where: { clinicId }, orderBy: { createdAt: "desc" } }),
      prisma.clinic.findUnique({ where: { id: clinicId }, select: { analysisMode: true } }),
    ]);

    if (kpis.length === 0) {
      return NextResponse.json({ lines: [], actions: [], hasData: false });
    }

    const mode = (clinic?.analysisMode ?? "INTEGRATED") as AnalysisMode;

    // 傾向は「新しい順」に整える
    const recentTrend: Record<string, number[]> = {};
    for (const code of TREND_CODES) {
      recentTrend[code] = months
        .map((m) => trendKpis.find((k) => k.yearMonth === m && k.kpiCode === code)?.kpiValue)
        .filter((v): v is number => v != null);
    }

    const lines = buildMonthlySummary(kpis, yearMonth, mode, recentTrend);

    // --- 今月やること（効果の高い順に3つ）---
    const kpiMap: Record<string, number> = {};
    for (const k of kpis) kpiMap[k.kpiCode] = k.kpiValue;

    const opportunities = simulateImprovements(
      kpiMap,
      target ?? {},
      { avgTreatmentMinutes: profile?.avgTreatmentMinutes }
    )
      // 分析モードで見られない指標の提案は出さない
      // （財務モードの医院に「チェア稼働率を上げましょう」と言っても根拠を確認できない）
      .filter((o) => kpiVisibleInMode(o.code, mode));

    const actions = rankOpportunities(opportunities, kpiMap.totalRevenue ?? 0).slice(0, 3);

    return NextResponse.json({
      lines,
      actions,
      hasData: true,
      // 全提案の合計ではなく、上位3件で見込める額（過大に見せないため）
      top3MonthlyImpact: actions.reduce((s, o) => s + o.monthlyImpact, 0),
      totalOpportunityCount: opportunities.length,
    });
  } catch (error) {
    console.error("Summary error:", error);
    return NextResponse.json({ error: "サマリーの取得に失敗しました" }, { status: 500 });
  }
}
