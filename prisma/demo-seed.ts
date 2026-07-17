/**
 * デモデータ生成スクリプト
 *
 * 対象医院の月次データを全て削除し、過去1年分（12ヶ月）のデモデータを投入する。
 * 金額は全て「円」単位。KPI・配賦結果もアプリ本体と同じロジックで事前計算して保存する。
 *
 * 実行: npx tsx prisma/demo-seed.ts
 */
import { PrismaClient } from "@prisma/client";
import { calculateKpis } from "../src/lib/kpi-calculator";

const prisma = new PrismaClient();

const CLINIC_NAME = "ファイブ歯科";

/** 2025-08 〜 2026-07 の12ヶ月 */
const MONTHS = [
  "2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01",
  "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07",
];

/** 季節変動係数（お盆・年末年始・GWは落ち、年度末は伸びる） */
const SEASON = [0.92, 0.99, 1.03, 1.02, 1.09, 0.94, 0.92, 1.06, 1.00, 0.97, 1.03, 1.01];
/** 水道光熱費の季節係数（夏冬に上がる） */
const UTIL_SEASON = [1.25, 1.05, 0.9, 0.9, 1.1, 1.3, 1.3, 1.05, 0.9, 0.9, 1.0, 1.2];
/** 広告費（自費強化のため後半に増額） */
const AD_COST = [150000, 150000, 180000, 180000, 200000, 160000, 160000, 220000, 240000, 240000, 260000, 260000];

const BASE_REVENUE = 11_200_000;
const GROWTH_PER_MONTH = 0.011;

const round = (v: number, unit = 1000) => Math.round(v / unit) * unit;

const DEPTS = ["INSURANCE", "SELF_PAY", "MAINTENANCE", "HOME_VISIT"] as const;
type Dept = (typeof DEPTS)[number];

/** 部門別の按分比率（ドライバー量の元になる） */
const PATIENT_SHARE: Record<Dept, number> = { INSURANCE: 0.54, SELF_PAY: 0.11, MAINTENANCE: 0.30, HOME_VISIT: 0.05 };
const NEW_PATIENT_SHARE: Record<Dept, number> = { INSURANCE: 0.62, SELF_PAY: 0.16, MAINTENANCE: 0.17, HOME_VISIT: 0.05 };
const UNIT_USAGE_SHARE: Record<Dept, number> = { INSURANCE: 0.55, SELF_PAY: 0.15, MAINTENANCE: 0.30, HOME_VISIT: 0 };
/** 面積(㎡)・勤務時間(h)・FTEは月によらず固定 */
const AREA: Record<Dept, number> = { INSURANCE: 62, SELF_PAY: 28, MAINTENANCE: 38, HOME_VISIT: 6 };
const WORK_HOURS: Record<Dept, number> = { INSURANCE: 640, SELF_PAY: 210, MAINTENANCE: 400, HOME_VISIT: 95 };
const FTE: Record<Dept, number> = { INSURANCE: 4.2, SELF_PAY: 1.6, MAINTENANCE: 3.6, HOME_VISIT: 0.6 };

/** 間接費の配賦ルール（費目 → ドライバー） */
const ALLOCATION_RULES: { costItemCode: string; driverType: string }[] = [
  { costItemCode: "DIRECTOR_COMPENSATION", driverType: "WORK_HOURS" },
  { costItemCode: "LABOR", driverType: "WORK_HOURS" },
  { costItemCode: "RECEPTION_LABOR", driverType: "PATIENT_COUNT" },
  { costItemCode: "COMMON_STAFF_LABOR", driverType: "PATIENT_COUNT" },
  { costItemCode: "RENT", driverType: "AREA" },
  { costItemCode: "UTILITIES", driverType: "UNIT_USAGE" },
  { costItemCode: "LEASE", driverType: "UNIT_USAGE" },
  { costItemCode: "SYSTEM_FEE", driverType: "PATIENT_COUNT" },
  { costItemCode: "DEPRECIATION", driverType: "UNIT_USAGE" },
  { costItemCode: "ADVERTISING", driverType: "NEW_PATIENT" },
  { costItemCode: "COMMUNICATION", driverType: "PATIENT_COUNT" },
  { costItemCode: "CONSUMABLES", driverType: "PATIENT_COUNT" },
  { costItemCode: "TRAINING", driverType: "FTE" },
  { costItemCode: "INSURANCE_PREMIUM", driverType: "AREA" },
  { costItemCode: "REPAIR", driverType: "UNIT_USAGE" },
  { costItemCode: "MISCELLANEOUS", driverType: "REVENUE_RATIO" },
];

interface MonthFigures {
  yearMonth: string;
  revenue: Record<Dept, number>;
  totalRevenue: number;
  totalPatientCount: number;
  uniquePatientCount: number;
  newPatientCount: number;
  returnPatientCount: number;
  dropoutCount: number;
  maintenanceTransitionCount: number;
  appointmentCount: number;
  cancelCount: number;
  noShowCount: number;
  directCosts: { costItemCode: string; departmentType: Dept; amount: number }[];
  directAssignedCosts: { costItemCode: string; departmentType: Dept; amount: number }[];
  indirectCosts: { costItemCode: string; amount: number }[];
}

/** i ヶ月目（0=2025-08）の数値を組み立てる */
function buildMonth(i: number): MonthFigures {
  const yearMonth = MONTHS[i];
  const total = round(BASE_REVENUE * SEASON[i] * (1 + i * GROWTH_PER_MONTH), 10000);

  // 自費・メンテの構成比を少しずつ引き上げる（自費強化の成果を表現）
  const selfPayShare = 0.19 + i * 0.005;
  const maintShare = 0.145 + i * 0.0018;
  const homeShare = 0.06;
  const insShare = 1 - selfPayShare - maintShare - homeShare;

  const revenue: Record<Dept, number> = {
    INSURANCE: round(total * insShare),
    SELF_PAY: round(total * selfPayShare),
    MAINTENANCE: round(total * maintShare),
    HOME_VISIT: round(total * homeShare),
  };
  // TOTAL は各部門の合計と必ず一致させる
  const totalRevenue = DEPTS.reduce((s, d) => s + revenue[d], 0);

  const totalPatientCount = Math.round(totalRevenue / 14200);
  const uniquePatientCount = Math.round(totalPatientCount * 0.58);
  const newPatientCount = Math.round(uniquePatientCount * (0.105 - i * 0.0009));
  const returnPatientCount = uniquePatientCount - newPatientCount;
  const dropoutCount = Math.round(uniquePatientCount * 0.032);
  const maintenanceTransitionCount = Math.round(uniquePatientCount * (0.28 + i * 0.004));

  const appointmentCount = Math.round(totalPatientCount * 1.09);
  const cancelCount = Math.round(appointmentCount * (0.078 - i * 0.0009));
  const noShowCount = Math.round(appointmentCount * 0.014);

  // --- 直接原価（部門別に計上）---
  const materialTotal = round(totalRevenue * 0.036);
  const labTotal = round(totalRevenue * 0.044);
  const directCosts: MonthFigures["directCosts"] = [
    { costItemCode: "DIRECT_MATERIAL", departmentType: "INSURANCE", amount: round(materialTotal * 0.45) },
    { costItemCode: "DIRECT_MATERIAL", departmentType: "SELF_PAY", amount: round(materialTotal * 0.33) },
    { costItemCode: "DIRECT_MATERIAL", departmentType: "MAINTENANCE", amount: round(materialTotal * 0.16) },
    { costItemCode: "DIRECT_MATERIAL", departmentType: "HOME_VISIT", amount: round(materialTotal * 0.06) },
    { costItemCode: "LAB_FEE", departmentType: "INSURANCE", amount: round(labTotal * 0.42) },
    { costItemCode: "LAB_FEE", departmentType: "SELF_PAY", amount: round(labTotal * 0.58) },
    { costItemCode: "OUTSOURCING", departmentType: "SELF_PAY", amount: round(totalRevenue * 0.007) },
  ];

  // --- 直接計上費（特定部門に直課される費用）---
  const directAssignedCosts: MonthFigures["directAssignedCosts"] = [
    { costItemCode: "LEASE", departmentType: "SELF_PAY", amount: 90000 },
    { costItemCode: "OTHER_DIRECT", departmentType: "HOME_VISIT", amount: 130000 },
  ];

  // --- 間接費（TOTAL計上・配賦対象）---
  const indirectCosts: MonthFigures["indirectCosts"] = [
    // 役員報酬は定期同額給与のため毎月固定
    { costItemCode: "DIRECTOR_COMPENSATION", amount: 3_200_000 },
    { costItemCode: "LABOR", amount: round(totalRevenue * 0.195) },
    { costItemCode: "RECEPTION_LABOR", amount: round(totalRevenue * 0.033) },
    { costItemCode: "COMMON_STAFF_LABOR", amount: round(totalRevenue * 0.022) },
    { costItemCode: "RENT", amount: 620000 },
    { costItemCode: "UTILITIES", amount: round(145000 * UTIL_SEASON[i]) },
    { costItemCode: "LEASE", amount: 235000 },
    { costItemCode: "SYSTEM_FEE", amount: 66000 },
    { costItemCode: "DEPRECIATION", amount: 310000 },
    { costItemCode: "ADVERTISING", amount: AD_COST[i] },
    { costItemCode: "COMMUNICATION", amount: 42000 },
    { costItemCode: "CONSUMABLES", amount: round(totalRevenue * 0.011) },
    { costItemCode: "TRAINING", amount: 60000 },
    { costItemCode: "INSURANCE_PREMIUM", amount: 75000 },
    { costItemCode: "REPAIR", amount: 85000 },
    { costItemCode: "MISCELLANEOUS", amount: 78000 },
  ];

  return {
    yearMonth, revenue, totalRevenue, totalPatientCount, uniquePatientCount,
    newPatientCount, returnPatientCount, dropoutCount, maintenanceTransitionCount,
    appointmentCount, cancelCount, noShowCount, directCosts, directAssignedCosts, indirectCosts,
  };
}

/** ドライバー量を組み立てる */
function buildDriverValues(m: MonthFigures) {
  const values: { driverType: string; departmentType: Dept; driverValue: number }[] = [];
  for (const d of DEPTS) {
    values.push({ driverType: "REVENUE_RATIO", departmentType: d, driverValue: m.revenue[d] });
    values.push({ driverType: "PATIENT_COUNT", departmentType: d, driverValue: Math.round(m.totalPatientCount * PATIENT_SHARE[d]) });
    values.push({ driverType: "NEW_PATIENT", departmentType: d, driverValue: Math.round(m.newPatientCount * NEW_PATIENT_SHARE[d]) });
    values.push({ driverType: "UNIT_USAGE", departmentType: d, driverValue: Math.round(m.totalPatientCount * UNIT_USAGE_SHARE[d]) });
    values.push({ driverType: "AREA", departmentType: d, driverValue: AREA[d] });
    values.push({ driverType: "WORK_HOURS", departmentType: d, driverValue: WORK_HOURS[d] });
    values.push({ driverType: "FTE", departmentType: d, driverValue: FTE[d] });
    values.push({ driverType: "APPOINTMENT", departmentType: d, driverValue: Math.round(m.appointmentCount * PATIENT_SHARE[d]) });
  }
  return values;
}

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

const prevMonthOf = (yearMonth: string) => {
  const [y, m] = yearMonth.split("-").map(Number);
  const prev = new Date(y, m - 2, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
};

async function main() {
  const clinic = await prisma.clinic.findFirst({ where: { clinicName: CLINIC_NAME } });
  if (!clinic) throw new Error(`医院「${CLINIC_NAME}」が見つかりません`);
  const clinicId = clinic.id;
  console.log(`対象医院: ${clinic.clinicName} (${clinicId})\n`);

  // ---------- 1. 既存の月次データを削除 ----------
  console.log("既存データを削除中...");
  const deleted = {
    kpis: (await prisma.monthlyKpis.deleteMany({ where: { clinicId } })).count,
    revenue: (await prisma.monthlyRevenue.deleteMany({ where: { clinicId } })).count,
    patients: (await prisma.monthlyPatients.deleteMany({ where: { clinicId } })).count,
    appointments: (await prisma.monthlyAppointments.deleteMany({ where: { clinicId } })).count,
    costs: (await prisma.monthlyCosts.deleteMany({ where: { clinicId } })).count,
    allocResults: (await prisma.allocationResult.deleteMany({ where: { clinicId } })).count,
    driverValues: (await prisma.allocationDriverValue.deleteMany({ where: { clinicId } })).count,
    allocRules: (await prisma.allocationRule.deleteMany({ where: { clinicId } })).count,
    deptProfit: (await prisma.departmentProfitability.deleteMany({ where: { clinicId } })).count,
    actions: (await prisma.actionPlan.deleteMany({ where: { clinicId } })).count,
    insights: (await prisma.aiInsight.deleteMany({ where: { clinicId } })).count,
    targets: (await prisma.clinicTarget.deleteMany({ where: { clinicId } })).count,
  };
  console.log(`  削除: ${Object.entries(deleted).map(([k, v]) => `${k}=${v}`).join(", ")}\n`);

  // ---------- 2. 医院基本情報（未入力の項目のみ補完）----------
  await prisma.clinic.update({
    where: { id: clinicId },
    data: {
      corporateName: clinic.corporateName || "医療法人社団ファイブ会",
      prefecture: clinic.prefecture || "東京都",
      city: clinic.city || "世田谷区",
      openingYear: clinic.openingYear || 2016,
      corporateType: "CORPORATION",
      clinicType: JSON.stringify(["insurance", "self-pay", "maintenance", "home-visit"]),
      isHomeVisit: true,
      isSetupComplete: true,
    },
  });

  // ---------- 3. 医院プロファイル（人員・設備）----------
  const profileData = {
    unitCount: 5,
    activeUnitCount: 5,
    hasCt: true,
    hasMicroscope: true,
    hasCadcam: true,
    hasOperationRoom: false,
    fulltimeDentistCount: 2,
    parttimeDentistCount: 1,
    fulltimeHygienistCount: 3,
    parttimeHygienistCount: 2,
    fulltimeAssistantCount: 2,
    parttimeAssistantCount: 1,
    fulltimeReceptionCount: 1,
    parttimeReceptionCount: 1,
    fulltimeTechnicianCount: 0,
    parttimeTechnicianCount: 0,
    hasOfficeManager: true,
    clinicDaysPerMonth: 22,
    avgHoursPerDay: 8.5,
    avgOvertimeHours: 1.2,
    workHours: "9:00-18:30",
  };
  const existingProfile = await prisma.clinicProfile.findFirst({ where: { clinicId } });
  if (existingProfile) {
    await prisma.clinicProfile.update({ where: { id: existingProfile.id }, data: profileData });
  } else {
    await prisma.clinicProfile.create({ data: { clinicId, ...profileData } });
  }
  console.log("医院プロファイルを更新（Dr FTE=2.5 / DH FTE=4.0）");

  // ---------- 4. 目標値 ----------
  const target = await prisma.clinicTarget.create({
    data: {
      clinicId,
      monthlyRevenue: 13_000_000,
      selfPayRatio: 25,
      newPatients: 55,
      returnRate: 90,
      cancelRate: 6,
      laborCostRatio: 25,
      materialCostRatio: 8,
      maintenanceTransitionRate: 35,
      grossProfitRate: 90,
      operatingProfitRate: 42,
      revenuePerUnit: 2_600_000,
      revenuePerActiveUnit: 2_600_000,
      revenuePerDentist: 5_200_000,
      revenuePerHygienist: 520_000,
      discontinuedRate: 3,
    },
  });
  console.log("目標値を登録");

  // ---------- 5. 配賦ルール ----------
  for (const rule of ALLOCATION_RULES) {
    for (const dept of DEPTS) {
      await prisma.allocationRule.create({
        data: {
          clinicId,
          costItemCode: rule.costItemCode,
          allocationTargetType: dept,
          driverType: rule.driverType,
          driverRatio: 25,
          manualOverride: false,
        },
      });
    }
  }
  console.log(`配賦ルールを登録（${ALLOCATION_RULES.length}費目 × ${DEPTS.length}部門）\n`);

  // ---------- 6. 月次データ ----------
  for (let i = 0; i < MONTHS.length; i++) {
    const m = buildMonth(i);

    // 売上（部門別 + TOTAL）
    for (const dept of DEPTS) {
      await prisma.monthlyRevenue.create({
        data: {
          clinicId,
          yearMonth: m.yearMonth,
          departmentType: dept,
          revenueType: dept === "MAINTENANCE" ? "PREVENTION" : "TREATMENT",
          insuranceOrPrivate: dept === "SELF_PAY" ? "PRIVATE" : dept === "MAINTENANCE" ? "MIXED" : "INSURANCE",
          amount: m.revenue[dept],
          points: dept === "INSURANCE" || dept === "HOME_VISIT" ? Math.round(m.revenue[dept] / 10) : 0,
          patientCount: Math.round(m.totalPatientCount * PATIENT_SHARE[dept]),
        },
      });
    }
    await prisma.monthlyRevenue.create({
      data: {
        clinicId,
        yearMonth: m.yearMonth,
        departmentType: "TOTAL",
        revenueType: "TREATMENT",
        insuranceOrPrivate: "MIXED",
        amount: m.totalRevenue,
        points: 0,
        patientCount: m.totalPatientCount,
      },
    });

    // 患者・予約
    await prisma.monthlyPatients.create({
      data: {
        clinicId,
        yearMonth: m.yearMonth,
        departmentType: "TOTAL",
        totalPatientCount: m.totalPatientCount,
        uniquePatientCount: m.uniquePatientCount,
        newPatientCount: m.newPatientCount,
        returnPatientCount: m.returnPatientCount,
        dropoutCount: m.dropoutCount,
        maintenanceTransitionCount: m.maintenanceTransitionCount,
      },
    });
    await prisma.monthlyAppointments.create({
      data: {
        clinicId,
        yearMonth: m.yearMonth,
        departmentType: "TOTAL",
        appointmentCount: m.appointmentCount,
        cancelCount: m.cancelCount,
        noShowCount: m.noShowCount,
        completedCount: m.appointmentCount - m.cancelCount,
      },
    });

    // コスト（直接原価 / 直接計上費 / 間接費）
    for (const c of m.directCosts) {
      await prisma.monthlyCosts.create({
        data: { clinicId, yearMonth: m.yearMonth, costItemCode: c.costItemCode, departmentType: c.departmentType, costLayer: "DIRECT", amount: c.amount },
      });
    }
    for (const c of m.directAssignedCosts) {
      await prisma.monthlyCosts.create({
        data: { clinicId, yearMonth: m.yearMonth, costItemCode: c.costItemCode, departmentType: c.departmentType, costLayer: "DIRECT_ASSIGNED", amount: c.amount },
      });
    }
    for (const c of m.indirectCosts) {
      await prisma.monthlyCosts.create({
        data: { clinicId, yearMonth: m.yearMonth, costItemCode: c.costItemCode, departmentType: "TOTAL", costLayer: "INDIRECT", amount: c.amount },
      });
    }

    // ドライバー量
    for (const dv of buildDriverValues(m)) {
      await prisma.allocationDriverValue.create({
        data: { clinicId, yearMonth: m.yearMonth, driverType: dv.driverType, departmentType: dv.departmentType, driverValue: dv.driverValue },
      });
    }

    console.log(`  ${m.yearMonth}: 売上 ${m.totalRevenue.toLocaleString()}円 / 延患者 ${m.totalPatientCount}人 / 新患 ${m.newPatientCount}人`);
  }
  console.log("");

  // ---------- 7. 配賦計算（api/allocation/calculate と同じロジック）----------
  for (const yearMonth of MONTHS) {
    const indirectCosts = await prisma.monthlyCosts.findMany({
      where: { clinicId, yearMonth, departmentType: "TOTAL", costLayer: "INDIRECT" },
    });
    const driverValues = await prisma.allocationDriverValue.findMany({ where: { clinicId, yearMonth } });

    for (const cost of indirectCosts) {
      const rule = ALLOCATION_RULES.find((r) => r.costItemCode === cost.costItemCode);
      if (!rule) {
        console.warn(`  [警告] ${yearMonth} ${cost.costItemCode}: 配賦ルールが無いため未配賦`);
        continue;
      }
      const relevant = driverValues.filter((d) => d.driverType === rule.driverType && d.departmentType !== "TOTAL");
      const totalDriverValue = relevant.reduce((s, d) => s + d.driverValue, 0);
      if (totalDriverValue === 0) {
        console.warn(`  [警告] ${yearMonth} ${cost.costItemCode}: ドライバー(${rule.driverType})の量が0のため未配賦`);
        continue;
      }
      const driverRate = cost.amount / totalDriverValue;

      for (const d of relevant) {
        const data = { driverType: rule.driverType, driverRate, allocatedAmount: d.driverValue * driverRate };
        await prisma.allocationResult.upsert({
          where: {
            clinicId_yearMonth_costItemCode_departmentType: {
              clinicId, yearMonth, costItemCode: cost.costItemCode, departmentType: d.departmentType,
            },
          },
          update: data,
          create: { clinicId, yearMonth, costItemCode: cost.costItemCode, departmentType: d.departmentType, ...data },
        });
      }
    }
  }
  console.log("配賦結果を計算");

  // ---------- 8. KPI計算（古い月から順に計算して前月比も埋める）----------
  const profile = await prisma.clinicProfile.findFirst({ where: { clinicId } });
  for (const yearMonth of MONTHS) {
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
    }
  }
  console.log("KPIを計算");

  // ---------- 9. 部門別採算（api/department と同じロジック）----------
  for (const yearMonth of MONTHS) {
    const [revenue, costs, allocations] = await Promise.all([
      prisma.monthlyRevenue.findMany({ where: { clinicId, yearMonth } }),
      prisma.monthlyCosts.findMany({ where: { clinicId, yearMonth } }),
      prisma.allocationResult.findMany({ where: { clinicId, yearMonth } }),
    ]);

    for (const dept of DEPTS) {
      const deptRevenue = revenue.filter((r) => r.departmentType === dept).reduce((s, r) => s + r.amount, 0);
      const directCost = costs.filter((c) => c.departmentType === dept && c.costLayer === "DIRECT").reduce((s, c) => s + c.amount, 0);
      const directAssignedCost = costs.filter((c) => c.departmentType === dept && c.costLayer === "DIRECT_ASSIGNED").reduce((s, c) => s + c.amount, 0);
      const allocatedIndirectCost = allocations.filter((a) => a.departmentType === dept).reduce((s, a) => s + a.allocatedAmount, 0);
      const grossProfit = deptRevenue - directCost;
      const preAllocationProfit = grossProfit - directAssignedCost;
      const postAllocationOperatingProfit = preAllocationProfit - allocatedIndirectCost;

      // 実行中にユーザーが画面を開くと /api/department が同じ行を作るため、create ではなく upsert する
      const data = {
        revenue: deptRevenue,
        directCost,
        grossProfit,
        grossMargin: deptRevenue > 0 ? (grossProfit / deptRevenue) * 100 : 0,
        directAssignedCost,
        preAllocationProfit,
        preAllocationMargin: deptRevenue > 0 ? (preAllocationProfit / deptRevenue) * 100 : 0,
        allocatedIndirectCost,
        postAllocationOperatingProfit,
        operatingMargin: deptRevenue > 0 ? (postAllocationOperatingProfit / deptRevenue) * 100 : 0,
      };
      await prisma.departmentProfitability.upsert({
        where: { clinicId_yearMonth_departmentType: { clinicId, yearMonth, departmentType: dept } },
        update: data,
        create: { clinicId, yearMonth, departmentType: dept, ...data },
      });
    }
  }
  console.log("部門別採算を計算");

  // ---------- 10. AI課題・改善提案 ----------
  const latest = MONTHS[MONTHS.length - 1];
  const insights = [
    {
      category: "patient", area: "新患",
      title: "新患数が12ヶ月で減少傾向",
      description: "新患数は2025年8月の44人から直近49人と横ばいで、実患者数の伸びに対して新患比率が10.5%→9.5%に低下しています。",
      cause: "広告費は増額しているものの、Web経由の問い合わせから初診予約への転換率が低下している可能性があります。",
      suggestion: "初診枠を平日夜間に週2コマ増設し、Web予約の導線を「電話のみ」から24時間オンライン予約に切り替えてください。",
      expectedImpact: "新患 月+8〜12人（売上換算 月+90万円）",
      impact: "HIGH", difficulty: "MEDIUM", priority: 1,
    },
    {
      category: "revenue", area: "自費",
      title: "自費率は改善したが目標25%には未達",
      description: "自費率は19.0%から24.5%へ改善しました。目標の25%まであと0.5ポイントです。",
      cause: "補綴カウンセリングの実施率が症例の6割程度に留まっています。",
      suggestion: "TC（トリートメントコーディネーター）の配置を週3日に増やし、補綴提案時のカウンセリング実施率を100%にしてください。",
      expectedImpact: "自費売上 月+40〜60万円",
      impact: "MEDIUM", difficulty: "LOW", priority: 2,
    },
    {
      category: "productivity", area: "生産性",
      title: "DH1人あたりメンテ売上が目標未達",
      description: "DH1人あたりのメンテナンス売上は約52万円で、目標の52万円をほぼ達成していますが、非常勤DHの稼働にばらつきがあります。",
      cause: "非常勤DHの担当患者数が常勤の6割程度に留まっています。",
      suggestion: "リコールの自動通知を導入し、非常勤DHのアポイント充填率を引き上げてください。",
      expectedImpact: "メンテ売上 月+20万円",
      impact: "MEDIUM", difficulty: "LOW", priority: 3,
    },
    {
      category: "profit", area: "訪問",
      title: "訪問診療部門の配賦後利益率が最も低い",
      description: "訪問診療は売上構成比6%に対し、配賦後営業利益率が他部門より低くなっています。車両費・移動時間が直課されているためです。",
      cause: "1日あたりの訪問件数が少なく、移動コストが売上に対して割高になっています。",
      suggestion: "訪問先を地域ごとにルート化し、1日あたりの訪問件数を3件から5件に増やしてください。",
      expectedImpact: "訪問部門の利益率 +8ポイント",
      impact: "MEDIUM", difficulty: "HIGH", priority: 4,
    },
    {
      category: "patient", area: "キャンセル",
      title: "キャンセル率は改善傾向、目標6%まであと一歩",
      description: "キャンセル率は7.8%から6.8%へ改善しました。目標6%まであと0.8ポイントです。",
      cause: "前日リマインドがSMS未登録患者に届いていません。",
      suggestion: "初診時のSMS登録を必須化し、前日リマインドの到達率を高めてください。",
      expectedImpact: "キャンセル 月-10件（売上換算 月+14万円）",
      impact: "LOW", difficulty: "LOW", priority: 5,
    },
  ];

  const createdInsights = [];
  for (const ins of insights) {
    createdInsights.push(await prisma.aiInsight.create({ data: { clinicId, yearMonth: latest, ...ins } }));
  }

  const actions = [
    { insightId: createdInsights[0].id, title: "平日夜間の初診枠を週2コマ増設", description: "火・木の18:30〜20:00に初診専用枠を設ける。担当は院長と勤務医で交代。", status: "IN_PROGRESS" as const, assignee: "院長", dueDate: new Date("2026-08-31") },
    { insightId: createdInsights[0].id, title: "Web予約システムの導入", description: "24時間オンライン予約を導入し、電話のみの導線を廃止する。", status: "TODO" as const, assignee: "事務長", dueDate: new Date("2026-09-30") },
    { insightId: createdInsights[1].id, title: "TC配置を週3日に増加", description: "補綴提案時のカウンセリング実施率100%を目指す。", status: "IN_PROGRESS" as const, assignee: "事務長", dueDate: new Date("2026-08-15") },
    { insightId: createdInsights[4].id, title: "初診時のSMS登録を必須化", description: "問診票にSMS登録欄を追加し、受付で登録を確認する。", status: "DONE" as const, assignee: "受付リーダー", dueDate: new Date("2026-07-10") },
    { insightId: createdInsights[3].id, title: "訪問ルートの地域別再編", description: "訪問先を3エリアに分け、曜日ごとに集約する。", status: "TODO" as const, assignee: "訪問担当Dr", dueDate: new Date("2026-10-31") },
  ];
  for (const a of actions) {
    await prisma.actionPlan.create({ data: { clinicId, ...a } });
  }
  console.log(`AI課題 ${insights.length}件 / 改善アクション ${actions.length}件を登録\n`);

  console.log("デモデータ投入が完了しました。");
}

main()
  .catch((e) => { console.error("ERROR:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
