import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { analyzeSeasonality } from "@/lib/seasonality";
import { KPI_DEFINITIONS } from "@/lib/kpi-calculator";

/**
 * GET /api/seasonality?clinicId=xxx&kpiCode=totalRevenue
 *
 * 季節パターンを検出して日本語の所見を返す。
 * 期間は指定させず、保有する全月を使う。季節性はデータが多いほど精度が上がるため。
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const clinicId = searchParams.get("clinicId");
    const kpiCode = searchParams.get("kpiCode") || "totalRevenue";

    if (!clinicId) {
      return NextResponse.json({ error: "clinicIdが必要です" }, { status: 400 });
    }
    if (!KPI_DEFINITIONS[kpiCode]) {
      return NextResponse.json({ error: "不明なKPIコードです" }, { status: 400 });
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

    const kpis = await prisma.monthlyKpis.findMany({
      where: { clinicId, kpiCode },
      orderBy: { yearMonth: "asc" },
      select: { yearMonth: true, kpiValue: true },
    });

    const result = analyzeSeasonality(kpis.map((k) => ({ yearMonth: k.yearMonth, value: k.kpiValue })));

    return NextResponse.json({ ...result, kpiCode, kpiName: KPI_DEFINITIONS[kpiCode].name });
  } catch (error) {
    console.error("Seasonality analysis error:", error);
    return NextResponse.json({ error: "季節性の分析に失敗しました" }, { status: 500 });
  }
}
