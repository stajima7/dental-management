/**
 * 増設シミュレーション
 *
 * ユニット・歯科衛生士・勤務医を増やしたときに、売上・経費・税引後の手残りが
 * どう変わるかを試算する。台数を増やせば売上は伸びても手残りが減ることがあり、
 * その「谷」を自院の数字で示すことが目的。
 *
 * 設計方針:
 *  - 一般論の数値を埋め込まない。1台あたり売上・1人あたり売上は実績から推計し、
 *    医院ごとの設定で上書きできるようにする。
 *  - 結論を出さない。選択肢ごとの見通しを並べ、判断は院長に委ねる。
 *  - 谷を「やめる理由」にしない。何台まで進めば回復するかも併せて示す。
 */

import { calculateTax, TaxResult } from "./tax";

export interface ExpansionBase {
  /** 現在のユニット台数（稼働ベース） */
  unitCount: number;
  /** 年間の社会保険診療報酬（円） */
  insuranceRevenue: number;
  /** 年間の保険外収入（円） */
  privateRevenue: number;
  /** 年間の経費合計（円） */
  totalExpense: number;
  /** 年間の人件費（円）。増員時の上乗せの基準に使う */
  laborCost: number;
}

export interface ExpansionAssumption {
  /** 基準台数。ここまでは1台あたり売上が落ちないとみなす */
  baseUnitCount: number;
  /** 基準台数までの1台あたり年間売上（円） */
  revenuePerUnitBase: number;
  /** 基準台数を超えた分の1台あたり年間売上（円） */
  revenuePerUnitMarginal: number;
  /** 保険：自費の比率（保険の割合 0〜1） */
  insuranceShare: number;
  /** 職種別の年間人件費（円/人） */
  costPerHygienist: number;
  costPerAssistant: number;
  costPerDentist: number;
  /** 概算経費の特例の要件 */
  useSpecialExpense: boolean;
  insuranceRevenueCap: number;
  totalRevenueCap: number;
  /** ユニット1台の増設にかかる初期費用（円） */
  unitInvestmentCost: number;
}

export interface ExpansionPlan {
  key: string;
  label: string;
  /** 増やすもの */
  addUnits: number;
  addHygienists: number;
  addAssistants: number;
  addDentists: number;
  unitCountAfter: number;
  /** 年間の見通し */
  revenue: number;
  expense: number;
  tax: TaxResult;
  afterTax: number;
  /** 現状からの差（円/年） */
  revenueDiff: number;
  afterTaxDiff: number;
  /** 初期費用（円） */
  investment: number;
  /** 手残りの増加で初期費用を回収できる月数。増えない場合は null */
  paybackMonths: number | null;
  /** 特例が外れるなど、注意すべき点 */
  warning?: string;
}

/** 台数からその規模で必要となるスタッフ数の目安を出す。
 *  資料の「台数に応じてDH・受付・助手が増える」を数式にしたもの。
 *  医院ごとに実態は異なるため、あくまで増設時の上乗せ分の推計に使う。 */
function staffNeedFor(units: number) {
  return {
    // ユニット1台につき衛生士0.7人、助手0.5人を目安とする
    hygienists: units * 0.7,
    assistants: units * 0.5,
  };
}

/** 台数から年間売上を求める。基準台数までと、それ以降で1台あたりの伸びが変わる */
export function revenueForUnits(units: number, a: ExpansionAssumption): number {
  const base = Math.min(units, a.baseUnitCount);
  const extra = Math.max(0, units - a.baseUnitCount);
  return base * a.revenuePerUnitBase + extra * a.revenuePerUnitMarginal;
}

/** 逓減の既定値。基準台数を超えた分の1台あたり売上は、基準までの8割とみなす。
 *  （資料の2,300万→1,800万＝約78%に近い水準） */
const MARGINAL_RATIO = 0.8;

/** 実績から前提値を推計する。設定があればそちらを優先する */
export function inferAssumption(
  base: ExpansionBase,
  saved: Partial<ExpansionAssumption> & { baseUnitCount?: number },
  staffCost: { hygienist?: number | null; assistant?: number | null; dentist?: number | null }
): ExpansionAssumption {
  const totalRevenue = base.insuranceRevenue + base.privateRevenue;
  const baseUnitCount = saved.baseUnitCount ?? 3;

  // 単純に「総売上 ÷ 台数」で割ると、逓減を織り込んだ計算式に入れたときに
  // 現在の台数での売上が実績と合わなくなる。台数別のグラフで現状の点がずれるため、
  // 「現在の台数を計算式に入れると実績どおりになる」ように基準値を逆算する。
  const divisor =
    Math.min(base.unitCount, baseUnitCount) +
    Math.max(0, base.unitCount - baseUnitCount) * MARGINAL_RATIO;
  const perUnitBase = divisor > 0 ? totalRevenue / divisor : 0;

  return {
    baseUnitCount,
    revenuePerUnitBase: saved.revenuePerUnitBase ?? perUnitBase,
    revenuePerUnitMarginal: saved.revenuePerUnitMarginal ?? perUnitBase * MARGINAL_RATIO,
    insuranceShare: totalRevenue > 0 ? base.insuranceRevenue / totalRevenue : 0.7,
    // 人件費の単価が未設定なら概算（年収ベース）を置く。画面で必ず注記する
    costPerHygienist: (staffCost.hygienist ?? 380_000) * 12,
    costPerAssistant: (staffCost.assistant ?? 260_000) * 12,
    costPerDentist: (staffCost.dentist ?? 800_000) * 12,
    useSpecialExpense: saved.useSpecialExpense ?? true,
    insuranceRevenueCap: saved.insuranceRevenueCap ?? 50_000_000,
    totalRevenueCap: saved.totalRevenueCap ?? 70_000_000,
    unitInvestmentCost: saved.unitInvestmentCost ?? 3_000_000,
  };
}

function evaluate(
  key: string, label: string,
  add: { units: number; hygienists: number; assistants: number; dentists: number },
  base: ExpansionBase, a: ExpansionAssumption, current: { afterTax: number; revenue: number }
): ExpansionPlan {
  const unitCountAfter = base.unitCount + add.units;

  // 売上：台数が増えた分だけ伸びる（人だけ増やす案では台数は変わらないため、
  // 既存の枠がさらに埋まる分として、1台あたり売上の一部が乗ると考える）
  let revenue: number;
  if (add.units > 0) {
    revenue = revenueForUnits(unitCountAfter, a);
  } else {
    // 人を増やしても台数が増えなければ、増えるのは稼働の密度。
    // 過大に見込まないよう、1台あたり売上の3割を1人あたりの上乗せ上限とする
    const perPerson = a.revenuePerUnitMarginal * 0.3;
    revenue = current.revenue + (add.hygienists + add.dentists) * perPerson;
  }

  // 経費：増員分の人件費を上乗せする
  const addLabor =
    add.hygienists * a.costPerHygienist +
    add.assistants * a.costPerAssistant +
    add.dentists * a.costPerDentist;
  const expense = base.totalExpense + addLabor;

  const insuranceRevenue = revenue * a.insuranceShare;
  const privateRevenue = revenue - insuranceRevenue;

  const tax = calculateTax({
    insuranceRevenue, privateRevenue, actualExpense: expense,
    useSpecialExpense: a.useSpecialExpense,
    insuranceRevenueCap: a.insuranceRevenueCap,
    totalRevenueCap: a.totalRevenueCap,
  });

  const afterTaxDiff = tax.afterTax - current.afterTax;
  const investment = add.units * a.unitInvestmentCost;
  const paybackMonths = afterTaxDiff > 0 && investment > 0
    ? Math.ceil(investment / (afterTaxDiff / 12))
    : null;

  return {
    key, label,
    addUnits: add.units, addHygienists: add.hygienists,
    addAssistants: add.assistants, addDentists: add.dentists,
    unitCountAfter,
    revenue, expense, tax, afterTax: tax.afterTax,
    revenueDiff: revenue - current.revenue,
    afterTaxDiff, investment, paybackMonths,
    warning: !tax.specialExpenseApplied && tax.specialExpenseReason
      ? `概算経費の特例が使えなくなります（${tax.specialExpenseReason}）`
      : undefined,
  };
}

export interface ExpansionResult {
  current: ExpansionPlan;
  plans: ExpansionPlan[];
  /** 台数ごとの手残りの推移（谷がどこにあるかを示す） */
  curve: { units: number; revenue: number; afterTax: number; specialExpense: boolean }[];
  /** 谷を抜けて現状の手残りを上回る台数。見つからなければ null */
  recoveryUnits: number | null;
  assumption: ExpansionAssumption;
}

export function simulateExpansion(base: ExpansionBase, a: ExpansionAssumption): ExpansionResult {
  const currentRevenue = base.insuranceRevenue + base.privateRevenue;
  const currentTax = calculateTax({
    insuranceRevenue: base.insuranceRevenue,
    privateRevenue: base.privateRevenue,
    actualExpense: base.totalExpense,
    useSpecialExpense: a.useSpecialExpense,
    insuranceRevenueCap: a.insuranceRevenueCap,
    totalRevenueCap: a.totalRevenueCap,
  });

  const current: ExpansionPlan = {
    key: "current", label: "現状のまま",
    addUnits: 0, addHygienists: 0, addAssistants: 0, addDentists: 0,
    unitCountAfter: base.unitCount,
    revenue: currentRevenue, expense: base.totalExpense,
    tax: currentTax, afterTax: currentTax.afterTax,
    revenueDiff: 0, afterTaxDiff: 0, investment: 0, paybackMonths: null,
  };
  const ref = { afterTax: currentTax.afterTax, revenue: currentRevenue };

  // ユニットを1台増やす場合、その規模で必要になるスタッフも併せて増やす
  const needNow = staffNeedFor(base.unitCount);
  const needAfter = staffNeedFor(base.unitCount + 1);
  const addDh = Math.max(0, Math.round((needAfter.hygienists - needNow.hygienists) * 10) / 10);
  const addAs = Math.max(0, Math.round((needAfter.assistants - needNow.assistants) * 10) / 10);

  const plans: ExpansionPlan[] = [
    evaluate("unit", "ユニットを1台増やす",
      { units: 1, hygienists: addDh, assistants: addAs, dentists: 0 }, base, a, ref),
    evaluate("hygienist", "歯科衛生士を1名増やす",
      { units: 0, hygienists: 1, assistants: 0, dentists: 0 }, base, a, ref),
    evaluate("dentist", "勤務医を1名増やす",
      { units: 0, hygienists: 0, assistants: 0, dentists: 1 }, base, a, ref),
    evaluate("unit_dentist", "ユニット1台と勤務医1名",
      { units: 1, hygienists: addDh, assistants: addAs, dentists: 1 }, base, a, ref),
  ];

  // 台数ごとの推移（現状から+4台まで）。谷の位置と回復点を示す。
  // 減らす方向は検討の対象ではないうえ、いまの固定費のまま台数だけ減らした
  // 数字は実態とかけ離れるため、現状より下は出さない。
  const curve: ExpansionResult["curve"] = [];
  for (let u = base.unitCount; u <= base.unitCount + 4; u++) {
    const rev = revenueForUnits(u, a);
    const need = staffNeedFor(u);
    const needBase = staffNeedFor(base.unitCount);
    const laborDiff =
      Math.max(0, need.hygienists - needBase.hygienists) * a.costPerHygienist +
      Math.max(0, need.assistants - needBase.assistants) * a.costPerAssistant;
    // 台数を減らす方向では人件費も減るとみなす
    const laborBack =
      Math.max(0, needBase.hygienists - need.hygienists) * a.costPerHygienist +
      Math.max(0, needBase.assistants - need.assistants) * a.costPerAssistant;
    const exp = base.totalExpense + laborDiff - laborBack;
    const t = calculateTax({
      insuranceRevenue: rev * a.insuranceShare,
      privateRevenue: rev * (1 - a.insuranceShare),
      actualExpense: exp,
      useSpecialExpense: a.useSpecialExpense,
      insuranceRevenueCap: a.insuranceRevenueCap,
      totalRevenueCap: a.totalRevenueCap,
    });
    curve.push({ units: u, revenue: rev, afterTax: t.afterTax, specialExpense: t.specialExpenseApplied });
  }

  // 現状より台数が多く、かつ手残りが現状を上回る最初の台数
  const recovery = curve.find((c) => c.units > base.unitCount && c.afterTax > currentTax.afterTax);

  return { current, plans, curve, recoveryUnits: recovery?.units ?? null, assumption: a };
}
