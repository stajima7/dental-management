/**
 * 改善額シミュレーション
 *
 * 現状値と目標値（医院設定の目標、無ければ業界ベンチマーク）のギャップを、
 * 月次の金額インパクトに換算する。「人件費率が高い」で終わらせず
 * 「月+64万円」まで落とすことで、提案の優先順位を金額で判断できるようにする。
 *
 * 設計方針:
 * - 目標を達成済みの項目は改善余地0とし、過大評価しない
 * - チェア稼働率のように理論上100%が不可能な指標は上限をキャップする
 * - 各ルールは独立に試算する。施策が重複する場合があるため合計は単純合算になる
 */
import { CHAIR_UTILIZATION_CEILING } from "./kpi-calculator";

export type Difficulty = "LOW" | "MEDIUM" | "HIGH";

export interface Opportunity {
  code: string;
  title: string;
  /** 現状の問題。数値を含めて具体的に */
  problem: string;
  /** 表示用の現状値 */
  current: string;
  /** 表示用の目標値 */
  target: string;
  /** 具体的な打ち手 */
  suggestion: string;
  /** 月次の金額インパクト（円） */
  monthlyImpact: number;
  difficulty: Difficulty;
}

/** 目標値。未設定の項目はベンチマークで代替する */
export interface TargetValues {
  selfPayRatio?: number | null;
  cancelRate?: number | null;
  laborCostRatio?: number | null;
  materialCostRatio?: number | null;
  maintenanceTransitionRate?: number | null;
  discontinuedRate?: number | null;
}

/** 目標値が未設定・0以下ならベンチマークを使う */
const goalOf = (target: number | null | undefined, benchmark: number) =>
  target != null && target > 0 ? target : benchmark;

export function simulateImprovements(
  kpi: Record<string, number>,
  target: TargetValues,
  profile: { avgTreatmentMinutes?: number | null }
): Opportunity[] {
  const ops: Opportunity[] = [];
  const v = (code: string) => kpi[code] ?? 0;

  const totalRevenue = v("totalRevenue");
  const perMinute = v("revenuePerChairMinute");
  const treatMin = profile.avgTreatmentMinutes ?? 45;
  if (totalRevenue <= 0) return ops;

  const pct = (n: number) => `${n.toFixed(1)}%`;

  // 1. チェア稼働率 — 空き枠を埋める（既にKPIとして算出済みの損失額をそのまま使う）
  const chairUtil = v("chairUtilization");
  const idleLoss = v("idleChairLoss");
  if (idleLoss > 0) {
    ops.push({
      code: "chairUtilization",
      title: "チェア稼働率の向上",
      problem: `チェア稼働率が${pct(chairUtil)}で、現実的な上限${CHAIR_UTILIZATION_CEILING}%まで${(CHAIR_UTILIZATION_CEILING - chairUtil).toFixed(1)}ポイントの余地があります。`,
      current: pct(chairUtil),
      target: `${CHAIR_UTILIZATION_CEILING}%`,
      suggestion: "空き枠にリコール対象患者を優先的に充当してください。キャンセル発生時に当日枠へ補充するルールを決め、待機患者リストを整備すると埋まりやすくなります。",
      monthlyImpact: idleLoss,
      difficulty: "MEDIUM",
    });
  }

  // 2. キャンセル率 — 減らした分だけチェアが埋まる
  const cancelRate = v("cancelRate");
  const cancelGoal = goalOf(target.cancelRate, 10);
  if (cancelRate > cancelGoal && perMinute > 0) {
    // 目標を上回る「超過分」であり、キャンセル総数ではない点が伝わる文言にする
    const reducibleCount = v("appointmentCount") * ((cancelRate - cancelGoal) / 100);
    ops.push({
      code: "cancelRate",
      title: "キャンセル率の低減",
      problem: `キャンセルが月${Math.round(v("cancelCount"))}件発生しており、キャンセル率${pct(cancelRate)}は目標${pct(cancelGoal)}を${(cancelRate - cancelGoal).toFixed(1)}ポイント上回っています。目標まで下げれば月${Math.round(reducibleCount)}件分のチェアが埋まります。`,
      current: pct(cancelRate),
      target: pct(cancelGoal),
      suggestion: "前日のリマインドをSMSと電話で二重化してください。キャンセル理由を記録して傾向を掴むと、対策の的が絞れます。",
      monthlyImpact: reducibleCount * treatMin * perMinute,
      difficulty: "LOW",
    });
  }

  // 3. 無断キャンセル — 事前連絡がなく枠を埋め直せないため損失が確定する
  const noShowRate = v("noShowRate");
  if (noShowRate > 2 && v("noShowLoss") > 0) {
    const reducible = v("noShowLoss") * ((noShowRate - 2) / noShowRate);
    ops.push({
      code: "noShowRate",
      title: "無断キャンセルの削減",
      problem: `無断キャンセル率が${pct(noShowRate)}で、目安2%を上回っています。事前連絡がないため枠を埋め直せず、損失が確定します。`,
      current: pct(noShowRate),
      target: "2.0%",
      suggestion: "初診時のSMS登録を必須化し、前日リマインドの到達率を上げてください。無断キャンセルが続く患者には次回予約時に確認の連絡を入れる運用が有効です。",
      monthlyImpact: reducible,
      difficulty: "LOW",
    });
  }

  // 4. 自費率 — 保険を減らさず自費を積み増す前提で試算する
  const selfPayRatio = v("selfPayRatio");
  const selfPayGoal = goalOf(target.selfPayRatio, 20);
  if (selfPayRatio < selfPayGoal && selfPayGoal < 100) {
    const selfPayRevenue = v("selfPayRevenue");
    const otherRevenue = totalRevenue - selfPayRevenue;
    // 自費以外の売上を維持したまま目標構成比に達するのに必要な自費売上
    const requiredSelfPay = (otherRevenue * selfPayGoal) / (100 - selfPayGoal);
    const gain = Math.max(0, requiredSelfPay - selfPayRevenue);
    if (gain > 0) {
      ops.push({
        code: "selfPayRatio",
        title: "自費率の向上",
        problem: `自費率が${pct(selfPayRatio)}で、目標${pct(selfPayGoal)}まで${(selfPayGoal - selfPayRatio).toFixed(1)}ポイント不足しています。`,
        current: pct(selfPayRatio),
        target: pct(selfPayGoal),
        suggestion: "補綴提案時のカウンセリング実施率を上げてください。TC（トリートメントコーディネーター）の配置日を増やし、選択肢の提示を標準化すると成約率が安定します。",
        monthlyImpact: gain,
        difficulty: "MEDIUM",
      });
    }
  }

  // 5. 人件費率 — 目標との差がそのまま利益改善になる
  const laborRatio = v("laborCostRatio");
  const laborGoal = goalOf(target.laborCostRatio, 25);
  if (laborRatio > laborGoal) {
    ops.push({
      code: "laborCostRatio",
      title: "人件費率の適正化",
      problem: `人件費率が${pct(laborRatio)}で、目標${pct(laborGoal)}を${(laborRatio - laborGoal).toFixed(1)}ポイント上回っています。`,
      current: pct(laborRatio),
      target: pct(laborGoal),
      suggestion: "人員を減らすのではなく、1人あたりの生産性を上げて売上を伸ばす方向で検討してください。DHのアポイント充填率とチェアタイムの配分を見直すのが先です。",
      monthlyImpact: (totalRevenue * (laborRatio - laborGoal)) / 100,
      difficulty: "HIGH",
    });
  }

  // 6. 材料費率
  const materialRatio = v("materialCostRatio");
  const materialGoal = goalOf(target.materialCostRatio, 8);
  if (materialRatio > materialGoal) {
    ops.push({
      code: "materialCostRatio",
      title: "材料費率の適正化",
      problem: `材料費率が${pct(materialRatio)}で、目標${pct(materialGoal)}を${(materialRatio - materialGoal).toFixed(1)}ポイント上回っています。`,
      current: pct(materialRatio),
      target: pct(materialGoal),
      suggestion: "仕入先の相見積もりと技工料の交渉を行ってください。在庫の廃棄ロスが混ざっている場合は発注点の見直しが先です。",
      monthlyImpact: (totalRevenue * (materialRatio - materialGoal)) / 100,
      difficulty: "MEDIUM",
    });
  }

  // 7. 返戻・査定減 — 請求できたはずの点数がそのまま金額になる
  const deductionRate = v("pointDeductionRate");
  if (deductionRate > 2) {
    const recoverable = v("insurancePoints") * ((deductionRate - 2) / 100) * 10;
    ops.push({
      code: "pointDeductionRate",
      title: "返戻・査定減の圧縮",
      problem: `返戻・査定減率が${pct(deductionRate)}で、目安2%を上回っています。1点あたり単価は${v("revenuePerPoint").toFixed(2)}円です。`,
      current: pct(deductionRate),
      target: "2.0%",
      suggestion: "返戻理由を分類し、上位3つに絞って算定要件を再確認してください。提出前のレセプト点検を担当者の目視から二重チェックに変えると効果が出やすい項目です。",
      monthlyImpact: recoverable,
      difficulty: "LOW",
    });
  }

  // 8. 残業比率 — 割増賃金の削減分を効果とする
  const overtimeRatio = v("overtimeRatio");
  const laborHours = v("laborHoursTotal");
  if (overtimeRatio > 10 && laborHours > 0) {
    const hourlyWage = v("laborCost") / laborHours;
    // 総労働時間のうち残業が占める割合を10%まで下げた場合の削減時間
    const excessHours = laborHours * ((overtimeRatio - 10) / (100 + overtimeRatio));
    ops.push({
      code: "overtimeRatio",
      title: "残業の削減",
      problem: `残業比率が${pct(overtimeRatio)}で、目安10%を上回っています。売上を残業でこなしている状態です。`,
      current: pct(overtimeRatio),
      target: "10.0%",
      suggestion: "終業間際の予約枠を短縮し、片付け・記録の時間を診療時間内に確保してください。特定の曜日に偏っている場合はシフトの組み替えが有効です。",
      // 残業には割増賃金(1.25倍)がかかるため、その分が削減効果になる
      monthlyImpact: excessHours * hourlyWage * 1.25,
      difficulty: "MEDIUM",
    });
  }

  // 9. 中断率 — 中断を防いだ分の売上が継続する
  const discontinuedRate = v("discontinuedRate");
  const discontinuedGoal = goalOf(target.discontinuedRate, 5);
  const uniquePatients = v("uniquePatientCount");
  if (discontinuedRate > discontinuedGoal && uniquePatients > 0) {
    // 目標を上回る「超過分」であり、中断者の総数ではない点が伝わる文言にする
    const retainedPatients = uniquePatients * ((discontinuedRate - discontinuedGoal) / 100);
    const totalDropouts = uniquePatients * (discontinuedRate / 100);
    ops.push({
      code: "discontinuedRate",
      title: "中断患者の抑制",
      problem: `月${Math.round(totalDropouts)}人が治療途中で離脱しており、中断率${pct(discontinuedRate)}は目標${pct(discontinuedGoal)}を上回っています。目標まで下げれば月${Math.round(retainedPatients)}人の離脱を防げます。`,
      current: pct(discontinuedRate),
      target: pct(discontinuedGoal),
      suggestion: "治療計画を初診時に文書で提示し、通院回数と費用の見通しを共有してください。中断が発生しやすい治療段階を特定し、その前後で連絡を入れる運用が効きます。",
      monthlyImpact: (retainedPatients * totalRevenue) / uniquePatients,
      difficulty: "MEDIUM",
    });
  }

  return ops.sort((a, b) => b.monthlyImpact - a.monthlyImpact);
}
