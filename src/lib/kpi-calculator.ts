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
    noShowCount?: number;
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
  fulltimeAssistantCount?: number;
  parttimeAssistantCount?: number;
  fulltimeReceptionCount?: number;
  parttimeReceptionCount?: number;
  fulltimeTechnicianCount?: number;
  parttimeTechnicianCount?: number;
  clinicDaysPerMonth: number;
  avgHoursPerDay?: number;
  avgOvertimeHours?: number;
  avgTreatmentMinutes?: number;
}

/**
 * チェア稼働率の現実的な上限。
 * 準備・片付け・急患枠・キャンセル発生を考慮すると100%は達成不可能なため、
 * 空き枠損失額はこの水準までを「埋められる余地」として試算する。
 */
export const CHAIR_UTILIZATION_CEILING = 85;

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
  insurancePoints:         { name: "保険点数",           unit: "点",  category: "売上",   format: "number",   higherIsBetter: true },
  revenuePerPoint:         { name: "1点あたり単価",      unit: "円",  category: "売上",   format: "decimal",  higherIsBetter: true,  benchmark: 10 },
  pointDeductionRate:      { name: "返戻・査定減率",     unit: "%",   category: "売上",   format: "percent",  higherIsBetter: false, benchmark: 2 },
  totalPatientCount:       { name: "延患者数",           unit: "人",  category: "患者",   format: "number",   higherIsBetter: true },
  uniquePatientCount:      { name: "実患者数",           unit: "人",  category: "患者",   format: "number",   higherIsBetter: true },
  newPatientCount:         { name: "新患数",             unit: "人",  category: "患者",   format: "number",   higherIsBetter: true,  benchmark: 20 },
  returnPatientCount:      { name: "再来患者数",         unit: "人",  category: "患者",   format: "number",   higherIsBetter: true },
  appointmentCount:        { name: "予約数",             unit: "件",  category: "患者",   format: "number",   higherIsBetter: true },
  cancelCount:             { name: "キャンセル数",       unit: "件",  category: "患者",   format: "number",   higherIsBetter: false },
  returnRate:              { name: "再来率",             unit: "%",   category: "患者",   format: "percent",  higherIsBetter: true,  benchmark: 80 },
  discontinuedRate:        { name: "中断率",             unit: "%",   category: "患者",   format: "percent",  higherIsBetter: false, benchmark: 5 },
  maintenanceTransitionRate: { name: "メンテ移行率",     unit: "%",   category: "患者",   format: "percent",  higherIsBetter: true,  benchmark: 30 },
  cancelRate:              { name: "キャンセル率",       unit: "%",   category: "患者",   format: "percent",  higherIsBetter: false, benchmark: 10 },
  noShowCount:             { name: "無断キャンセル数",   unit: "件",  category: "患者",   format: "number",   higherIsBetter: false },
  noShowRate:              { name: "無断キャンセル率",   unit: "%",   category: "患者",   format: "percent",  higherIsBetter: false, benchmark: 2 },
  noShowLoss:              { name: "無断キャンセル損失額", unit: "円", category: "患者",  format: "currency", higherIsBetter: false },
  costPerAcquisition:      { name: "新患獲得単価",       unit: "円",  category: "患者",   format: "currency", higherIsBetter: false, benchmark: 10000 },
  revenuePerNewPatient:    { name: "新患1人あたり生涯売上", unit: "円", category: "患者", format: "currency", higherIsBetter: true },
  ltvToCpaRatio:           { name: "LTV/獲得単価比",     unit: "倍",  category: "患者",   format: "decimal",  higherIsBetter: true,  benchmark: 3 },
  avgRetentionMonths:      { name: "平均継続月数",       unit: "ヶ月", category: "患者",  format: "decimal",  higherIsBetter: true },
  revenuePerUnit:          { name: "ユニット1台あたり売上",     unit: "円", category: "生産性", format: "currency", higherIsBetter: true, benchmark: 1500000 },
  revenuePerActiveUnit:    { name: "稼働ユニット1台あたり売上", unit: "円", category: "生産性", format: "currency", higherIsBetter: true },
  chairUtilization:        { name: "チェア稼働率",       unit: "%",   category: "生産性", format: "percent",  higherIsBetter: true,  benchmark: 75 },
  chairMinutesUsed:        { name: "チェア稼働時間",     unit: "分",  category: "生産性", format: "number",   higherIsBetter: true },
  chairMinutesAvailable:   { name: "チェア稼働可能時間", unit: "分",  category: "生産性", format: "number",   higherIsBetter: true },
  revenuePerChairMinute:   { name: "チェア分単価",       unit: "円",  category: "生産性", format: "currency", higherIsBetter: true },
  idleChairLoss:           { name: "空き枠損失額",       unit: "円",  category: "生産性", format: "currency", higherIsBetter: false },
  dentistFte:              { name: "歯科医師FTE",       unit: "人",  category: "人員",   format: "decimal",  higherIsBetter: true },
  hygienistFte:            { name: "衛生士FTE",         unit: "人",  category: "人員",   format: "decimal",  higherIsBetter: true },
  totalStaffFte:           { name: "総スタッフFTE",     unit: "人",  category: "人員",   format: "decimal",  higherIsBetter: true },
  laborHoursTotal:         { name: "総労働時間",         unit: "時間", category: "人員",  format: "number",   higherIsBetter: false },
  revenuePerLaborHour:     { name: "人時生産性",         unit: "円",  category: "人員",   format: "currency", higherIsBetter: true },
  overtimeRatio:           { name: "残業比率",           unit: "%",   category: "人員",   format: "percent",  higherIsBetter: false, benchmark: 10 },
  revenuePerDentist:       { name: "Dr1人あたり売上",    unit: "円",  category: "生産性", format: "currency", higherIsBetter: true },
  revenuePerHygienist:     { name: "DH1人あたり売上",    unit: "円",  category: "生産性", format: "currency", higherIsBetter: true },
  patientsPerDay:          { name: "1日平均来院数",      unit: "人",  category: "生産性", format: "decimal",  higherIsBetter: true },
  revenuePerPatient:       { name: "患者単価",           unit: "円",  category: "生産性", format: "currency", higherIsBetter: true },
  laborCostRatio:          { name: "人件費率",           unit: "%",   category: "コスト", format: "percent",  higherIsBetter: false, benchmark: 25 },
  materialCostRatio:       { name: "材料費率",           unit: "%",   category: "コスト", format: "percent",  higherIsBetter: false, benchmark: 8 },
  totalCosts:              { name: "コスト合計",         unit: "円",  category: "コスト", format: "currency", higherIsBetter: false },
  directCost:              { name: "直接原価",           unit: "円",  category: "コスト", format: "currency", higherIsBetter: false },
  directAssignedCost:      { name: "直接計上費",         unit: "円",  category: "コスト", format: "currency", higherIsBetter: false },
  indirectCost:            { name: "間接費",             unit: "円",  category: "コスト", format: "currency", higherIsBetter: false },
  laborCost:               { name: "人件費",             unit: "円",  category: "コスト", format: "currency", higherIsBetter: false },
  materialCost:            { name: "材料費",             unit: "円",  category: "コスト", format: "currency", higherIsBetter: false },
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

  // --- 保険点数 ---
  // 診療報酬は1点=10円。レセプトの返戻・査定減があると実収入が10円を下回るため、
  // 「1点あたり実際にいくら入金されたか」で請求の精度が測れる。
  const insurancePoints = data.revenue.reduce((sum, r) => sum + (r.points || 0), 0);
  push("insurancePoints", insurancePoints);

  // 点数が計上されている部門の売上のみを対象にする（自費には点数が無いため）
  const pointBasedRevenue = data.revenue
    .filter((r) => (r.points || 0) > 0)
    .reduce((sum, r) => sum + r.amount, 0);
  const revenuePerPoint = insurancePoints > 0 ? pointBasedRevenue / insurancePoints : 0;
  push("revenuePerPoint", revenuePerPoint);

  const pointDeductionRate = revenuePerPoint > 0 ? (1 - revenuePerPoint / 10) * 100 : 0;
  push("pointDeductionRate", pointDeductionRate);

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
  push("returnPatientCount", returnPatientCount);

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

  push("appointmentCount", appointmentCount);
  push("cancelCount", cancelCount);

  // キャンセル率
  const cancelRate = appointmentCount > 0 ? (cancelCount / appointmentCount) * 100 : 0;
  push("cancelRate", cancelRate);

  // --- 生産性指標 ---
  const revenuePerUnit = profile.unitCount > 0 ? effectiveTotalRevenue / profile.unitCount : 0;
  push("revenuePerUnit", revenuePerUnit);

  const revenuePerActiveUnit = profile.activeUnitCount > 0 ? effectiveTotalRevenue / profile.activeUnitCount : 0;
  push("revenuePerActiveUnit", revenuePerActiveUnit);

  // --- チェア稼働率（時間ベース）---
  // 実際に診療で埋まった時間が、診療可能な時間の何%かを見る。
  // 「稼働ユニット数÷ユニット数」は設備の有無を示すだけで、稼働の実態を表さない。
  const chairCount = profile.activeUnitCount || profile.unitCount;
  const avgHoursPerDay = profile.avgHoursPerDay ?? 8;
  const avgTreatmentMinutes = profile.avgTreatmentMinutes ?? 45;

  const chairMinutesUsed = totalPatientCount * avgTreatmentMinutes;
  const chairMinutesAvailable = chairCount * profile.clinicDaysPerMonth * avgHoursPerDay * 60;
  const chairUtilization = chairMinutesAvailable > 0 ? (chairMinutesUsed / chairMinutesAvailable) * 100 : 0;

  push("chairMinutesUsed", chairMinutesUsed);
  push("chairMinutesAvailable", chairMinutesAvailable);
  push("chairUtilization", chairUtilization);

  // チェア1分あたりいくら稼いでいるか。保険と自費の差が最も出る指標
  const revenuePerChairMinute = chairMinutesUsed > 0 ? effectiveTotalRevenue / chairMinutesUsed : 0;
  push("revenuePerChairMinute", revenuePerChairMinute);

  // 空き枠損失額 = 上限稼働率まで埋めた場合に得られたはずの売上
  const targetMinutes = chairMinutesAvailable * (CHAIR_UTILIZATION_CEILING / 100);
  const idleMinutes = Math.max(0, targetMinutes - chairMinutesUsed);
  push("idleChairLoss", idleMinutes * revenuePerChairMinute);

  // --- 無断キャンセル ---
  // 事前連絡のあるキャンセルと違い、枠を埋め直せないため損失が確定する
  const noShowCount = totalAppts.reduce((s, a) => s + (a.noShowCount || 0), 0);
  push("noShowCount", noShowCount);
  push("noShowRate", appointmentCount > 0 ? (noShowCount / appointmentCount) * 100 : 0);
  push("noShowLoss", noShowCount * avgTreatmentMinutes * revenuePerChairMinute);

  // FTE計算（PT=0.5）
  const dentistFte = profile.fulltimeDentistCount + profile.parttimeDentistCount * 0.5;
  const hygienistFte = profile.fulltimeHygienistCount + profile.parttimeHygienistCount * 0.5;
  push("dentistFte", dentistFte);
  push("hygienistFte", hygienistFte);

  // --- 人時生産性 ---
  // 残業を含む実労働時間あたりの売上。残業でこなしている場合は生産性が下がる。
  const totalStaffFte =
    dentistFte +
    hygienistFte +
    (profile.fulltimeAssistantCount ?? 0) + (profile.parttimeAssistantCount ?? 0) * 0.5 +
    (profile.fulltimeReceptionCount ?? 0) + (profile.parttimeReceptionCount ?? 0) * 0.5 +
    (profile.fulltimeTechnicianCount ?? 0) + (profile.parttimeTechnicianCount ?? 0) * 0.5;
  push("totalStaffFte", totalStaffFte);

  const avgOvertimeHours = profile.avgOvertimeHours ?? 0;
  const laborHoursTotal = totalStaffFte * profile.clinicDaysPerMonth * (avgHoursPerDay + avgOvertimeHours);
  push("laborHoursTotal", laborHoursTotal);
  push("revenuePerLaborHour", laborHoursTotal > 0 ? effectiveTotalRevenue / laborHoursTotal : 0);
  push("overtimeRatio", avgHoursPerDay > 0 ? (avgOvertimeHours / avgHoursPerDay) * 100 : 0);

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
  const indirectCosts = totalCosts - directCosts - directAssignedCosts;

  push("totalCosts", totalCosts);
  push("directCost", directCosts);
  push("directAssignedCost", directAssignedCosts);
  push("indirectCost", indirectCosts);
  push("laborCost", laborCost);
  push("materialCost", materialCost);

  // 人件費率
  const laborCostRatio = effectiveTotalRevenue > 0 ? (laborCost / effectiveTotalRevenue) * 100 : 0;
  push("laborCostRatio", laborCostRatio);

  // 材料費率
  const materialCostRatio = effectiveTotalRevenue > 0 ? (materialCost / effectiveTotalRevenue) * 100 : 0;
  push("materialCostRatio", materialCostRatio);

  // --- 新患獲得効率 ---
  // 広告費のうち何円で新患1人を獲得できているか。紹介・通りがかりの新患も
  // 分母に含むため、広告経由のみの獲得単価より低く出る（いわゆるブレンドCPA）。
  const advertisingCost = data.costs
    .filter((c) => c.costItemCode === "ADVERTISING")
    .reduce((s, c) => s + c.amount, 0);
  const costPerAcquisition = newPatientCount > 0 ? advertisingCost / newPatientCount : 0;
  push("costPerAcquisition", costPerAcquisition);

  // 患者個人の通院履歴を持たないため、定常状態では
  // 「月商 ÷ 新患数」が新患1人あたりの生涯売上に等しくなる関係を使って推計する。
  // 患者数が急増・急減している時期は実態から乖離する。
  const revenuePerNewPatient = newPatientCount > 0 ? effectiveTotalRevenue / newPatientCount : 0;
  push("revenuePerNewPatient", revenuePerNewPatient);

  // 獲得コストの何倍を回収できているか
  const ltvToCpaRatio = costPerAcquisition > 0 ? revenuePerNewPatient / costPerAcquisition : 0;
  push("ltvToCpaRatio", ltvToCpaRatio);

  // 月次の中断率の逆数 = 平均して何ヶ月通い続けるか
  const avgRetentionMonths = discontinuedRate > 0 ? 100 / discontinuedRate : 0;
  push("avgRetentionMonths", avgRetentionMonths);

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
