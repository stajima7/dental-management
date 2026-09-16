/**
 * 担当者別（歯科医師・歯科衛生士）の分析
 *
 * 医院全体の「Dr1人あたり売上」は売上÷人数の平均で、誰がどれだけ売上を
 * 生んでいるかの差は見えない。担当者ごとの売上と勤務時間から、
 * 時間単価などを出して同じ職種の中で比べる。
 *
 * 比べる基準は2つ。
 *   1. 院内の同じ職種の「自分以外の」平均 … 診療方針が同じ医院の中なので、最も公平な比較。
 *      自分を含めた平均と比べると、同じ職種が2〜3人しかいない歯科医院では
 *      勤務時間の長い人に平均が引き寄せられ、差が埋もれてしまう
 *   2. 人件費倍率 … 売上が人件費の何倍か。人件費率の目安25%の裏返しで4倍を目安にする
 * 一般的な時間単価の目安も示すが、自費・訪問の比率で大きく変わるため参考にとどめる。
 *
 * 画面に依存しない計算だけを置く（APIと画面の双方から使うため）。
 */

export type PractitionerRole = "DENTIST" | "HYGIENIST";

export const PRACTITIONER_ROLES: PractitionerRole[] = ["DENTIST", "HYGIENIST"];

export const ROLE_LABELS: Record<PractitionerRole, string> = {
  DENTIST: "歯科医師",
  HYGIENIST: "歯科衛生士",
};

export const EMPLOYMENT_LABELS: Record<string, string> = {
  FULLTIME: "常勤",
  PARTTIME: "非常勤",
};

/**
 * 時間単価の一般的な目安（円/時）。
 * 歯科医師は月300万円前後・衛生士は月100万円前後を、月160〜200時間の勤務で割った水準。
 * 医院の方針で大きく変わるため、良し悪しの判定には使わず参考として表示する。
 */
export const HOURLY_REVENUE_GUIDE: Record<PractitionerRole, { min: number; max: number }> = {
  DENTIST: { min: 15000, max: 25000 },
  HYGIENIST: { min: 6000, max: 9000 },
};

/** 人件費倍率の目安。人件費率の目安（25%）の裏返しで、売上が人件費の4倍 */
export const LABOR_MULTIPLE_TARGET = 4;
/** これを下回ると、売上に対して人件費が重い */
export const LABOR_MULTIPLE_LOW = 3;

/** 自分以外の平均との差がこの割合を超えたら「高い」「低い」とみなす */
export const AVERAGE_BAND = 0.15;

export interface PractitionerInput {
  id: string;
  name: string;
  role: PractitionerRole;
  employmentType: string;
  isDirector: boolean;
  insuranceRevenue: number;
  selfPayRevenue: number;
  workHours: number;
  patientCount: number;
}

export type Verdict = "high" | "average" | "low" | "nodata";

export interface PractitionerMetrics extends PractitionerInput {
  totalRevenue: number;
  /** 自費率（%） */
  selfPayRatio: number | null;
  /** 時間単価（円/時） */
  hourlyRevenue: number | null;
  /** 患者1人あたり売上（円） */
  revenuePerPatient: number | null;
  /** 1時間あたりの担当患者数 */
  patientsPerHour: number | null;
  /** 売上が人件費の何倍か。院長・人件費未設定のときは null */
  laborMultiple: number | null;
  /** 同じ職種の自分以外の担当者の時間単価（勤務時間で重み付け）。比べる相手がいないときは null */
  othersHourly: number | null;
  /** 時間単価が、同じ職種の自分以外の平均の何倍か。比べる相手がいないときは null */
  vsOthers: number | null;
  verdict: Verdict;
  comments: string[];
}

export interface RoleSummary {
  role: PractitionerRole;
  /** 実績が入っている人数 */
  count: number;
  totalRevenue: number;
  selfPayRevenue: number;
  totalHours: number;
  totalPatients: number;
  /** 職種全体の時間単価（売上合計÷勤務時間合計）。人ごとの単純平均ではない */
  hourlyRevenue: number | null;
  selfPayRatio: number | null;
  revenuePerPatient: number | null;
  revenuePerPerson: number | null;
}

/** 割り算。分母が0や数でない場合は null（画面に「NaN」「∞」を出さないため） */
export function safeDiv(num: number, den: number): number | null {
  if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return null;
  const v = num / den;
  return Number.isFinite(v) ? v : null;
}

/**
 * 職種ごとの1時間あたり人件費。
 * 登録されているのは常勤1名あたりの月額なので、医院の標準的な月間勤務時間で割る。
 * 非常勤でも勤務時間で比べれば公平になる。
 */
export function hourlyLaborCost(monthlyCost: number | null | undefined, standardMonthlyHours: number): number | null {
  if (monthlyCost == null || monthlyCost <= 0) return null;
  return safeDiv(monthlyCost, standardMonthlyHours);
}

function hasData(p: PractitionerInput): boolean {
  return p.insuranceRevenue > 0 || p.selfPayRevenue > 0 || p.workHours > 0 || p.patientCount > 0;
}

export function summarizeRole(role: PractitionerRole, people: PractitionerInput[]): RoleSummary {
  const members = people.filter((p) => p.role === role && hasData(p));
  const sum = (f: (p: PractitionerInput) => number) => members.reduce((s, p) => s + (Number.isFinite(f(p)) ? f(p) : 0), 0);
  const totalRevenue = sum((p) => p.insuranceRevenue + p.selfPayRevenue);
  const selfPayRevenue = sum((p) => p.selfPayRevenue);
  const totalHours = sum((p) => p.workHours);
  const totalPatients = sum((p) => p.patientCount);
  const ratio = safeDiv(selfPayRevenue, totalRevenue);
  return {
    role,
    count: members.length,
    totalRevenue,
    selfPayRevenue,
    totalHours,
    totalPatients,
    hourlyRevenue: safeDiv(totalRevenue, totalHours),
    selfPayRatio: ratio == null ? null : ratio * 100,
    revenuePerPatient: safeDiv(totalRevenue, totalPatients),
    revenuePerPerson: members.length > 0 ? totalRevenue / members.length : null,
  };
}

/** 文章中で呼ぶときの敬称。表では氏名のみ、文章では敬称を付ける */
export function withHonorific(name: string, role: PractitionerRole): string {
  return `${name}${role === "DENTIST" ? "先生" : "さん"}`;
}

const yen = (v: number) =>
  v >= 10000 ? `${(v / 10000).toFixed(1)}万円` : `${Math.round(v).toLocaleString()}円`;

export function analyzePractitioners(
  people: PractitionerInput[],
  /** 職種ごとの1時間あたり人件費（未設定なら入れない） */
  hourlyCostByRole: Partial<Record<PractitionerRole, number | null>> = {}
): { people: PractitionerMetrics[]; summaries: Record<PractitionerRole, RoleSummary> } {
  const summaries = {
    DENTIST: summarizeRole("DENTIST", people),
    HYGIENIST: summarizeRole("HYGIENIST", people),
  };

  const metrics = people.map((p): PractitionerMetrics => {
    const totalRevenue = p.insuranceRevenue + p.selfPayRevenue;
    const roleLabel = ROLE_LABELS[p.role];
    const ratio = safeDiv(p.selfPayRevenue, totalRevenue);
    const selfPayRatio = ratio == null ? null : ratio * 100;
    const hourlyRevenue = safeDiv(totalRevenue, p.workHours);

    const hourlyCost = hourlyCostByRole[p.role];
    const laborMultiple = !p.isDirector && hourlyRevenue != null && hourlyCost
      ? safeDiv(hourlyRevenue, hourlyCost)
      : null;

    // 同じ職種の自分以外の人と比べる（実績が入っている人だけ）
    const others = summarizeRole(p.role, people.filter((o) => o.id !== p.id));
    const othersHourly = others.count > 0 ? others.hourlyRevenue : null;
    const vsOthers = hourlyRevenue != null && othersHourly ? safeDiv(hourlyRevenue, othersHourly) : null;

    const comments: string[] = [];
    let verdict: Verdict = "nodata";

    if (!hasData(p)) {
      comments.push("この月の実績が入力されていません");
    } else if (hourlyRevenue == null) {
      comments.push("勤務時間が未入力のため、時間単価を出せません");
    } else if (vsOthers == null || othersHourly == null) {
      verdict = "average";
    } else if (vsOthers >= 1 + AVERAGE_BAND) {
      verdict = "high";
      comments.push(`時間単価は、他の${roleLabel}の平均（${yen(othersHourly)}）の${vsOthers.toFixed(2)}倍です`);
    } else if (vsOthers <= 1 - AVERAGE_BAND) {
      verdict = "low";
      comments.push(`時間単価が、他の${roleLabel}の平均（${yen(othersHourly)}）を${Math.round((1 - vsOthers) * 100)}%下回っています`);
    } else {
      verdict = "average";
    }

    // 自費率が他の人の平均の半分に満たない場合は、自費の説明の機会を逃している可能性がある
    if (
      selfPayRatio != null && others.count > 0 && others.selfPayRatio != null &&
      others.selfPayRatio >= 5 && selfPayRatio < others.selfPayRatio / 2
    ) {
      comments.push(`自費率が${selfPayRatio.toFixed(1)}%で、他の${roleLabel}の平均（${others.selfPayRatio.toFixed(1)}%）の半分に届いていません`);
    }

    if (laborMultiple != null) {
      if (laborMultiple < LABOR_MULTIPLE_LOW) {
        comments.push(`売上が人件費の${laborMultiple.toFixed(1)}倍にとどまっています（目安${LABOR_MULTIPLE_TARGET}倍）`);
      } else if (laborMultiple >= LABOR_MULTIPLE_TARGET && verdict !== "high") {
        comments.push(`売上が人件費の${laborMultiple.toFixed(1)}倍あり、目安（${LABOR_MULTIPLE_TARGET}倍）を満たしています`);
      }
    }

    return {
      ...p,
      totalRevenue,
      selfPayRatio,
      hourlyRevenue,
      revenuePerPatient: safeDiv(totalRevenue, p.patientCount),
      patientsPerHour: safeDiv(p.patientCount, p.workHours),
      laborMultiple,
      othersHourly,
      vsOthers,
      verdict,
      comments,
    };
  });

  return { people: metrics, summaries };
}

export type CoverageStatus = "ok" | "low" | "over" | "nodata";

/**
 * 担当者の売上合計が、医院全体の月商をどれだけ説明できているか。
 * 大きく下回るなら担当者の登録漏れ、100%を超えるなら同じ売上を二重に数えている可能性がある。
 */
export function revenueCoverage(practitionerRevenue: number, clinicRevenue: number): { ratio: number | null; status: CoverageStatus } {
  const r = safeDiv(practitionerRevenue, clinicRevenue);
  if (r == null || practitionerRevenue <= 0) return { ratio: null, status: "nodata" };
  const pct = r * 100;
  if (pct > 105) return { ratio: pct, status: "over" };
  if (pct < 90) return { ratio: pct, status: "low" };
  return { ratio: pct, status: "ok" };
}

/**
 * その月のポイントを、専門知識が無くても読める文章で最大4つ挙げる。
 * 数字を並べるだけでは「何を見ればいいか」が分からないため。
 */
export function buildHighlights(
  people: PractitionerMetrics[],
  summaries: Record<PractitionerRole, RoleSummary>,
  coverage: { ratio: number | null; status: CoverageStatus }
): string[] {
  const out: string[] = [];

  for (const role of PRACTITIONER_ROLES) {
    const s = summaries[role];
    if (s.count === 0 || s.hourlyRevenue == null) continue;
    const guide = HOURLY_REVENUE_GUIDE[role];
    const label = ROLE_LABELS[role];
    const pos = s.hourlyRevenue < guide.min ? "一般的な目安を下回っています"
      : s.hourlyRevenue > guide.max ? "一般的な目安を上回っています"
      : "一般的な目安の範囲内です";
    out.push(`${label}全体の時間単価は${yen(s.hourlyRevenue)}で、${pos}（目安 ${yen(guide.min)}〜${yen(guide.max)}）。`);

    // 同じ職種に2人以上いるときだけ、最も高い人と低い人の差を示す
    const ranked = people
      .filter((p) => p.role === role && p.hourlyRevenue != null)
      .sort((a, b) => (b.hourlyRevenue ?? 0) - (a.hourlyRevenue ?? 0));
    if (ranked.length >= 2) {
      const top = ranked[0];
      const bottom = ranked[ranked.length - 1];
      const gap = safeDiv(top.hourlyRevenue ?? 0, bottom.hourlyRevenue ?? 0);
      if (gap != null && gap >= 1.3) {
        out.push(`${label}の時間単価は、${withHonorific(top.name, role)}（${yen(top.hourlyRevenue!)}）と${withHonorific(bottom.name, role)}（${yen(bottom.hourlyRevenue!)}）で${gap.toFixed(1)}倍の差があります。診療内容や予約の入れ方の違いを確認すると改善の糸口になります。`);
      }
    }
  }

  if (coverage.status === "low") {
    out.push(`担当者の売上合計が医院の月商の${coverage.ratio!.toFixed(0)}%しかありません。登録していない担当者や、入力漏れがないか確認してください。`);
  } else if (coverage.status === "over") {
    out.push(`担当者の売上合計が医院の月商を上回っています（${coverage.ratio!.toFixed(0)}%）。同じ診療の売上を歯科医師と衛生士の双方に計上していないか確認してください。`);
  }

  return out.slice(0, 4);
}
