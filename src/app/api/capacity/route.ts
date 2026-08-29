import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { analyzeCapacity } from "@/lib/capacity";
import { adviseMaintenance } from "@/lib/maintenance-advisor";
import { simulateExpansion, inferAssumption } from "@/lib/expansion-simulator";

/**
 * GET /api/capacity?clinicId=xxx&yearMonth=2026-07
 *
 * 「増やすなら何を、いつ」の判断材料をまとめて返す。
 *  1. 3資源（ユニット・歯科医師・歯科衛生士）の余力とボトルネック
 *  2. メンテナンス体制を広げる時期かどうか
 *  3. 増設した場合の税引後の見通し
 */

/** 構成比の傾向を見る月数 */
const TREND_MONTHS = 4;

function prevMonth(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 - n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** 直近12ヶ月を年間換算に使う。足りない月は取得できた月数で按分する */
function annualize(sum: number, months: number): number {
  return months > 0 ? (sum / months) * 12 : 0;
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
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
    if (!clinicUser) return NextResponse.json({ error: "アクセス権がありません" }, { status: 403 });

    const trendMonths = Array.from({ length: TREND_MONTHS }, (_, i) => prevMonth(yearMonth, i));
    const yearMonths = Array.from({ length: 12 }, (_, i) => prevMonth(yearMonth, i));

    const [profile, patients, revenue, trendRevenue, trendPatients, yearRevenue, yearCosts,
           recall, kpis, staffRates, expansionSetting] = await Promise.all([
      prisma.clinicProfile.findFirst({ where: { clinicId }, orderBy: { createdAt: "desc" } }),
      prisma.monthlyPatients.findMany({ where: { clinicId, yearMonth, departmentType: "TOTAL" } }),
      prisma.monthlyRevenue.findMany({ where: { clinicId, yearMonth } }),
      prisma.monthlyRevenue.findMany({
        where: { clinicId, yearMonth: { in: trendMonths }, departmentType: "MAINTENANCE" },
        select: { yearMonth: true, patientCount: true },
      }),
      prisma.monthlyPatients.findMany({
        where: { clinicId, yearMonth: { in: trendMonths }, departmentType: "TOTAL" },
        select: { yearMonth: true, totalPatientCount: true },
      }),
      prisma.monthlyRevenue.findMany({ where: { clinicId, yearMonth: { in: yearMonths } } }),
      prisma.monthlyCosts.findMany({ where: { clinicId, yearMonth: { in: yearMonths } } }),
      prisma.monthlyRecall.findUnique({ where: { clinicId_yearMonth: { clinicId, yearMonth } } }),
      prisma.monthlyKpis.findMany({ where: { clinicId, yearMonth } }),
      prisma.staffCostRate.findMany({ where: { clinicId } }),
      prisma.expansionSetting.findUnique({ where: { clinicId } }),
    ]);

    if (!profile || patients.length === 0) {
      return NextResponse.json({ hasData: false, reason: "医院設定または月次の患者数が未登録です" });
    }

    const totalPatientCount = patients.reduce((s, p) => s + p.totalPatientCount, 0);
    const maintRow = revenue.filter((r) => r.departmentType === "MAINTENANCE");
    const maintenancePatientCount = maintRow.reduce((s, r) => s + (r.patientCount || 0), 0);
    const maintenanceRevenue = maintRow.reduce((s, r) => s + r.amount, 0);

    // --- 1. 余力の判定 ---
    const capacity = analyzeCapacity({
      totalPatientCount, maintenancePatientCount,
      profile: {
        unitCount: profile.unitCount, activeUnitCount: profile.activeUnitCount,
        fulltimeDentistCount: profile.fulltimeDentistCount, parttimeDentistCount: profile.parttimeDentistCount,
        fulltimeHygienistCount: profile.fulltimeHygienistCount, parttimeHygienistCount: profile.parttimeHygienistCount,
        clinicDaysPerMonth: profile.clinicDaysPerMonth, avgHoursPerDay: profile.avgHoursPerDay,
        avgTreatmentMinutes: profile.avgTreatmentMinutes, avgMaintenanceMinutes: profile.avgMaintenanceMinutes,
      },
    });
    const dh = capacity.resources.find((r) => r.key === "hygienist")!;

    // --- 2. メンテナンス体制 ---
    // 構成比の推移（新しい順）
    const ratioTrend = trendMonths.map((m) => {
      const t = trendPatients.find((p) => p.yearMonth === m)?.totalPatientCount ?? 0;
      const mp = trendRevenue.filter((r) => r.yearMonth === m).reduce((s, r) => s + (r.patientCount || 0), 0);
      return t > 0 ? (mp / t) * 100 : NaN;
    });
    const kpi = (code: string) => kpis.find((k) => k.kpiCode === code)?.kpiValue;
    const rateOf = (role: "HYGIENIST" | "ASSISTANT" | "DENTIST") =>
      staffRates.find((s) => s.role === role)?.monthlyCost ?? null;

    const maintenance = adviseMaintenance({
      maintenancePatientCount, totalPatientCount, maintenanceRevenue,
      hygienistUtilization: dh.utilization,
      hygienistFte: dh.current,
      hygienistUsedMinutes: dh.usedMinutes,
      hygienistAvailableMinutes: dh.availableMinutes,
      ratioTrend,
      recall,
      maintenanceTransitionRate: kpi("maintenanceTransitionRate"),
      hygienistMonthlyCost: rateOf("HYGIENIST"),
      clinicDaysPerMonth: profile.clinicDaysPerMonth,
      avgHoursPerDay: profile.avgHoursPerDay ?? 8,
      avgMaintenanceMinutes: profile.avgMaintenanceMinutes ?? 45,
    });

    // --- 3. 増設シミュレーション ---
    // 年間の実績。取得できた月数で按分して年換算する
    const monthsWithRevenue = new Set(yearRevenue.map((r) => r.yearMonth)).size;
    const insuranceSum = yearRevenue
      .filter((r) => ["INSURANCE", "MAINTENANCE", "HOME_VISIT"].includes(r.departmentType))
      .reduce((s, r) => s + r.amount, 0);
    const privateSum = yearRevenue
      .filter((r) => r.departmentType === "SELF_PAY")
      .reduce((s, r) => s + r.amount, 0);
    const monthsWithCost = new Set(yearCosts.map((c) => c.yearMonth)).size;
    const expenseSum = yearCosts.reduce((s, c) => s + c.amount, 0);
    const laborSum = yearCosts
      .filter((c) => ["LABOR", "RECEPTION_LABOR", "COMMON_STAFF_LABOR"].includes(c.costItemCode))
      .reduce((s, c) => s + c.amount, 0);

    let expansion = null;
    let expansionNote: string | undefined;
    const annualRevenue = annualize(insuranceSum + privateSum, monthsWithRevenue);
    const annualExpense = annualize(expenseSum, monthsWithCost);

    if (annualRevenue <= 0) {
      expansionNote = "売上の実績が無いため、増設の試算ができません。";
    } else if (annualExpense <= 0) {
      expansionNote = "コストが未登録のため、税引後の試算ができません。コスト登録から入力してください。";
    } else {
      const base = {
        unitCount: profile.activeUnitCount || profile.unitCount,
        insuranceRevenue: annualize(insuranceSum, monthsWithRevenue),
        privateRevenue: annualize(privateSum, monthsWithRevenue),
        totalExpense: annualExpense,
        laborCost: annualize(laborSum, monthsWithCost),
      };
      const assumption = inferAssumption(
        base,
        {
          baseUnitCount: expansionSetting?.baseUnitCount,
          revenuePerUnitBase: expansionSetting?.revenuePerUnitBase ?? undefined,
          revenuePerUnitMarginal: expansionSetting?.revenuePerUnitMarginal ?? undefined,
          useSpecialExpense: expansionSetting?.useSpecialExpense,
          insuranceRevenueCap: expansionSetting?.insuranceRevenueCap,
          totalRevenueCap: expansionSetting?.totalRevenueCap,
          unitInvestmentCost: expansionSetting?.unitInvestmentCost,
        },
        { hygienist: rateOf("HYGIENIST"), assistant: rateOf("ASSISTANT"), dentist: rateOf("DENTIST") }
      );
      expansion = simulateExpansion(base, assumption);
      if (monthsWithRevenue < 12) {
        expansionNote = `直近${monthsWithRevenue}ヶ月の実績から年換算しています。`;
      }
    }

    return NextResponse.json({
      hasData: true,
      capacity,
      maintenance,
      expansion,
      expansionNote,
      /** 人件費単価が未設定なら、画面で登録を促すために返す */
      staffRatesConfigured: staffRates.length > 0,
    });
  } catch (error) {
    console.error("capacity error:", error);
    return NextResponse.json({ error: "余力の判定に失敗しました" }, { status: 500 });
  }
}
