/**
 * 余力の判定（ボトルネック検知）
 *
 * 「忙しい」の中身は医院ごとに違う。チェアが足りないのか、診る人が足りないのか、
 * メンテの担い手が足りないのか。3つの資源の余力を同じものさしで並べ、
 * 先に限界へ来ているものを指す。
 *
 * 設計上の判断:
 *  - 「増やす」以外の答えも出す。3つとも余力があるのに売上が伸びていない医院に
 *    増設を勧めるのは誤り。その場合は集客・単価の改善を促す。
 *  - 断定しない。あくまで「どこが詰まっているか」を示し、判断は院長に委ねる。
 */

/** 稼働率がこの水準を超えたら「限界に近い」とみなす。
 *  準備・片付け・急患枠を考えると100%は達成できないため85%を上限の目安とする。
 *  （kpi-calculator の CHAIR_UTILIZATION_CEILING と同じ考え方） */
export const CAPACITY_CEILING = 85;
/** これを下回るなら余力が十分にあるとみなす */
export const CAPACITY_LOW = 60;

export type ResourceKey = "unit" | "dentist" | "hygienist";

export interface ResourceCapacity {
  key: ResourceKey;
  label: string;
  /** 稼働率(%)。100を超えることもある（超過勤務で回している状態） */
  utilization: number;
  /** 現在の数量（台・人） */
  current: number;
  unitLabel: string;
  /** 使用中の時間（分/月） */
  usedMinutes: number;
  /** 供給できる時間（分/月） */
  availableMinutes: number;
  status: "tight" | "moderate" | "loose";
  /** 何を根拠に算出したか。画面で説明するために持つ */
  basis: string;
}

export type BottleneckVerdict =
  | "unit"        // チェアが足りない
  | "dentist"     // 歯科医師が足りない
  | "hygienist"   // 衛生士が足りない
  | "multiple"    // 複数が同時に限界
  | "demand"      // 資源に余力があり、足りないのは患者数・単価
  | "unknown";    // 判定に必要なデータが無い

export interface CapacityResult {
  resources: ResourceCapacity[];
  verdict: BottleneckVerdict;
  /** 判定の要約（画面にそのまま出せる日本語） */
  headline: string;
  /** 何をすべきかの提案 */
  advice: string;
  /** 判定できなかった理由（verdict === "unknown" のとき） */
  missing?: string[];
}

export interface CapacityInput {
  /** 延患者数（月） */
  totalPatientCount: number;
  /** メンテナンスの延患者数（月）。取得できない場合は0 */
  maintenancePatientCount: number;
  profile: {
    unitCount: number;
    activeUnitCount: number;
    fulltimeDentistCount: number;
    parttimeDentistCount: number;
    fulltimeHygienistCount: number;
    parttimeHygienistCount: number;
    clinicDaysPerMonth: number;
    avgHoursPerDay?: number | null;
    avgTreatmentMinutes?: number | null;
    avgMaintenanceMinutes?: number | null;
  };
}

/** 非常勤は0.5人分として常勤換算する（kpi-calculator と同じ扱い） */
const fte = (full: number, part: number) => full + part * 0.5;

const statusOf = (u: number): ResourceCapacity["status"] =>
  u >= CAPACITY_CEILING ? "tight" : u >= CAPACITY_LOW ? "moderate" : "loose";

export function analyzeCapacity(input: CapacityInput): CapacityResult {
  const p = input.profile;
  const days = p.clinicDaysPerMonth || 0;
  const hours = p.avgHoursPerDay ?? 8;
  const treatMin = p.avgTreatmentMinutes ?? 45;
  const maintMin = p.avgMaintenanceMinutes ?? 45;

  const chairs = p.activeUnitCount || p.unitCount;
  const drFte = fte(p.fulltimeDentistCount, p.parttimeDentistCount);
  const dhFte = fte(p.fulltimeHygienistCount, p.parttimeHygienistCount);

  const missing: string[] = [];
  if (days <= 0) missing.push("月間診療日数");
  if (chairs <= 0) missing.push("ユニット台数");
  if (drFte <= 0) missing.push("歯科医師の人数");
  if (input.totalPatientCount <= 0) missing.push("延患者数");

  // メンテは衛生士、それ以外は歯科医師が担当するものとして時間を割り振る。
  // メンテ患者数が未登録の医院では、全患者を歯科医師側として扱う。
  const maintPatients = Math.max(0, Math.min(input.maintenancePatientCount, input.totalPatientCount));
  const treatPatients = Math.max(0, input.totalPatientCount - maintPatients);

  const perDayMinutes = days * hours * 60;

  const chairAvailable = chairs * perDayMinutes;
  const chairUsed = treatPatients * treatMin + maintPatients * maintMin;

  const drAvailable = drFte * perDayMinutes;
  const drUsed = treatPatients * treatMin;

  const dhAvailable = dhFte * perDayMinutes;
  const dhUsed = maintPatients * maintMin;

  const rate = (used: number, avail: number) => (avail > 0 ? (used / avail) * 100 : 0);

  const resources: ResourceCapacity[] = [
    {
      key: "unit", label: "ユニット", unitLabel: "台", current: chairs,
      usedMinutes: chairUsed, availableMinutes: chairAvailable,
      utilization: rate(chairUsed, chairAvailable),
      status: statusOf(rate(chairUsed, chairAvailable)),
      basis: `全患者${Math.round(input.totalPatientCount).toLocaleString()}人 × 診療時間 ÷ (${chairs}台 × ${days}日 × ${hours}時間)`,
    },
    {
      key: "dentist", label: "歯科医師", unitLabel: "人", current: drFte,
      usedMinutes: drUsed, availableMinutes: drAvailable,
      utilization: rate(drUsed, drAvailable),
      status: statusOf(rate(drUsed, drAvailable)),
      basis: `治療の患者${Math.round(treatPatients).toLocaleString()}人 × ${treatMin}分 ÷ (${drFte.toFixed(1)}人 × ${days}日 × ${hours}時間)`,
    },
    {
      key: "hygienist", label: "歯科衛生士", unitLabel: "人", current: dhFte,
      usedMinutes: dhUsed, availableMinutes: dhAvailable,
      utilization: rate(dhUsed, dhAvailable),
      status: statusOf(rate(dhUsed, dhAvailable)),
      basis: dhFte > 0
        ? `メンテの患者${Math.round(maintPatients).toLocaleString()}人 × ${maintMin}分 ÷ (${dhFte.toFixed(1)}人 × ${days}日 × ${hours}時間)`
        : "衛生士が登録されていません",
    },
  ];

  if (missing.length > 0) {
    return {
      resources, verdict: "unknown", missing,
      headline: "余力を判定するデータが足りません",
      advice: `医院設定と月次データのうち、${missing.join("・")}を登録すると判定できます。`,
    };
  }

  const tight = resources.filter((r) => r.status === "tight" && r.availableMinutes > 0);
  const byUtil = [...resources].filter((r) => r.availableMinutes > 0)
    .sort((a, b) => b.utilization - a.utilization);
  const top = byUtil[0];

  // 3つとも余力があるなら、足りないのは資源ではなく患者数・単価
  if (tight.length === 0 && top && top.utilization < CAPACITY_LOW) {
    return {
      resources, verdict: "demand",
      headline: "設備も人員も余力があります",
      advice: "いま増やしても空きが増えるだけです。新患の集客、リコールの取りこぼし、自費率の改善を先に検討してください。",
    };
  }

  if (tight.length >= 2) {
    return {
      resources, verdict: "multiple",
      headline: `${tight.map((r) => r.label).join("と")}が同時に限界に近づいています`,
      advice: "片方だけ増やしても詰まりが移るだけです。設備と人員をあわせて増やす前提で試算してください。",
    };
  }

  if (tight.length === 1) {
    const r = tight[0];
    const loose = resources.filter((x) => x.key !== r.key && x.status === "loose");
    const looseText = loose.length > 0 ? `${loose.map((x) => x.label).join("・")}には余力があります。` : "";
    const adviceByKey: Record<ResourceKey, string> = {
      unit: `${looseText}チェアの空きが不足しています。ユニットの増設を検討する時期ですが、台数によって手残りが変わるため増設シミュレーションで確認してください。`,
      dentist: `${looseText}院長または勤務医の診療枠が埋まっています。勤務医の採用、または診療時間の配分見直しを検討してください。`,
      hygienist: `${looseText}メンテナンスの担い手が不足しています。歯科衛生士の増員と、メンテナンス専用チェアの確保を検討してください。`,
    };
    return {
      resources, verdict: r.key,
      headline: `${r.label}が限界に近づいています（稼働 ${r.utilization.toFixed(0)}%）`,
      advice: adviceByKey[r.key],
    };
  }

  // 限界には達していないが、余力十分とも言えない状態
  return {
    resources, verdict: "demand",
    headline: top ? `いちばん詰まっているのは${top.label}です（稼働 ${top.utilization.toFixed(0)}%）` : "判定できません",
    advice: `まだ増設が必要な水準ではありません。${CAPACITY_CEILING}%を超えたら検討時期です。`,
  };
}
