import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { calculateKpis } from "@/lib/kpi-calculator";

// GET /api/kpi?clinicId=xxx&yearMonth=2025-01 - KPI取得（なければ自動計算）
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

    // アクセス権確認
    const clinicUser = await prisma.clinicUser.findUnique({
      where: {
        userId_clinicId: {
          userId: (session.user as any).id,
          clinicId,
        },
      },
    });
    if (!clinicUser) {
      return NextResponse.json({ error: "アクセス権がありません" }, { status: 403 });
    }

    // 保存済みKPIがあればそれを返す
    const existingKpis = await prisma.monthlyKpis.findMany({
      where: { clinicId, yearMonth },
    });

    if (existingKpis.length > 0) {
      return NextResponse.json(existingKpis);
    }

    // なければ月次データから計算
    const [revenue, patients, appointments, costs, profile] = await Promise.all([
      prisma.monthlyRevenue.findMany({ where: { clinicId, yearMonth } }),
      prisma.monthlyPatients.findMany({ where: { clinicId, yearMonth } }),
      prisma.monthlyAppointments.findMany({ where: { clinicId, yearMonth } }),
      prisma.monthlyCosts.findMany({ where: { clinicId, yearMonth } }),
      prisma.clinicProfile.findFirst({
        where: { clinicId },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    if (revenue.length === 0 && patients.length === 0) {
      return NextResponse.json([]);
    }

    const profileData = profile || {
      unitCount: 0,
      activeUnitCount: 0,
      fulltimeDentistCount: 0,
      parttimeDentistCount: 0,
      fulltimeHygienistCount: 0,
      parttimeHygienistCount: 0,
      clinicDaysPerMonth: 22,
    };

    const kpis = calculateKpis(
      { revenue, patients, appointments, costs },
      profileData
    );

    // 前月比計算
    const prevMonth = getPrevMonth(yearMonth);
    const prevKpis: { kpiCode: string; kpiValue: number }[] = await prisma.monthlyKpis.findMany({
      where: { clinicId, yearMonth: prevMonth },
    });

    // 前年同月比計算
    const prevYear = getPrevYear(yearMonth);
    const prevYearKpis: { kpiCode: string; kpiValue: number }[] = await prisma.monthlyKpis.findMany({
      where: { clinicId, yearMonth: prevYear },
    });

    // 目標値取得
    const target = await prisma.clinicTarget.findFirst({
      where: { clinicId },
      orderBy: { createdAt: "desc" },
    });

    // KPIを保存
    const savedKpis = await Promise.all(
      kpis.map(async (kpi) => {
        const prevKpi = prevKpis.find((p) => p.kpiCode === kpi.kpiCode);
        const prevYearKpi = prevYearKpis.find((p) => p.kpiCode === kpi.kpiCode);
        const targetValue = getTargetValue(kpi.kpiCode, target);

        return prisma.monthlyKpis.upsert({
          where: {
            clinicId_yearMonth_kpiCode: {
              clinicId,
              yearMonth,
              kpiCode: kpi.kpiCode,
            },
          },
          update: {
            kpiValue: kpi.kpiValue,
            comparisonPrevMonth: prevKpi ? kpi.kpiValue - prevKpi.kpiValue : null,
            comparisonPrevYear: prevYearKpi ? kpi.kpiValue - prevYearKpi.kpiValue : null,
            targetValue,
            achievementRate: targetValue && targetValue > 0
              ? (kpi.kpiValue / targetValue) * 100
              : null,
          },
          create: {
            clinicId,
            yearMonth,
            kpiCode: kpi.kpiCode,
            kpiValue: kpi.kpiValue,
            comparisonPrevMonth: prevKpi ? kpi.kpiValue - prevKpi.kpiValue : null,
            comparisonPrevYear: prevYearKpi ? kpi.kpiValue - prevYearKpi.kpiValue : null,
            targetValue,
            achievementRate: targetValue && targetValue > 0
              ? (kpi.kpiValue / targetValue) * 100
              : null,
          },
        });
      })
    );

    return NextResponse.json(savedKpis);
  } catch (error) {
    console.error("KPI calculation error:", error);
    return NextResponse.json({ error: "KPI計算に失敗しました" }, { status: 500 });
  }
}

// POST /api/kpi - KPI再計算
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const body = await req.json();
    const { clinicId, yearMonth } = body;

    if (!clinicId || !yearMonth) {
      return NextResponse.json({ error: "clinicId, yearMonthが必要です" }, { status: 400 });
    }

    // 既存KPIを削除して再計算
    await prisma.monthlyKpis.deleteMany({
      where: { clinicId, yearMonth },
    });

    // GETと同じロジックでリダイレクト
    const url = new URL(req.url);
    url.searchParams.set("clinicId", clinicId);
    url.searchParams.set("yearMonth", yearMonth);

    return GET(new NextRequest(url));
  } catch (error) {
    console.error("KPI recalculation error:", error);
    return NextResponse.json({ error: "KPI再計算に失敗しました" }, { status: 500 });
  }
}

function getPrevMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const prev = new Date(y, m - 2, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
}

function getPrevYear(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  return `${y - 1}-${String(m).padStart(2, "0")}`;
}

function getTargetValue(kpiCode: string, target: Record<string, unknown> | null): number | null {
  if (!target) return null;
  const map: Record<string, string> = {
    totalRevenue: "monthlyRevenue",
    selfPayRatio: "selfPayRatio",
    newPatientCount: "newPatients",
    returnRate: "returnRate",
    laborCostRatio: "laborCostRatio",
    maintenanceTransitionRate: "maintenanceTransitionRate",
    operatingProfitRate: "operatingProfitRate",
    revenuePerUnit: "revenuePerUnit",
  };
  const field = map[kpiCode];
  if (!field) return null;
  return (target as Record<string, number | null>)[field] || null;
}
