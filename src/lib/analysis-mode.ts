/**
 * 分析モード
 *
 * 医院が入力できるデータに応じて、閲覧できる分析を3つに分ける。
 *   FINANCIAL  … 医院設定 + 財務諸表(BS/PL/CS) から分析
 *   CLINICAL   … 医院設定 + 患者数・診療点数(カルテ/レセプト) から分析
 *   INTEGRATED … 両方（現行の全機能）
 *
 * どのKPIがどのデータを必要とするかで表示可否を決める。
 *   - 財務データ = コスト(monthlyCosts)。利益・コスト率・損益分岐点はこれが要る。
 *   - 診療データ = 患者数・予約・保険点数(monthlyPatients/Appointments・points)。
 *   - 売上金額・医院設定(人員/設備)は両モードで共通して使えるため、どちらのタグも付けない。
 */

export type AnalysisMode = "FINANCIAL" | "CLINICAL" | "INTEGRATED";

export const ANALYSIS_MODES: { key: AnalysisMode; label: string; short: string; desc: string }[] = [
  { key: "INTEGRATED", label: "統合分析", short: "統合", desc: "財務＋患者・診療の全データ" },
  { key: "FINANCIAL", label: "財務分析", short: "財務", desc: "医院設定＋BS/PL/CS" },
  { key: "CLINICAL", label: "患者・診療分析", short: "患者・診療", desc: "医院設定＋カルテ/レセプト" },
];

export const DEFAULT_ANALYSIS_MODE: AnalysisMode = "INTEGRATED";

/** コスト（財務諸表）が無いと算出できないKPI */
export const FINANCE_KPIS = new Set<string>([
  // コスト
  "laborCostRatio", "materialCostRatio", "totalCosts", "directCost",
  "directAssignedCost", "indirectCost", "laborCost", "materialCost",
  // 収益（利益はコストを引くため財務が要る）
  "grossProfit", "grossProfitRate", "operatingProfit", "operatingProfitRate",
  "preAllocationProfit", "preAllocationProfitRate", "postAllocationProfit", "postAllocationProfitRate",
  // 損益分岐点
  "marginalProfitRate", "breakEvenRevenue", "safetyMarginRate",
  "breakEvenChairUtilization", "breakEvenPatientCount",
  // 新患獲得効率（広告費というコストを使う）
  "costPerAcquisition", "ltvToCpaRatio",
]);

/** 患者数・診療点数（カルテ/レセプト）が無いと算出できないKPI */
export const CLINICAL_KPIS = new Set<string>([
  // 保険点数
  "insurancePoints", "revenuePerPoint", "pointDeductionRate", "pointsPerPatient",
  // 患者
  "totalPatientCount", "uniquePatientCount", "newPatientCount", "returnPatientCount",
  "appointmentCount", "cancelCount", "returnRate", "discontinuedRate",
  "maintenanceTransitionRate", "cancelRate", "noShowCount", "noShowRate", "noShowLoss",
  // リコール（呼び戻し）の歩留まり
  "recallNotifiedCount", "recallBookedCount", "recallVisitedCount",
  "recallBookingRate", "recallVisitRate", "recallContinuationRate",
  // キャンセル内訳・中断患者の実数
  "cancelRecoveryRate", "clinicSideCancelRate", "discontinuedPatientCount",
  // 新患獲得単価は広告費(財務)と新患数(診療)の両方が要る。LTV比も同様に両方
  "costPerAcquisition", "revenuePerNewPatient", "ltvToCpaRatio", "avgRetentionMonths",
  // 生産性のうち患者数を使うもの
  "chairUtilization", "chairMinutesUsed", "revenuePerChairMinute", "idleChairLoss",
  "patientsPerDay", "revenuePerPatient",
  // 損益分岐点のうち患者・稼働に依存するもの
  "breakEvenChairUtilization", "breakEvenPatientCount",
]);

/** そのKPIが指定モードで閲覧可能か */
export function kpiVisibleInMode(kpiCode: string, mode: AnalysisMode): boolean {
  if (mode === "INTEGRATED") return true;
  if (mode === "FINANCIAL") return !CLINICAL_KPIS.has(kpiCode); // 診療データ依存を隠す
  return !FINANCE_KPIS.has(kpiCode);                             // CLINICAL: 財務データ依存を隠す
}

/** 画面のセクション（チャート・表）が指定モードで表示可能か。
 *  requires にそのセクションが必要とするデータ種別を渡す。 */
export function sectionVisibleInMode(
  requires: ("finance" | "clinical")[],
  mode: AnalysisMode
): boolean {
  if (mode === "INTEGRATED") return true;
  if (mode === "FINANCIAL") return !requires.includes("clinical");
  return !requires.includes("finance");
}
