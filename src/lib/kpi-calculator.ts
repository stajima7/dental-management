/**
 * KPI計算ロジック
 * 月次データからKPIを算出する
 */

import { BENCHMARKS } from "./constants";

export interface MonthlyData {
  revenue: {
    departmentType: string;
    insuranceOrPrivate: string;
    amount: number;
    points: number;
  }[];
  patients: {
    departmentType: string;
    totalPatientCount: number;
    uniquePatientCount: number;
    newPatientCount: number;
    returnPatientCount: number;
    dropoutCount?: number;
    maintenanceTransitionCount: number;
  }[];
  appointments: {
    departmentType: string;
    appointmentCount: number;
    cancelCount: number;
    completedCount: number;
  }[];
  costs: {
    costItemCode: string;
    departmentType: string;
    costLayer?: string;
    // legacy support
    isDirectCost?: boolean;
    amount: number;
  }[];
}

export interface ProfileData {
  unitCount: number;
  activeUnitCount: number;
  fulltimeDentistCount: number;
  parttimeDentistCount: number;
  fulltimeHygienistCount: number;
  parttimeHygienistCount: number;
  clinicDaysPerMonth: number;
}

export interface KpiResult {
  kpiCode: string;
  kpiValue: number;
  benchmarkValue?: number;
}

// KPI定義マスタ
export const KPI_DEFINITIONS: Record<string, {
  name: string;
  unit: string;
  category: string;
  format: "currency" | "percent" | "number" | "decimal";
  higherIsBetter: boolean;
  benchmark?: number;
}> = {
  totalRevenue:            { name: "月商",               unit: "円",  category: "売上",   format: "currency", higherIsBetter: true },
  insuranceRevenue:        { name: "保険売上",           unit: "円",  category: "売上",   format: "currency", higherIsBetter: true },
  selfPayRevenue:          { name: "自費売上",           unit: "円",  category: "売上",   format: "currency", higherIsBetter: true },
  maintenanceRevenue:      { name: "メンテ売上",         unit: "円",  category: "売上",   format: "currency", higherIsBetter: true },
  homeVisitRevenue:        { name: "訪問売上",           unit: "円",  category: "売上",   format: "currency", higherIsBetter: true },
  selfPayRatio:            { name: "自費率",             unit: "%",   category: "売上",   format: "percent",  higherIsBetter: true,  benchmark: 20 },
  totalPatientCount:       { name: "延患者数",           unit: "人",  category: "患者",   format: "number",   higherIsBetter: true },
  uniquePatientCount:      { name: "実患者数",           unit: "人",  category: "患者",   format: "number",   higherIsBetter: true },
  newPatientCount:         { name: "新患数",             unit: "人",  category: "患者",   format: "number",   higherIsBetter: true,  benchmark: 20 },
  returnRate:              { name: "再来率",             unit: "%",   category: "患者",   format: "percent",  higherIsBetter: true,  benchmark: 80 },
  discontinuedRate:        { name: "中断率",             unit: "%",   category: "患者",   format: "percent",  higherIsBetter: false, benchmark: 5 },
  maintenanceTransitionRate: { name: "メンテ移行率",     unit: "%",   category: "患者",   format: "percent",  higherIsBetter: true,  benchmark: 30 },
  cancelRate:              { name: "キャンセル率",       unit: "%",   category: "患者",   format: "percent",  higherIsBetter: false, benchmark: 10 },
  revenuePerUnit:          { name: "ユニット1台あたり売上",     unit: "円", category: "生産性", format: "currency", higherIsBetter: true, benchmark: 1500000 },
  revenuePerActiveUnit:    { name: "稼働ユニット1台あたり売上", unit: "円", category: "生産性", format: "currency", higherIsBetter: true },
  revenuePerDentist:       { name: "Dr1人あたり売上",    unit: "円",  category: "生産性", format: "currency", higherIsBetter: true },
  revenuePerHygienist:     { name: "DH1人あたり売上",    unit: "円",  category: "生産性", format: "currency", higherIsBetter: true },
  patientsPerDay:          { name: "1日平均来院数",      unit: "人",  category: "生産性", format: "decimal",  higherIsBetter: true },
  revenuePerPatient:       { name: "患者単価",           unit: "円",  category: "生産性", format: "currency", higherIsBetter: true },
  laborCostRatio:          { name: "人件費率",           unit: "%",   category: "コスト", format: "percent",  higherIsBetter: false, benchmark: 25 },
  materialCostRatio:       { name: "材料費率",           unit: "%",   category: "コスト", format: "percent",  higherIsBetter: false, benchmark: 8 },
  grossProfit:             { name: "売上総利益",         unit: "円",  category: "収益",   format: "currency", higherIsBetter: true },
  grossProfitRate:         { name: "売上総利益率",       unit: "%",   category: "収益",   format: "percent",  higherIsBetter: true,  benchmark: 70 },
  operatingProfit:         { name: "営業利益",           unit: "円",  category: "収益",   format: "currency", higherIsBetter: true },
  operatingProfitRate:     { name: "営業利益率",         unit: "%",   category: "収益",   format: "percent",  higherIsBetter: true,  benchmark: 20 },
  preAllocationProfit:     { name: "配賦前利益",         unit: "円",  category: "収益",   format: "currency", higherIsBetter: true },
  preAllocationProfitRate: { name: "配賦前利益率",       unit: "%",   category: "収益",   format: "percent",  higherIsBetter: true },
  postAllocationProfit:    { name: "配賦後営業利益",     unit: "円",  category: "収益",   format: "currency", higherIsBetter: true },
  postAllocationProfitRate:{ name: "配賦後営業利益率",   unit: "%",   category: "収益",   format: "percent",  higherIsBetter: true },
};

export function calculateKpis(data: MonthlyData, profile: ProfileData): KpiResult[] {
  const kpis: KpiResult[] = [];
  const push = (kpiCode: string, kpiValue: number) => {
    const def = KPI_DEFINITIONS[kpiCode];
    kpis.push({ kpiCode, kpiValue, benchmarkValue: def?.benchmark });
  };

  // --- 売上関連 ---
  const totalRevenue = data.revenue
    .filter((r) => r.departmentType === "TOTAL")
    .reduce((sum, r) => sum + r.amount, 0);

  const insuranceRevenue = data.revenue
    .filter((r) => r.departmentType === "INSURANCE")
    .reduce((sum, r) => sum + r.amount, 0);

  const selfPayRevenue = data.revenue
    .filter((r) => r.departmentType === "SELF_PAY")
    .reduce((sum, r) => sum + r.amount, 0);

  const maintenanceRevenue = data.revenue
    .filter((r) => r.departmentType === "MAINTENANCE")
    .reduce((sum, r) => sum + r.amount, 0);

  const homeVisitRevenue = data.revenue
    .filter((r) => r.departmentType === "HOME_VISIT")
    .reduce((sum, r) => sum + r.amount, 0);

  const effectiveTotalRevenue = totalRevenue || (insuranceRevenue + selfPayRevenue + maintenanceRevenue + homeVisitRevenue);

  push("totalRevenue", effectiveTotalRevenue);
  push("insuranceRevenue", insuranceRevenue);
  push("selfPayRevenue", selfPayRevenue);
  push("maintenanceRevenue", maintenanceRevenue);
  push("homeVisitRevenue", homeVisitRevenue);

  // 自費率
  const selfPayRatio = effectiveTotalRevenue > 0 ? (selfPayRevenue / effectiveTotalRevenue) * 100 : 0;
  push("selfPayRatio", selfPayRatio);

  // --- 患者関連 ---
  const totalPatients = data.patients.filter((p) => p.departmentType === "TOTAL");
  const totalPatientCount = totalPatients.reduce((s, p) => s + p.totalPatientCount, 0);
  const uniquePatientCount = totalPatients.reduce((s, p) => s + p.uniquePatientCount, 0);
  const newPatientCount = totalPatients.reduce((s, p) => s + p.newPatientCount, 0);
  const returnPatientCount = totalPatients.reduce((s, p) => s + p.returnPatientCount, 0);
  const dropoutCount = totalPatients.reduce((s, p) => s + (p.dropoutCount || 0), 0);
  const maintenanceTransitionCount = totalPatients.reduce((s, p) => s + p.maintenanceTransitionCount, 0);

  push("totalPatientCount", totalPatientCount);
  push("uniquePatientCount", uniquePatientCount);
  push("newPatientCount", newPatientCount);

  // 再来率
  const returnRate = uniquePatientCount > 0 ? (returnPatientCount / uniquePatientCount) * 100 : 0;
  push("returnRate", returnRate);

  // 中断率
  const discontinuedRate = uniquePatientCount > 0 ? (dropoutCount / uniquePatientCount) * 100 : 0;
  push("discontinuedRate", discontinuedRate);

  // メンテ移行率
  const maintenanceTransitionRate = uniquePatientCount > 0 ? (maintenanceTransitionCount / uniquePatientCount) * 100 : 0;
  push("maintenanceTransitionRate", maintenanceTransitionRate);

  // --- 予約関連 ---
  const totalAppts = data.appointments.filter((a) => a.departmentType === "TOTAL");
  const appointmentCount = totalAppts.reduce((s, a) => s + a.appointmentCount, 0);
  const cancelCount = totalAppts.reduce((s, a) => s + a.cancelCount, 0);

  // キャンセル率
  const cancelRate = appointmentCount > 0 ? (cancelCount / appointmentCount) * 100 : 0;
  push("cancelRate", cancelRate);

  // --- 生産性指標 ---
  const revenuePerUnit = profile.unitCount > 0 ? effectiveTotalRevenue / profile.unitCount : 0;
  push("revenuePerUnit", revenuePerUnit);

  const revenuePerActiveUnit = profile.activeUnitCount > 0 ? effectiveTotalRevenue / profile.activeUnitCount : 0;
  push("revenuePerActiveUnit", revenuePerActiveUnit);

  // FTE計算（PT=0.5）
  const dentistFte = profile.fulltimeDentistCount + profile.parttimeDentistCount * 0.5;
  const hygienistFte = profile.fulltimeHygienistCount + profile.parttimeHygienistCount * 0.5;

  const revenuePerDentist = dentistFte > 0 ? effectiveTotalRevenue / dentistFte : 0;
  push("revenuePerDentist", revenuePerDentist);

  const revenuePerHygienist = hygienistFte > 0 ? maintenanceRevenue / hygienistFte : 0;
  push("revenuePerHygienist", revenuePerHygienist);

  const patientsPerDay = profile.clinicDaysPerMonth > 0 ? totalPatientCount / profile.clinicDaysPerMonth : 0;
  push("patientsPerDay", patientsPerDay);

  const revenuePerPatient = totalPatientCount > 0 ? effectiveTotalRevenue / totalPatientCount : 0;
  push("revenuePerPatient", revenuePerPatient);

  // --- コスト関連 ---
  const isDirectCost = (c: MonthlyData["costs"][0]) =>
    c.costLayer === "DIRECT" || c.isDirectCost === true;

  const isDirectAssigned = (c: MonthlyData["costs"][0]) =>
    c.costLayer === "DIRECT_ASSIGNED";

  const totalCosts = data.costs.reduce((s, c) => s + c.amount, 0);
  const laborCost = data.costs
    .filter((c) => ["LABOR", "RECEPTION_LABOR", "COMMON_STAFF_LABOR"].includes(c.costItemCode))
    .reduce((s, c) => s + c.amount, 0);
  const materialCost = data.costs
    .filter((c) => ["LAB_FEE", "DIRECT_MATERIAL"].includes(c.costItemCode))
    .reduce((s, c) => s + c.amount, 0);
  const directCosts = data.costs.filter(isDirectCost).reduce((s, c) => s + c.amount, 0);
  const directAssignedCosts = data.costs.filter(isDirectAssigned).reduce((s, c) => s + c.amount, 0);

  // 人件費率
  const laborCostRatio = effectiveTotalRevenue > 0 ? (laborCost / effectiveTotalRevenue) * 100 : 0;
  push("laborCostRatio", laborCostRatio);

  // 材料費率
  const materialCostRatio = effectiveTotalRevenue > 0 ? (materialCost / effectiveTotalRevenue) * 100 : 0;
  push("materialCostRatio", materialCostRatio);

  // 売上総利益 = 売上 - 直接原価
  const grossProfit = effectiveTotalRevenue - directCosts;
  push("grossProfit", grossProfit);

  const grossProfitRate = effectiveTotalRevenue > 0 ? (grossProfit / effectiveTotalRevenue) * 100 : 0;
  push("grossProfitRate", grossProfitRate);

  // 営業利益 = 売上 - 全コスト
  const operatingProfit = effectiveTotalRevenue - totalCosts;
  push("operatingProfit", operatingProfit);

  const operatingProfitRate = effectiveTotalRevenue > 0 ? (operatingProfit / effectiveTotalRevenue) * 100 : 0;
  push("operatingProfitRate", operatingProfitRate);

  // 配賦前利益 = 売上 - 直接原価 - 直接計上費
  const preAllocationProfit = effectiveTotalRevenue - directCosts - directAssignedCosts;
  push("preAllocationProfit", preAllocationProfit);

  const preAllocationProfitRate = effectiveTotalRevenue > 0 ? (preAllocationProfit / effectiveTotalRevenue) * 100 : 0;
  push("preAllocationProfitRate", preAllocationProfitRate);

  // 配賦後営業利益（＝営業利益と同じ。部門別の場合は異なる）
  push("postAllocationProfit", operatingProfit);
  push("postAllocationProfitRate", operatingProfitRate);

  return kpis;
}

/**
 * KPIのベンチマーク比較結果
 */
export function getKpiStatus(kpiCode: string, value: number): "good" | "warning" | "danger" | "neutral" {
  const def = KPI_DEFINITIONS[kpiCode];
  if (!def?.benchmark) return "neutral";

  const bm = def.benchmark;
  if (def.higherIsBetter) {
    return value >= bm ? "good" : value >= bm * 0.7 ? "warning" : "danger";
  } else {
    return value <= bm ? "good" : value <= bm * 1.5 ? "warning" : "danger";
  }
}
