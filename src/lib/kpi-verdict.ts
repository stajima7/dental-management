/**
 * KPIの「目安と比べてどうか」を日本語にする
 *
 * これまで良し悪しはカード上端の色だけで表していたが、色の意味はどこにも
 * 書かれておらず、経営に慣れていない人には伝わらなかった。
 * 「一般的な目安 20% → 平均より高い（良い）」のように言葉にする。
 *
 * 色覚特性のある利用者には色そのものが伝わらないため、
 * 文字を添えることはアクセシビリティの改善でもある。
 */

import { KPI_DEFINITIONS, getKpiStatus } from "./kpi-calculator";

export interface KpiVerdict {
  /** 「一般的な目安 20%」のような基準の提示。基準が無いKPIでは null */
  benchmarkLabel: string | null;
  /** 「平均より高い（良い）」のような判定。基準が無いKPIでは null */
  verdict: string | null;
  tone: "good" | "warning" | "critical" | "neutral";
}

/** KPIの値を単位付きで表示用に整える */
function formatValue(kpiCode: string, value: number): string {
  const def = KPI_DEFINITIONS[kpiCode];
  if (!def) return String(value);
  switch (def.format) {
    case "percent":
      return `${value.toFixed(1)}%`;
    case "currency":
      // 目安として読む数字なので万円単位に丸める（1,500,000円 → 150万円）
      return value >= 10000
        ? `${Math.round(value / 10000).toLocaleString()}万円`
        : `${Math.round(value).toLocaleString()}円`;
    case "decimal":
      return `${value.toFixed(1)}${def.unit}`;
    default:
      return `${Math.round(value).toLocaleString()}${def.unit}`;
  }
}

/**
 * 目安との比較を日本語で返す。
 * 目安が設定されていないKPIでは verdict を null にし、画面側は何も出さない
 * （根拠のない断定をしないため）。
 */
export function getKpiVerdict(kpiCode: string, value: number): KpiVerdict {
  const def = KPI_DEFINITIONS[kpiCode];
  const none: KpiVerdict = { benchmarkLabel: null, verdict: null, tone: "neutral" };
  // 壊れた値に対して断定的な判定を出さない（NaNは比較が常にfalseになり誤判定を招く）
  if (!def || !Number.isFinite(value)) return none;

  const status = getKpiStatus(kpiCode, value);
  const tone =
    status === "good" ? "good" as const :
    status === "warning" ? "warning" as const :
    status === "danger" ? "critical" as const : "neutral" as const;

  // 適正範囲で見る指標（平均保険点数など）は「幅に収まっているか」で言う
  if (def.rangeMin != null && def.rangeMax != null) {
    if (value <= 0) return none;
    const label = `適正範囲 ${formatValue(kpiCode, def.rangeMin)}〜${formatValue(kpiCode, def.rangeMax)}`;
    if (value >= def.rangeMin && value <= def.rangeMax) {
      return { benchmarkLabel: label, verdict: "範囲内（良い）", tone };
    }
    return {
      benchmarkLabel: label,
      verdict: value > def.rangeMax ? "範囲より高い（要確認）" : "範囲より低い（要確認）",
      tone,
    };
  }

  if (def.benchmark == null) return none;

  const label = `一般的な目安 ${formatValue(kpiCode, def.benchmark)}`;

  // 値が未入力（0）のときは判定しない。0を「非常に悪い」と出すと誤解を招く
  if (value === 0) return { benchmarkLabel: label, verdict: null, tone: "neutral" };

  // 「高いほど良い」指標と「低いほど良い」指標で言葉を反転させる
  if (def.higherIsBetter) {
    if (status === "good") return { benchmarkLabel: label, verdict: "目安より高い（良い）", tone };
    if (status === "warning") return { benchmarkLabel: label, verdict: "目安に少し届かない", tone };
    return { benchmarkLabel: label, verdict: "目安より低い（要改善）", tone };
  }
  if (status === "good") return { benchmarkLabel: label, verdict: "目安より低い（良い）", tone };
  if (status === "warning") return { benchmarkLabel: label, verdict: "目安を少し超えている", tone };
  return { benchmarkLabel: label, verdict: "目安より高い（要改善）", tone };
}

/** 前月比を「先月より◯◯増えました」の形にする。差が無い場合は null */
export function formatChange(kpiCode: string, diff: number | null | undefined): string | null {
  // 計算が壊れた月に「NaN円減りました」と出さないよう、有限の数値だけを扱う
  if (diff == null || !Number.isFinite(diff) || diff === 0) return null;
  const def = KPI_DEFINITIONS[kpiCode];
  if (!def) return null;

  const up = diff > 0;
  const abs = Math.abs(diff);

  // 率は「ポイント」で言う（%の増減を%で言うと二重に読めるため）
  if (def.format === "percent") {
    if (abs < 0.05) return null;
    return `先月より ${abs.toFixed(1)}ポイント${up ? "上がりました" : "下がりました"}`;
  }
  if (def.format === "currency") {
    if (abs < 1000) return null;
    const yen = abs >= 10000
      ? `${Math.round(abs / 10000).toLocaleString()}万円`
      : `${Math.round(abs).toLocaleString()}円`;
    return `先月より ${yen}${up ? "増えました" : "減りました"}`;
  }
  if (abs < 0.05) return null;
  const n = def.format === "decimal" ? abs.toFixed(1) : Math.round(abs).toLocaleString();
  return `先月より ${n}${def.unit}${up ? "増えました" : "減りました"}`;
}
