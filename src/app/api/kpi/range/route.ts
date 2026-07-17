import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { calculateKpis } from "@/lib/kpi-calculator";

/**
 * GET /api/kpi/range?clinicId=xxx&from=2025-08&to=2026-07
 *
 * 期間内の全月のKPIを1回のリクエストで返す。
 * 月ごとに /api/kpi を呼ぶと期間の月数だけ往復が発生するため、トレンドグラフはこちらを使う。
 * yearMonth は "YYYY-MM" 固定長なので文字列比較で範囲指定できる。
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const clinicId = searchParams.get("clinicId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (!clinicId || !from || !to) {
      return NextResponse.json({ error: "clinicId, from, toが必要です" }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}$/.test(from) || !/^\d{4}-\d{2}$/.test(to)) {
      return NextResponse.json({ error: "from, toはYYYY-MM形式で指定してください" }, { status: 400 });
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

    const range = { gte: from, lte: to };

    // 保存済みKPIを一括取得
    const stored = await prisma.monthlyKpis.findMany({
      where: { clinicId, yearMonth: range },
      select: { yearMonth: true, kpiCode: true, kpiValue: true },
      orderBy: { yearMonth: "asc" },
    });

    const byMonth = new Map<string, Record<string, number>>();
    for (const k of stored) {
      if (!byMonth.has(k.yearMonth)) byMonth.set(k.yearMonth, {});
      byMonth.get(k.yearMonth)![k.kpiCode] = k.kpiValue;
    }

    // 実績はあるがKPI未計算の月を補完する（CSV取込直後など）
    const monthsWithData = (
      await prisma.monthlyRevenue.findMany({
        where: { clinicId, yearMonth: range },
        select: { yearMonth: true },
        distinct: ["yearMonth"],
      })
    ).map((m) => m.yearMonth);

    const missing = monthsWithData.filter((m) => !byMonth.has(m));
    if (missing.length > 0) {
      const profile = await prisma.clinicProfile.findFirst({
        where: { clinicId },
        orderBy: { createdAt: "desc" },
      });
      const profileData = profile || {
        unitCount: 0, activeUnitCount: 0,
        fulltimeDentistCount: 0, parttimeDentistCount: 0,
        fulltimeHygienistCount: 0, parttimeHygienistCount: 0,
        clinicDaysPerMonth: 22,
      };

      for (const yearMonth of missing) {
        const [revenue, patients, appointments, costs] = await Promise.all([
          prisma.monthlyRevenue.findMany({ where: { clinicId, yearMonth } }),
          prisma.monthlyPatients.findMany({ where: { clinicId, yearMonth } }),
          prisma.monthlyAppointments.findMany({ where: { clinicId, yearMonth } }),
          prisma.monthlyCosts.findMany({ where: { clinicId, yearMonth } }),
        ]);
        const kpis = calculateKpis({ revenue, patients, appointments, costs } as never, profileData as never);

        const values: Record<string, number> = {};
        for (const kpi of kpis) {
          values[kpi.kpiCode] = kpi.kpiValue;
          await prisma.monthlyKpis.upsert({
            where: { clinicId_yearMonth_kpiCode: { clinicId, yearMonth, kpiCode: kpi.kpiCode } },
            update: { kpiValue: kpi.kpiValue, benchmarkValue: kpi.benchmarkValue ?? null },
            create: {
              clinicId, yearMonth, kpiCode: kpi.kpiCode, kpiValue: kpi.kpiValue,
              benchmarkValue: kpi.benchmarkValue ?? null,
            },
          });
        }
        byMonth.set(yearMonth, values);
      }
    }

    const result = Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([yearMonth, values]) => ({ yearMonth, values }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("KPI range fetch error:", error);
    return NextResponse.json({ error: "期間KPIの取得に失敗しました" }, { status: 500 });
  }
}
