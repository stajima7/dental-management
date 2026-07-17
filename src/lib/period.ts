/**
 * 期間指定（トレンドグラフ用）
 *
 * 基準月から遡ってNヶ月、または開始〜終了月を自由指定する。
 */

export const PERIOD_PRESETS = [
  { months: 3, label: "3ヶ月" },
  { months: 6, label: "6ヶ月" },
  { months: 12, label: "1年" },
  { months: 24, label: "2年" },
  { months: 36, label: "3年" },
] as const;

export type Period =
  | { type: "preset"; months: number }
  | { type: "custom"; from: string; to: string };

export const DEFAULT_PERIOD: Period = { type: "preset", months: 6 };

const shiftMonth = (yearMonth: string, diff: number): string => {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(y, m - 1 + diff, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/** 期間指定を実際の開始月・終了月に変換する（基準月がその期間の最終月になる） */
export function resolvePeriod(period: Period, baseMonth: string): { from: string; to: string } {
  if (period.type === "custom") {
    // 開始と終了が逆に指定されても動くようにする
    return period.from <= period.to
      ? { from: period.from, to: period.to }
      : { from: period.to, to: period.from };
  }
  return { from: shiftMonth(baseMonth, -(period.months - 1)), to: baseMonth };
}

/** 期間の月数（カスタム指定時の表示に使う） */
export function countMonths(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm) + 1;
}

/**
 * グラフ横軸のラベル。"2026-07" → "26/07"
 * 年をまたぐ期間でも月が重複しないよう、年を必ず含める。
 */
export function formatMonthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split("-");
  return `${y.slice(2)}/${m}`;
}
