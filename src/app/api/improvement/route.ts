import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { simulateImprovements } from "@/lib/improvement-simulator";

/**
 * GET /api/improvement?clinicId=xxx&yearMonth=2026-07
 *
 * 現状値と目標値のギャップを金額インパクトに換算して返す。
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const clinicId = searchParams.get("clinicId");
    const yearMonth = searchParams.get("yearMonth");

    if (!clinicId || !yearMonth) {
      return NextResponse.json({ error: "clinicId, yearMonthが必要です" }, { status: 400 });
    }

    const userId = (session.user as { id?: string }).id;
    if (!userId) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const clinicUser = await prisma.clinicUser.findUnique({
      where: { userId_clinicId: { userId, clinicId } },
    });
    if (!clinicUser) {
      return NextResponse.json({ error: "アクセス権がありません" }, { status: 403 });
    }

    const [kpis, target, profile] = await Promise.all([
      prisma.monthlyKpis.findMany({
        where: { clinicId, yearMonth },
        select: { kpiCode: true, kpiValue: true },
      }),
      prisma.clinicTarget.findFirst({ where: { clinicId }, orderBy: { createdAt: "desc" } }),
      prisma.clinicProfile.findFirst({ where: { clinicId }, orderBy: { createdAt: "desc" } }),
    ]);

    if (kpis.length === 0) {
      return NextResponse.json({ opportunities: [], totalMonthlyImpact: 0 });
    }

    const kpiMap: Record<string, number> = {};
    for (const k of kpis) kpiMap[k.kpiCode] = k.kpiValue;

    const opportunities = simulateImprovements(
      kpiMap,
      target ?? {},
      { avgTreatmentMinutes: profile?.avgTreatmentMinutes }
    );

    return NextResponse.json({
      opportunities,
      totalMonthlyImpact: opportunities.reduce((s, o) => s + o.monthlyImpact, 0),
    });
  } catch (error) {
    console.error("Improvement simulation error:", error);
    return NextResponse.json({ error: "改善額の試算に失敗しました" }, { status: 500 });
  }
}
