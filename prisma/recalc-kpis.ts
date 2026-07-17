/**
 * KPI再計算スクリプト
 *
 * 月次の生データはそのままに、KPIだけを削除して計算し直す。
 * kpi-calculator.ts を変更したあとに実行する。
 * 実行: npx tsx prisma/recalc-kpis.ts
 */
import { PrismaClient } from "@prisma/client";
import { calculateKpis } from "../src/lib/kpi-calculator";

const prisma = new PrismaClient();

const prevMonthOf = (yearMonth: string) => {
  const [y, m] = yearMonth.split("-").map(Number);
  const prev = new Date(y, m - 2, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
};

/** 目標値 → KPIコードの対応（src/app/api/kpi/route.ts と同じ） */
function getTargetValue(kpiCode: string, target: Record<string, number | null> | null): number | null {
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
  return target[field] || null;
}

async function main() {
  const clinics = await prisma.clinic.findMany({ select: { id: true, clinicName: true } });

  for (const clinic of clinics) {
    const clinicId = clinic.id;
    const months = (await prisma.monthlyRevenue.findMany({
      where: { clinicId }, select: { yearMonth: true }, distinct: ["yearMonth"], orderBy: { yearMonth: "asc" },
    })).map((m) => m.yearMonth);
    if (months.length === 0) continue;

    const deleted = await prisma.monthlyKpis.deleteMany({ where: { clinicId } });
    console.log(`${clinic.clinicName}: 既存KPI ${deleted.count}件を削除 → ${months.length}ヶ月分を再計算`);

    const profile = await prisma.clinicProfile.findFirst({ where: { clinicId } });
    const target = await prisma.clinicTarget.findFirst({ where: { clinicId }, orderBy: { createdAt: "desc" } });

    let created = 0;
    // 前月比を埋めるため古い月から順に処理する
    for (const yearMonth of months) {
      const [revenue, patients, appointments, costs] = await Promise.all([
        prisma.monthlyRevenue.findMany({ where: { clinicId, yearMonth } }),
        prisma.monthlyPatients.findMany({ where: { clinicId, yearMonth } }),
        prisma.monthlyAppointments.findMany({ where: { clinicId, yearMonth } }),
        prisma.monthlyCosts.findMany({ where: { clinicId, yearMonth } }),
      ]);
      const kpis = calculateKpis({ revenue, patients, appointments, costs } as never, profile as never);
      const prevKpis = await prisma.monthlyKpis.findMany({ where: { clinicId, yearMonth: prevMonthOf(yearMonth) } });

      for (const kpi of kpis) {
        const prev = prevKpis.find((p) => p.kpiCode === kpi.kpiCode);
        const targetValue = getTargetValue(kpi.kpiCode, target as never);
        // 実行中にユーザーが画面を開くと /api/kpi が同じ行を作るため、create ではなく upsert する
        const data = {
          kpiValue: kpi.kpiValue,
          comparisonPrevMonth: prev ? kpi.kpiValue - prev.kpiValue : null,
          comparisonPrevYear: null,
          targetValue,
          achievementRate: targetValue && targetValue > 0 ? (kpi.kpiValue / targetValue) * 100 : null,
          benchmarkValue: kpi.benchmarkValue ?? null,
        };
        await prisma.monthlyKpis.upsert({
          where: { clinicId_yearMonth_kpiCode: { clinicId, yearMonth, kpiCode: kpi.kpiCode } },
          update: data,
          create: { clinicId, yearMonth, kpiCode: kpi.kpiCode, ...data },
        });
        created++;
      }
    }
    console.log(`  → ${created}件を保存（1ヶ月あたり ${created / months.length}件）`);
  }
  console.log("\nKPI再計算が完了しました。");
}

main().catch((e) => { console.error("ERROR:", e); process.exit(1); }).finally(() => prisma.$disconnect());
