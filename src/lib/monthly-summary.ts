/**
 * 今月のまとめ
 *
 * ダッシュボードを開いて最初に目に入るものを、数字ではなく日本語の文章にする。
 * 経営に慣れていない先生が「漠然と眺めてしまう」状態を避けるのが目的。
 *
 * 出す内容は4つに絞る:
 *   - 今月の売上と前月差
 *   - 良かった点（目安を上回っている指標のうち、最も誇れるもの）
 *   - 気になる点（目安を下回っている指標のうち、最も影響が大きいもの）
 *   - 今月やること（改善額の大きい順に3つ。別ロジック）
 *
 * 指標を全部並べると結局「眺めるだけ」に戻るため、各1件に絞る。
 */

import { KPI_DEFINITIONS, getKpiStatus } from "./kpi-calculator";
import { getKpiVerdict, formatChange } from "./kpi-verdict";
import { AnalysisMode, kpiVisibleInMode } from "./analysis-mode";

export interface SummaryLine {
  kind: "headline" | "good" | "warning" | "trend";
  /** 表示する本文 */
  text: string;
  /** 根拠になったKPI（画面から用語集や詳細へ繋ぐために持つ） */
  kpiCode?: string;
}

export interface KpiInput {
  kpiCode: string;
  kpiValue: number;
  comparisonPrevMonth?: number | null;
}

/**
 * 良し悪しを語る価値がある指標に絞る。
 * 「配賦後営業利益率」のような内部的な指標を先生に見せても行動に繋がらない。
 */
// 売上総利益率は除外している。歯科は材料費の比率が小さく90%超が構造的に当たり前で、
// 毎月「目安を上回っています」と出しても先生の判断材料にならないため。
const GOOD_CANDIDATES = [
  "selfPayRatio", "operatingProfitRate", "returnRate", "maintenanceTransitionRate",
  "chairUtilization", "revenuePerPoint", "recallContinuationRate", "recallBookingRate",
  "cancelRecoveryRate", "safetyMarginRate",
];
const WARNING_CANDIDATES = [
  "operatingProfitRate", "laborCostRatio", "materialCostRatio", "cancelRate",
  "noShowRate", "discontinuedRate", "chairUtilization", "selfPayRatio",
  "newPatientCount", "returnRate", "pointDeductionRate", "recallBookingRate",
  "maintenanceTransitionRate", "safetyMarginRate", "overtimeRatio", "pointsPerPatient",
];

/** 表示用に整えた値（「24.5%」「1,284万円」） */
function fmt(kpiCode: string, value: number): string {
  const def = KPI_DEFINITIONS[kpiCode];
  if (!def) return String(Math.round(value));
  if (def.format === "percent") return `${value.toFixed(1)}%`;
  if (def.format === "currency") {
    return value >= 10000
      ? `${Math.round(value / 10000).toLocaleString()}万円`
      : `${Math.round(value).toLocaleString()}円`;
  }
  if (def.format === "decimal") return `${value.toFixed(1)}${def.unit}`;
  return `${Math.round(value).toLocaleString()}${def.unit}`;
}

/**
 * 目安からどれだけ離れているかを、指標どうしで比べられる形にする。
 * 単位が違う指標を並べるため、目安に対する比率で正規化する。
 */
function gapRatio(kpiCode: string, value: number): number {
  const def = KPI_DEFINITIONS[kpiCode];
  if (!def?.benchmark || def.benchmark === 0 || value === 0) return 0;
  const diff = def.higherIsBetter ? def.benchmark - value : value - def.benchmark;
  return diff / def.benchmark; // 正なら目安に届いていない
}

export function buildMonthlySummary(
  kpis: KpiInput[],
  yearMonth: string,
  mode: AnalysisMode,
  /** 3ヶ月以上続けて減っている指標の判定に使う（新しい順の値） */
  recentTrend?: Record<string, number[]>
): SummaryLine[] {
  const lines: SummaryLine[] = [];
  const map = new Map(kpis.map((k) => [k.kpiCode, k]));
  const val = (c: string) => map.get(c)?.kpiValue ?? 0;
  const usable = (c: string) => map.has(c) && kpiVisibleInMode(c, mode) && val(c) !== 0;

  // --- 今月の売上 ---
  const revenue = map.get("totalRevenue");
  if (revenue && revenue.kpiValue > 0) {
    const change = formatChange("totalRevenue", revenue.comparisonPrevMonth);
    const [y, m] = yearMonth.split("-");
    lines.push({
      kind: "headline",
      kpiCode: "totalRevenue",
      text: `${Number(y)}年${Number(m)}月の売上は ${fmt("totalRevenue", revenue.kpiValue)} でした。`
        + (change ? `${change}。` : ""),
    });
  }

  // --- 良かった点：目安を上回っている指標のうち、最も差が大きいもの ---
  const goods = GOOD_CANDIDATES
    .filter((c) => usable(c) && getKpiStatus(c, val(c)) === "good")
    .map((c) => ({ code: c, score: -gapRatio(c, val(c)) })) // 目安を超えるほど大きい
    .sort((a, b) => b.score - a.score);
  if (goods.length > 0) {
    const c = goods[0].code;
    const v = getKpiVerdict(c, val(c));
    // 「低いほど良い」指標では上回る/下回るが逆になる
    const better = KPI_DEFINITIONS[c].higherIsBetter ? "を上回っています" : "を下回っています";
    lines.push({
      kind: "good",
      kpiCode: c,
      text: `${KPI_DEFINITIONS[c].name}は ${fmt(c, val(c))} です。`
        + (v.benchmarkLabel ? `${v.benchmarkLabel}${better}。` : ""),
    });
  }

  // --- 気になる点：目安に届いていない指標のうち、最も差が大きいもの ---
  const warns = WARNING_CANDIDATES
    .filter((c) => usable(c) && ["warning", "danger"].includes(getKpiStatus(c, val(c))))
    .map((c) => ({ code: c, score: gapRatio(c, val(c)) }))
    .sort((a, b) => b.score - a.score);
  if (warns.length > 0) {
    const c = warns[0].code;
    const v = getKpiVerdict(c, val(c));
    // 高いほど良い指標は「届いていない」、低いほど良い指標は「超えている」
    const worse = KPI_DEFINITIONS[c].higherIsBetter ? "に届いていません" : "を超えています";
    lines.push({
      kind: "warning",
      kpiCode: c,
      text: `${KPI_DEFINITIONS[c].name}は ${fmt(c, val(c))} です。`
        + (v.benchmarkLabel ? `${v.benchmarkLabel}${worse}。` : ""),
    });
  }

  // --- 続けて悪化している指標があれば知らせる ---
  // 単月の良し悪しより、続いている変化のほうが先に手を打つ価値がある
  if (recentTrend) {
    for (const code of ["newPatientCount", "totalPatientCount", "uniquePatientCount", "totalRevenue"]) {
      const series = recentTrend[code];
      if (!series || series.length < 3 || !kpiVisibleInMode(code, mode)) continue;
      // series は新しい順。3ヶ月続けて前月を下回っているか
      const declining = series.slice(0, 3).every((v, i, arr) => i === 0 || (arr[i - 1] < v && v > 0));
      if (declining && series[0] > 0) {
        lines.push({
          kind: "trend",
          kpiCode: code,
          text: `${KPI_DEFINITIONS[code].name}が3ヶ月続けて減っています（${fmt(code, series[2])} → ${fmt(code, series[0])}）。`
            + (code === "newPatientCount" ? "数ヶ月後の売上に影響します。" : ""),
        });
        break; // 1件で十分。並べると読まれなくなる
      }
    }
  }

  return lines;
}
