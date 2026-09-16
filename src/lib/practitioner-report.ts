/**
 * 担当者別分析の結果を、データベースから組み立てる（サーバー専用）
 */

import prisma from "./prisma";
import { totalRevenueOf } from "./kpi-calculator";
import {
  analyzePractitioners,
  buildHighlights,
  hourlyLaborCost,
  revenueCoverage,
  summarizeRole,
  type CoverageStatus,
  type PractitionerInput,
  type PractitionerMetrics,
  type PractitionerRole,
  type RoleSummary,
} from "./practitioner-analysis";

/** 基準月を含めて、過去 n か月分の年月を古い順に返す */
export function monthsEndingAt(yearMonth: string, n: number): string[] {
  const [y, m] = yearMonth.split("-").map(Number);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export interface TrendPoint {
  yearMonth: string;
  clinicRevenue: number;
  coverageRatio: number | null;
  /** 職種全体の時間単価 */
  roleHourly: Record<PractitionerRole, number | null>;
  /** 担当者ごとの時間単価（実績がある人だけ） */
  personHourly: Record<string, number | null>;
}

export interface PractitionerReport {
  yearMonth: string;
  practitioners: { id: string; name: string; role: PractitionerRole; employmentType: string; isDirector: boolean; isActive: boolean }[];
  people: PractitionerMetrics[];
  summaries: Record<PractitionerRole, RoleSummary>;
  clinicRevenue: number;
  coverage: { ratio: number | null; status: CoverageStatus };
  highlights: string[];
  trend: TrendPoint[];
  /** 人件費倍率を出せるか（職種別の人件費が登録されているか） */
  hasLaborCost: Record<PractitionerRole, boolean>;
}

const toInput = (
  p: { id: string; name: string; role: string; employmentType: string; isDirector: boolean },
  s?: { insuranceRevenue: number; selfPayRevenue: number; workHours: number; patientCount: number }
): PractitionerInput => ({
  id: p.id,
  name: p.name,
  role: p.role as PractitionerRole,
  employmentType: p.employmentType,
  isDirector: p.isDirector,
  insuranceRevenue: s?.insuranceRevenue ?? 0,
  selfPayRevenue: s?.selfPayRevenue ?? 0,
  workHours: s?.workHours ?? 0,
  patientCount: s?.patientCount ?? 0,
});

export async function buildPractitionerReport(
  clinicId: string,
  yearMonth: string,
  trendMonths = 12
): Promise<PractitionerReport> {
  const months = monthsEndingAt(yearMonth, trendMonths);

  // 医院1つ・最大12か月分に絞って取得する（全件を読まない）
  const [practitioners, stats, revenue, profile, costRates] = await Promise.all([
    prisma.practitioner.findMany({
      where: { clinicId, role: { in: ["DENTIST", "HYGIENIST"] } },
      orderBy: [{ role: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.monthlyPractitionerStats.findMany({ where: { clinicId, yearMonth: { in: months } } }),
    prisma.monthlyRevenue.findMany({
      where: { clinicId, yearMonth: { in: months } },
      select: { yearMonth: true, departmentType: true, amount: true },
    }),
    prisma.clinicProfile.findFirst({ where: { clinicId }, orderBy: { createdAt: "desc" } }),
    prisma.staffCostRate.findMany({ where: { clinicId, role: { in: ["DENTIST", "HYGIENIST"] } } }),
  ]);

  // 人件費の時間単価。KPIの総労働時間と同じく、残業込みの勤務時間で割る
  const standardMonthlyHours = profile
    ? profile.clinicDaysPerMonth * (profile.avgHoursPerDay + profile.avgOvertimeHours)
    : 0;
  const costOf = (role: PractitionerRole) =>
    hourlyLaborCost(costRates.find((r) => r.role === role)?.monthlyCost, standardMonthlyHours);
  const hourlyCostByRole = { DENTIST: costOf("DENTIST"), HYGIENIST: costOf("HYGIENIST") };

  const clinicRevenueOf = (ym: string) => totalRevenueOf(revenue.filter((r) => r.yearMonth === ym));
  const statsOf = (ym: string) => stats.filter((s) => s.yearMonth === ym);

  // --- 対象月 ---
  // 入力対象の人と、対象外でもその月の実績がある人を並べる（過去月を見たとき退職者が消えないように）
  const monthStats = statsOf(yearMonth);
  const shown = practitioners.filter((p) => p.isActive || monthStats.some((s) => s.practitionerId === p.id));
  const { people, summaries } = analyzePractitioners(
    shown.map((p) => toInput(p, monthStats.find((s) => s.practitionerId === p.id))),
    hourlyCostByRole
  );
  const clinicRevenue = clinicRevenueOf(yearMonth);
  const practitionerRevenue = summaries.DENTIST.totalRevenue + summaries.HYGIENIST.totalRevenue;
  const coverage = revenueCoverage(practitionerRevenue, clinicRevenue);

  // --- 推移 ---
  const trend: TrendPoint[] = months.map((ym) => {
    const ms = statsOf(ym);
    const inputs = practitioners
      .filter((p) => ms.some((s) => s.practitionerId === p.id))
      .map((p) => toInput(p, ms.find((s) => s.practitionerId === p.id)));
    const d = summarizeRole("DENTIST", inputs);
    const h = summarizeRole("HYGIENIST", inputs);
    const personHourly: Record<string, number | null> = {};
    for (const i of inputs) {
      personHourly[i.id] = i.workHours > 0 ? (i.insuranceRevenue + i.selfPayRevenue) / i.workHours : null;
    }
    const cr = clinicRevenueOf(ym);
    return {
      yearMonth: ym,
      clinicRevenue: cr,
      coverageRatio: revenueCoverage(d.totalRevenue + h.totalRevenue, cr).ratio,
      roleHourly: { DENTIST: d.hourlyRevenue, HYGIENIST: h.hourlyRevenue },
      personHourly,
    };
  });

  return {
    yearMonth,
    practitioners: practitioners.map((p) => ({
      id: p.id, name: p.name, role: p.role as PractitionerRole,
      employmentType: p.employmentType, isDirector: p.isDirector, isActive: p.isActive,
    })),
    people,
    summaries,
    clinicRevenue,
    coverage,
    highlights: buildHighlights(people, summaries, coverage),
    trend,
    hasLaborCost: { DENTIST: hourlyCostByRole.DENTIST != null, HYGIENIST: hourlyCostByRole.HYGIENIST != null },
  };
}
