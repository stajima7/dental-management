/**
 * 季節性分析
 *
 * 「8月は年間平均を8%下回る」といった季節パターンを検出し、日本語の所見を生成する。
 *
 * トレンドの除去について:
 * 単純に「その暦月の平均 ÷ 全期間の平均」で季節指数を出すと、成長・衰退の
 * トレンドが混ざる。売上が右肩上がりの医院では、年の前半の月ほど過小に、
 * 後半の月ほど過大に評価されてしまう。そのため12ヶ月の中心化移動平均で
 * トレンドを推定し、実測値との比を取ってから暦月ごとに平均する
 * （古典的な季節分解）。
 */

export interface SeasonalityInput {
  yearMonth: string;
  value: number;
}

export interface MonthIndex {
  /** 暦月 1〜12 */
  month: number;
  /** 季節指数。1.0が平均、0.92なら平均より8%低い */
  index: number;
  /** 指数の算出に使えたデータ点の数 */
  sampleCount: number;
}

export interface SeasonalityResult {
  /** 分析できたか */
  available: boolean;
  /** 分析できない場合の理由 */
  reason?: string;
  monthlyIndex: MonthIndex[];
  /** 日本語の所見 */
  findings: string[];
  /** 季節変動の大きさ（最も高い月と低い月の差、%ポイント） */
  swing: number;
  /** トレンド除去に使えたデータ点の数。少ないほど信頼性が下がる */
  detrendedPoints: number;
}

/** 暦月ごとの一般的な事象。因果ではなく「その時期にあたる」事実として添える */
const MONTH_CONTEXT: Record<number, string> = {
  1: "年始で診療日数が少なくなる時期にあたります",
  5: "ゴールデンウィークにあたります",
  8: "お盆にあたります",
  12: "年末で、年内に治療を終えたい患者が集中しやすい時期にあたります",
  3: "年度末にあたります",
};

const monthOf = (yearMonth: string) => Number(yearMonth.split("-")[1]);

/**
 * 12ヶ月の中心化移動平均を返す。
 * 前後6ヶ月が揃わない両端は null になる。
 */
function centeredMovingAverage(values: number[]): (number | null)[] {
  const n = values.length;
  return values.map((_, i) => {
    if (i < 6 || i > n - 7) return null;
    // 12ヶ月移動平均は偶数個のため、両端を半分の重みにして中心を合わせる
    let sum = values[i - 6] * 0.5 + values[i + 6] * 0.5;
    for (let k = i - 5; k <= i + 5; k++) sum += values[k];
    return sum / 12;
  });
}

export function analyzeSeasonality(input: SeasonalityInput[]): SeasonalityResult {
  const rows = [...input].sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
  const empty: SeasonalityResult = { available: false, monthlyIndex: [], findings: [], swing: 0, detrendedPoints: 0 };

  if (rows.length < 24) {
    return { ...empty, reason: `季節性の分析には24ヶ月以上のデータが必要です（現在${rows.length}ヶ月）。` };
  }

  const values = rows.map((r) => r.value);
  const ma = centeredMovingAverage(values);

  // 実測値 ÷ トレンド = 季節要因。トレンドが取れない両端は除く
  const ratiosByMonth = new Map<number, number[]>();
  let detrendedPoints = 0;
  for (let i = 0; i < rows.length; i++) {
    const trend = ma[i];
    if (trend == null || trend <= 0) continue;
    const m = monthOf(rows[i].yearMonth);
    if (!ratiosByMonth.has(m)) ratiosByMonth.set(m, []);
    ratiosByMonth.get(m)!.push(values[i] / trend);
    detrendedPoints++;
  }

  if (ratiosByMonth.size < 12) {
    return {
      ...empty,
      reason: `トレンドを除去すると各月のデータが不足します（12ヶ月中${ratiosByMonth.size}ヶ月分のみ）。あと数ヶ月分のデータが必要です。`,
    };
  }

  // 暦月ごとに平均し、全体の平均が1.0になるよう正規化する
  const rawIndex = new Map<number, number>();
  for (const [m, list] of ratiosByMonth) {
    rawIndex.set(m, list.reduce((s, v) => s + v, 0) / list.length);
  }
  const mean = Array.from(rawIndex.values()).reduce((s, v) => s + v, 0) / rawIndex.size;

  const monthlyIndex: MonthIndex[] = Array.from(rawIndex.entries())
    .map(([month, v]) => ({
      month,
      index: v / mean,
      sampleCount: ratiosByMonth.get(month)!.length,
    }))
    .sort((a, b) => a.month - b.month);

  const sorted = [...monthlyIndex].sort((a, b) => a.index - b.index);
  const lowest = sorted[0];
  const highest = sorted[sorted.length - 1];
  const swing = (highest.index - lowest.index) * 100;

  const pctOf = (idx: number) => Math.abs((idx - 1) * 100).toFixed(1);
  const findings: string[] = [];

  findings.push(
    `年間で最も落ち込むのは${lowest.month}月で、平均を${pctOf(lowest.index)}%下回ります。` +
      (MONTH_CONTEXT[lowest.month] ? `${MONTH_CONTEXT[lowest.month]}。` : "")
  );
  findings.push(
    `最も伸びるのは${highest.month}月で、平均を${pctOf(highest.index)}%上回ります。` +
      (MONTH_CONTEXT[highest.month] ? `${MONTH_CONTEXT[highest.month]}。` : "")
  );

  // 平均から5%以上離れている月をまとめて挙げる
  const lows = monthlyIndex.filter((m) => m.index <= 0.95 && m.month !== lowest.month);
  const highs = monthlyIndex.filter((m) => m.index >= 1.05 && m.month !== highest.month);
  if (lows.length > 0) {
    findings.push(`${lows.map((m) => `${m.month}月`).join("・")}も平均を5%以上下回ります。`);
  }
  if (highs.length > 0) {
    findings.push(`${highs.map((m) => `${m.month}月`).join("・")}も平均を5%以上上回ります。`);
  }

  findings.push(
    swing >= 15
      ? `最も高い月と低い月の差は${swing.toFixed(1)}ポイントあり、季節変動が大きい医院です。閑散月に合わせた固定費では繁忙月を捌けず、繁忙月に合わせると閑散月の採算が悪化します。人員シフトとリコール送付時期の調整で平準化を検討してください。`
      : `最も高い月と低い月の差は${swing.toFixed(1)}ポイントで、季節変動は比較的小さい医院です。`
  );

  return { available: true, monthlyIndex, findings, swing, detrendedPoints };
}
