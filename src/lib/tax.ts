/**
 * 税額の概算
 *
 * ユニットを増やしたときの「税引後の手残り」を出すために使う。
 * 売上が伸びても手残りが減る「谷」は、人件費の段差だけでなく
 * 概算経費の特例から外れることで生じるため、税の計算が欠かせない。
 *
 * ⚠️ この計算は判断の目安であり、正確な税額ではない。
 *    - 所得控除（基礎控除・social保険料控除・扶養など）は考慮していない
 *    - 個人事業税・国民健康保険料は含めていない
 *    - 医療法人の場合は法人税・役員報酬の設計で大きく変わる
 *    画面には必ず「目安」と明示し、税理士への確認を促すこと。
 *
 * ⚠️ 税率・要件は改正される。速算表はここに定数として持つが、
 *    特例の金額要件は医院ごとの設定（ExpansionSetting）から渡す。
 */

/** 租税特別措置法26条（社会保険診療報酬の所得計算の特例）の概算経費率。
 *  社会保険診療報酬の金額帯ごとに「率」と「加算額」が決まっている。 */
const SPECIAL_EXPENSE_TABLE: { upTo: number; rate: number; add: number }[] = [
  { upTo: 25_000_000, rate: 0.72, add: 0 },
  { upTo: 30_000_000, rate: 0.70, add: 500_000 },
  { upTo: 40_000_000, rate: 0.62, add: 2_900_000 },
  { upTo: 50_000_000, rate: 0.57, add: 4_900_000 },
];

/** 所得税の速算表（課税所得に対する税率と控除額） */
const INCOME_TAX_TABLE: { upTo: number; rate: number; deduct: number }[] = [
  { upTo: 1_950_000, rate: 0.05, deduct: 0 },
  { upTo: 3_300_000, rate: 0.10, deduct: 97_500 },
  { upTo: 6_950_000, rate: 0.20, deduct: 427_500 },
  { upTo: 9_000_000, rate: 0.23, deduct: 636_000 },
  { upTo: 18_000_000, rate: 0.33, deduct: 1_536_000 },
  { upTo: 40_000_000, rate: 0.40, deduct: 2_796_000 },
  { upTo: Infinity, rate: 0.45, deduct: 4_796_000 },
];

/** 復興特別所得税（所得税額に対して2.1%） */
const RECONSTRUCTION_RATE = 0.021;
/** 住民税（所得割）の概算 */
const RESIDENT_TAX_RATE = 0.10;

export interface TaxInput {
  /** 社会保険診療報酬（年・円） */
  insuranceRevenue: number;
  /** 自費など保険外の収入（年・円） */
  privateRevenue: number;
  /** 実際にかかった経費の合計（年・円）。院長の人件費は含めない */
  actualExpense: number;
  /** 概算経費の特例を判定に含めるか */
  useSpecialExpense: boolean;
  /** 特例の要件：社会保険診療報酬の上限 */
  insuranceRevenueCap: number;
  /** 特例の要件：医業収入合計の上限 */
  totalRevenueCap: number;
}

export interface TaxResult {
  totalRevenue: number;
  /** 経費として認められる額（特例が使えるならその方が有利なら特例額） */
  deductibleExpense: number;
  /** 特例を適用したか */
  specialExpenseApplied: boolean;
  /** 特例が使えなかった理由 */
  specialExpenseReason?: string;
  /** 課税対象となる所得（概算経費を適用した後の、税務上の所得） */
  taxableIncome: number;
  /** 実際の利益（収入 − 実際にかかった経費）。手残りの計算はこちらを使う */
  actualProfit: number;
  incomeTax: number;
  residentTax: number;
  totalTax: number;
  /** 税引後の手残り＝実際の利益 − 税額 */
  afterTax: number;
  /** 実効税率(%)。実際の利益に対する税の割合 */
  effectiveRate: number;
}

/** 概算経費（措置法26条）の額。要件を満たさない場合は null */
function calcSpecialExpense(insuranceRevenue: number): number | null {
  const row = SPECIAL_EXPENSE_TABLE.find((r) => insuranceRevenue <= r.upTo);
  if (!row) return null; // 表の範囲を超える＝5,000万円超で適用不可
  return insuranceRevenue * row.rate + row.add;
}

function calcIncomeTax(taxable: number): number {
  if (taxable <= 0) return 0;
  const row = INCOME_TAX_TABLE.find((r) => taxable <= r.upTo)!;
  const base = taxable * row.rate - row.deduct;
  return Math.max(0, base) * (1 + RECONSTRUCTION_RATE);
}

export function calculateTax(input: TaxInput): TaxResult {
  const totalRevenue = input.insuranceRevenue + input.privateRevenue;

  // --- 経費：実額と概算経費の有利な方を採る ---
  let deductibleExpense = input.actualExpense;
  let specialExpenseApplied = false;
  let specialExpenseReason: string | undefined;

  if (!input.useSpecialExpense) {
    specialExpenseReason = "特例を使わない設定になっています";
  } else if (input.insuranceRevenue > input.insuranceRevenueCap) {
    specialExpenseReason = `社会保険診療報酬が上限（${(input.insuranceRevenueCap / 10000).toLocaleString()}万円）を超えています`;
  } else if (totalRevenue > input.totalRevenueCap) {
    specialExpenseReason = `医業収入の合計が上限（${(input.totalRevenueCap / 10000).toLocaleString()}万円）を超えています`;
  } else {
    const special = calcSpecialExpense(input.insuranceRevenue);
    if (special == null) {
      specialExpenseReason = "社会保険診療報酬が概算経費の適用範囲を超えています";
    } else {
      // 特例は社会保険診療分の経費に適用し、保険外は実額のまま。
      // 保険診療分の実額経費は「収入の比率で按分」して推計する。
      const insuranceShare = totalRevenue > 0 ? input.insuranceRevenue / totalRevenue : 0;
      const actualInsuranceExpense = input.actualExpense * insuranceShare;
      const actualPrivateExpense = input.actualExpense - actualInsuranceExpense;
      const withSpecial = special + actualPrivateExpense;
      if (withSpecial > input.actualExpense) {
        deductibleExpense = withSpecial;
        specialExpenseApplied = true;
      } else {
        specialExpenseReason = "実額の経費のほうが大きいため、特例を適用しても有利になりません";
      }
    }
  }

  const taxableIncome = Math.max(0, totalRevenue - deductibleExpense);
  const incomeTax = calcIncomeTax(taxableIncome);
  const residentTax = taxableIncome * RESIDENT_TAX_RATE;
  const totalTax = incomeTax + residentTax;

  // 概算経費はあくまで税務上の計算であり、実際に出ていくお金ではない。
  // 手元に残る額は「実際の利益 − 税額」で、特例はここでは税額を下げる形で効く。
  // 課税所得から税を引くと、特例が使えなくなったときに手残りが増えて見えてしまう。
  const actualProfit = totalRevenue - input.actualExpense;

  return {
    totalRevenue,
    deductibleExpense,
    specialExpenseApplied,
    specialExpenseReason,
    taxableIncome,
    actualProfit,
    incomeTax,
    residentTax,
    totalTax,
    afterTax: actualProfit - totalTax,
    effectiveRate: actualProfit > 0 ? (totalTax / actualProfit) * 100 : 0,
  };
}
