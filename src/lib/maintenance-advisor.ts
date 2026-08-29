/**
 * メンテナンス体制の提案
 *
 * 治療中心からメンテナンス中心へ移る時期は、多くの医院が通る転換点。
 * 患者構成の変化・衛生士の余力・リコールの歩留まりを組み合わせて、
 * 「メンテナンス専用チェアと衛生士の増員を検討する時期か」を判定する。
 *
 * メンテナンスは単価こそ高くないが継続的で読みやすい収入のため、
 * 単月の損得だけで判断すると増員が後回しになる。1年後の見通しも添える。
 */

import { CAPACITY_CEILING } from "./capacity";

export interface MaintenanceInput {
  /** 当月のメンテ延患者数と全体の延患者数 */
  maintenancePatientCount: number;
  totalPatientCount: number;
  /** メンテ売上（月） */
  maintenanceRevenue: number;
  /** 衛生士の稼働率(%)。capacity.ts の算出結果 */
  hygienistUtilization: number;
  /** 衛生士のFTE */
  hygienistFte: number;
  /** 衛生士が実際に使っている時間と供給できる時間（分/月）。
   *  増員しても埋まらない枠を売上に数えないために使う */
  hygienistUsedMinutes: number;
  hygienistAvailableMinutes: number;
  /** メンテ患者比率の推移（新しい順、%）。傾向の判定に使う */
  ratioTrend?: number[];
  /** リコールの歩留まり。未登録なら undefined */
  recall?: { notifiedCount: number; bookedCount: number; visitedCount: number; rebookedCount: number } | null;
  /** メンテ移行率(%) */
  maintenanceTransitionRate?: number;
  /** 衛生士1名あたりの月額人件費（円）。未設定なら損得は出さない */
  hygienistMonthlyCost?: number | null;
  /** 稼働条件（増員1名で何件こなせるかの算出に使う） */
  clinicDaysPerMonth: number;
  avgHoursPerDay: number;
  avgMaintenanceMinutes: number;
}

export interface MaintenanceSignal {
  key: string;
  label: string;
  /** 該当しているか */
  hit: boolean;
  detail: string;
}

export interface MaintenanceAdvice {
  signals: MaintenanceSignal[];
  /** 該当したシグナルの数 */
  hitCount: number;
  /** 増員を検討すべき状況か */
  recommend: boolean;
  headline: string;
  body: string;
  /** 衛生士を1名増やした場合の試算。人件費単価が無い場合は null */
  simulation: {
    additionalSlots: number;      // 月あたり増える対応枠（件）
    additionalRevenue: number;    // 増えるメンテ売上（円/月）
    additionalCost: number;       // 増える人件費（円/月）
    netEffect: number;            // 差引（円/月）
    revenuePerMaintenance: number; // メンテ1件あたり単価（円）
  } | null;
  /** 単価が無くて試算できない場合の案内 */
  simulationNote?: string;
}

export function adviseMaintenance(input: MaintenanceInput): MaintenanceAdvice {
  const ratio = input.totalPatientCount > 0
    ? (input.maintenancePatientCount / input.totalPatientCount) * 100
    : 0;

  // --- シグナルの判定 ---
  const signals: MaintenanceSignal[] = [];

  // 1. 患者構成：メンテが半数を超えた
  signals.push({
    key: "ratio",
    label: "メンテナンス患者が半数を超えている",
    hit: ratio >= 50,
    detail: `メンテ患者の割合は ${ratio.toFixed(1)}%（${Math.round(input.maintenancePatientCount).toLocaleString()}人 / ${Math.round(input.totalPatientCount).toLocaleString()}人）`,
  });

  // 2. 構成比が上がり続けている（3ヶ月）
  const t = input.ratioTrend?.filter((v) => Number.isFinite(v)) ?? [];
  const rising = t.length >= 3 && t.slice(0, 3).every((v, i, arr) => i === 0 || arr[i - 1] > v);
  signals.push({
    key: "trend",
    label: "メンテナンスの割合が増え続けている",
    hit: rising,
    detail: rising
      ? `直近3ヶ月で ${t[2].toFixed(1)}% → ${t[0].toFixed(1)}% と上昇`
      : t.length >= 3 ? "直近3ヶ月では一貫した上昇は見られません" : "判定に必要な月数が足りません",
  });

  // 3. 衛生士の余力：限界に近い
  const dhTight = input.hygienistUtilization >= CAPACITY_CEILING;
  signals.push({
    key: "capacity",
    label: "歯科衛生士の枠が埋まっている",
    hit: dhTight,
    detail: input.hygienistFte > 0
      ? `衛生士の稼働率 ${input.hygienistUtilization.toFixed(0)}%（限界の目安 ${CAPACITY_CEILING}%）`
      : "衛生士が登録されていません",
  });

  // 4. リコールの取りこぼし：通知しても予約に至らない
  const r = input.recall;
  const bookingRate = r && r.notifiedCount > 0 ? (r.bookedCount / r.notifiedCount) * 100 : null;
  signals.push({
    key: "recall",
    label: "リコールを予約につなげきれていない",
    hit: bookingRate != null && bookingRate < 80,
    detail: bookingRate != null
      ? `通知後の予約率 ${bookingRate.toFixed(0)}%（目安80%）`
      : "リコールのデータが未登録です",
  });

  // 5. メンテ移行率が目安に届かない
  const mt = input.maintenanceTransitionRate;
  signals.push({
    key: "transition",
    label: "治療後にメンテナンスへ移行できていない",
    hit: mt != null && mt > 0 && mt < 30,
    detail: mt != null && mt > 0
      ? `メンテ移行率 ${mt.toFixed(1)}%（目安30%）`
      : "メンテ移行率のデータが未登録です",
  });

  const hitCount = signals.filter((s) => s.hit).length;

  // --- 衛生士1名増員の試算 ---
  const perMaintenance = input.maintenancePatientCount > 0
    ? input.maintenanceRevenue / input.maintenancePatientCount
    : 0;

  let simulation: MaintenanceAdvice["simulation"] = null;
  let simulationNote: string | undefined;

  // 増員した枠が自動的に埋まるわけではない。埋まるのは「いまの体制で
  // さばききれていない分」までで、余力がある医院では新しい枠は空いたままになる。
  // ここを見落とすと、需要が無い医院にも増員を勧めてしまう。
  const comfortable = input.hygienistAvailableMinutes * (CAPACITY_CEILING / 100);
  const unmetMinutes = Math.max(0, input.hygienistUsedMinutes - comfortable);

  if (input.hygienistMonthlyCost == null || input.hygienistMonthlyCost <= 0) {
    simulationNote = "歯科衛生士の人件費単価が未設定のため、増員の損得を試算できません。医院設定から登録してください。";
  } else if (perMaintenance <= 0) {
    simulationNote = "メンテナンスの売上と患者数が登録されていないため、増員の試算ができません。";
  } else if (unmetMinutes <= 0) {
    const spare = Math.round((comfortable - input.hygienistUsedMinutes) / Math.max(1, input.avgMaintenanceMinutes));
    simulationNote = `いまの衛生士の枠にはまだ月${spare.toLocaleString()}件ほどの余裕があります。`
      + "増員しても新しい枠は埋まらないため、先にメンテナンス患者を増やすことをおすすめします。";
  } else {
    // 1名分の枠と、さばききれていない分の小さい方までしか売上にならない
    const oneHygienistMinutes = input.clinicDaysPerMonth * input.avgHoursPerDay * 60;
    const fillableMinutes = Math.min(oneHygienistMinutes, unmetMinutes);
    const additionalSlots = Math.floor(fillableMinutes / Math.max(1, input.avgMaintenanceMinutes));
    const additionalRevenue = additionalSlots * perMaintenance;
    simulation = {
      additionalSlots,
      additionalRevenue,
      additionalCost: input.hygienistMonthlyCost,
      netEffect: additionalRevenue - input.hygienistMonthlyCost,
      revenuePerMaintenance: perMaintenance,
    };
    if (fillableMinutes < oneHygienistMinutes) {
      simulationNote = "さばききれていない分だけを見込んでいます。1名分の枠をすべて埋めるには、"
        + "メンテナンス患者をさらに増やす必要があります。";
    }
  }

  // --- 総合判定 ---
  // 「枠が埋まっている」または「構成比が高く上昇中」を増員検討の条件とする。
  // 取りこぼし系のシグナルだけなら、増員より先に運用改善が効く。
  const capacityDriven = dhTight;
  const demandDriven = ratio >= 50 && rising;
  const recommend = capacityDriven || demandDriven;

  let headline: string;
  let body: string;

  if (recommend) {
    headline = "メンテナンス体制を広げる時期に来ています";
    body = capacityDriven
      ? "衛生士の枠が埋まっており、これ以上メンテナンス患者を受け入れる余地がありません。歯科衛生士の増員と、メンテナンス専用チェアの確保を検討してください。"
      : "メンテナンス患者の割合が増え続けています。いまは回せていても、この傾向が続くと近いうちに枠が足りなくなります。早めに採用の準備を始めてください。";
  } else if (hitCount > 0) {
    headline = "増員より先に、取りこぼしの改善が効きそうです";
    body = "衛生士の枠にはまだ余力があります。リコールの予約率やメンテナンスへの移行率を上げるほうが、増員より先に効果が出ます。";
  } else {
    headline = "いまのメンテナンス体制は足りています";
    body = "衛生士の枠に余力があり、患者構成にも大きな変化はありません。現状の体制を維持してください。";
  }

  return { signals, hitCount, recommend, headline, body, simulation, simulationNote };
}
