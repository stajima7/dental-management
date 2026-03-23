import type { MonthlyKPI, AIInsight, StaffCount, Equipment, FinancialBasic, DepartmentProfitability, AccountingPL } from '../types';
export type { AIInsight } from '../types';
import { BENCHMARKS, calculateFTE } from './kpi';

const toNum = (v: number | ''): number => (v === '' ? 0 : v);

let insightIdCounter = 0;
const genId = () => `insight-${++insightIdCounter}`;

export const generateDiagnosis = (
  kpis: MonthlyKPI[],
  staff: StaffCount,
  equipment: Equipment,
  financial: FinancialBasic,
  deptProfitability?: DepartmentProfitability[],
  accountingPL?: AccountingPL,
): AIInsight[] => {
  if (kpis.length === 0) return [];

  const latest = kpis[kpis.length - 1];
  const prev = kpis.length > 1 ? kpis[kpis.length - 2] : null;
  const insights: AIInsight[] = [];
  const fte = calculateFTE(staff);
  const unitCount = toNum(equipment.unitCount) || 1;

  // === 売上分析 ===
  if (prev) {
    const revenueChange = ((latest.monthlyRevenue - prev.monthlyRevenue) / prev.monthlyRevenue) * 100;
    if (revenueChange > 5) {
      insights.push({
        id: genId(), category: 'positive', area: 'revenue',
        title: '売上が増加傾向',
        description: `前月比 ${revenueChange.toFixed(1)}% の売上増加です。この成長を維持するための施策を継続してください。`,
        suggestion: '成長要因を分析し、再現性のある施策として定着させましょう。',
        impact: 'high', difficulty: 'easy', priority: 5,
        cause: '新患数増加または自費成約率の向上が寄与している可能性があります。',
        expectedImpact: '成長率を維持すれば年間で約10-15%の売上増が見込めます。',
      });
    } else if (revenueChange < -5) {
      insights.push({
        id: genId(), category: 'warning', area: 'revenue',
        title: '売上が減少傾向',
        description: `前月比 ${revenueChange.toFixed(1)}% の売上減少です。原因の特定が急務です。`,
        suggestion: '患者数の減少か単価の低下か、要因を分解して対策を立てましょう。新患獲得施策やリコール強化を検討してください。',
        impact: 'high', difficulty: 'medium', priority: 1,
        cause: '季節変動、患者離脱、キャンセル増加、単価低下のいずれかが要因です。',
        expectedImpact: '早期に原因特定・対策を実施すれば、翌月には改善が見込めます。',
      });
    }
  }

  // === 自費率分析 ===
  if (latest.selfPayRatio < BENCHMARKS.selfPayRatio) {
    insights.push({
      id: genId(), category: 'warning', area: 'revenue',
      title: '自費率が業界平均を下回る',
      description: `自費率 ${latest.selfPayRatio.toFixed(1)}% は業界平均 ${BENCHMARKS.selfPayRatio}% を下回っています。自費売上の拡大余地があります。`,
      suggestion: '補綴カウンセリング体制の整備、自費メニュー表の作成、初診時の説明フローの見直しを行いましょう。',
      impact: 'high', difficulty: 'medium', priority: 2,
      cause: 'カウンセリング導線が不十分、または自費メニューの提示タイミングに課題がある可能性があります。',
      expectedImpact: '自費率を5%改善すると、月商ベースで約10-20万円の粗利改善が見込めます。',
    });
  } else if (latest.selfPayRatio > 35) {
    insights.push({
      id: genId(), category: 'positive', area: 'revenue',
      title: '自費率が高水準',
      description: `自費率 ${latest.selfPayRatio.toFixed(1)}% は業界平均を大きく上回る高水準です。`,
      suggestion: '自費率の維持に加え、自費患者のリピート率と満足度にも目を向けましょう。',
      impact: 'medium', difficulty: 'easy', priority: 8,
    });
  }

  // === 患者分析 ===
  if (latest.newPatients < BENCHMARKS.newPatientsMin) {
    insights.push({
      id: genId(), category: 'critical', area: 'patient',
      title: '新患数が不足',
      description: `新患数 ${latest.newPatients}人は、ユニット${unitCount}台規模の医院としては少ない水準です。`,
      suggestion: 'Web集客（SEO・MEO・リスティング広告）の強化、紹介カードの導入、地域連携の推進を検討してください。',
      impact: 'high', difficulty: 'medium', priority: 2,
      cause: '広告効果の低下、口コミ・紹介の不足、Web上の視認性が低い可能性があります。',
      expectedImpact: '新患を月5人増やすと、年間で約100-150万円の売上増が期待できます。',
    });
  }

  if (latest.returnRate < BENCHMARKS.returnRate) {
    insights.push({
      id: genId(), category: 'warning', area: 'patient',
      title: '再来率が低い',
      description: `再来率 ${latest.returnRate.toFixed(1)}% は目標 ${BENCHMARKS.returnRate}% を下回っています。`,
      suggestion: '次回予約の確実な取得、リコールシステムの強化、患者満足度の向上施策を実施しましょう。',
      impact: 'high', difficulty: 'easy', priority: 1,
      cause: '次回予約の取得率が低い、治療中断者のフォロー不足、患者体験に課題がある可能性があります。',
      expectedImpact: '再来率を5%改善すると、実患者ベースで月10-20人の来院増が見込めます。',
    });
  }

  if (latest.cancelRate > BENCHMARKS.cancelRate) {
    insights.push({
      id: genId(), category: 'warning', area: 'patient',
      title: 'キャンセル率が高い',
      description: `キャンセル率 ${latest.cancelRate.toFixed(1)}% は適正範囲 ${BENCHMARKS.cancelRate}% を超えています。`,
      suggestion: 'リマインド連絡の徹底、キャンセルポリシーの明確化、予約枠のオーバーブッキング戦略を検討してください。',
      impact: 'medium', difficulty: 'easy', priority: 3,
      cause: 'リマインド不足、予約のハードルが低い、患者の治療意欲低下が考えられます。',
      expectedImpact: 'キャンセル率を5%改善すると、月あたり15-20枠の稼働改善が見込めます。',
    });
  }

  if (latest.maintenanceTransitionRate < BENCHMARKS.maintenanceTransitionRate) {
    insights.push({
      id: genId(), category: 'warning', area: 'patient',
      title: 'メンテナンス移行率が低い',
      description: `メンテ移行率 ${latest.maintenanceTransitionRate.toFixed(1)}% は目標 ${BENCHMARKS.maintenanceTransitionRate}% に届いていません。`,
      suggestion: '治療完了時のメンテナンス移行説明を強化し、衛生士によるカウンセリングの導入を検討しましょう。',
      impact: 'high', difficulty: 'medium', priority: 3,
      cause: '治療完了時の導線が弱い、衛生士のカウンセリング時間が不足している可能性があります。',
      expectedImpact: 'メンテ移行率を5%上げると、安定収入の基盤が強化されます。',
    });
  }

  // === 人材・生産性分析 ===
  if (latest.laborCostRatio > BENCHMARKS.laborCostRatio + 5) {
    insights.push({
      id: genId(), category: 'critical', area: 'cost',
      title: '人件費率が高い',
      description: `人件費率 ${latest.laborCostRatio.toFixed(1)}% は適正範囲 ${BENCHMARKS.laborCostRatio}% を大幅に超えています。`,
      suggestion: '売上拡大による比率改善が最優先です。人員の適正配置、シフトの最適化も合わせて検討してください。',
      impact: 'high', difficulty: 'hard', priority: 1,
      cause: '売上に対して人員が過剰、または給与水準が高い可能性があります。',
      expectedImpact: '人件費率を5%改善すると、月あたり20-30万円の利益改善が見込めます。',
    });
  } else if (latest.laborCostRatio > BENCHMARKS.laborCostRatio) {
    insights.push({
      id: genId(), category: 'warning', area: 'cost',
      title: '人件費率がやや高め',
      description: `人件費率 ${latest.laborCostRatio.toFixed(1)}% は適正範囲 ${BENCHMARKS.laborCostRatio}% をやや上回っています。`,
      suggestion: '生産性の向上（1人あたり売上の改善）で対応することを推奨します。',
      impact: 'medium', difficulty: 'medium', priority: 4,
    });
  }

  if (latest.revenuePerUnit < BENCHMARKS.revenuePerUnit) {
    insights.push({
      id: genId(), category: 'warning', area: 'equipment',
      title: 'ユニット1台あたり売上が低い',
      description: `ユニット1台あたり売上 ${(latest.revenuePerUnit / 10000).toFixed(0)}万円 は業界平均 ${(BENCHMARKS.revenuePerUnit / 10000).toFixed(0)}万円 を下回っています。`,
      suggestion: '予約枠の稼働率を上げるため、予約枠の見直し、急患枠の設定、診療時間の延長を検討してください。',
      impact: 'high', difficulty: 'medium', priority: 2,
      cause: '予約稼働率が低い、診療効率が悪い、またはユニットが過剰な可能性があります。',
      expectedImpact: 'ユニット稼働率を10%改善すると、月15-20万円/台の売上増が見込めます。',
    });
  }

  // === DH生産性分析 ===
  if (fte.hygienistFTE > 0) {
    const dhRevenue = latest.revenuePerHygienist;
    if (dhRevenue > 0 && dhRevenue < 500000) {
      insights.push({
        id: genId(), category: 'warning', area: 'staff',
        title: 'DH1人あたり生産性が低い',
        description: `衛生士の人員に対して売上貢献が低い可能性があります。SP/メンテ枠の稼働を確認してください。`,
        suggestion: 'SP枠の増設、メンテナンス患者の増加、衛生士による自費予防メニューの導入を検討しましょう。',
        impact: 'high', difficulty: 'medium', priority: 3,
        cause: 'メンテ枠の稼働率が低い、DH配置時間にアイドルタイムがある可能性があります。',
        expectedImpact: 'DH生産性を月10万円/人改善すると、年間120万円/人の収益増が見込めます。',
      });
    }
  }

  // === 材料費分析 ===
  if (latest.materialCostRatio > BENCHMARKS.materialCostRatio + 2) {
    insights.push({
      id: genId(), category: 'warning', area: 'cost',
      title: '材料費率が高い',
      description: `材料費率 ${latest.materialCostRatio.toFixed(1)}% は適正値 ${BENCHMARKS.materialCostRatio}% を超えており、粗利を圧迫しています。`,
      suggestion: '仕入先の見直し、共同購入の検討、使用量の適正化を進めましょう。',
      impact: 'medium', difficulty: 'easy', priority: 4,
      cause: '仕入価格が高い、廃棄が多い、高額材料の使用頻度が高い可能性があります。',
      expectedImpact: '材料費率を2%改善すると、月8-15万円の粗利改善が見込めます。',
    });
  }

  // === 設備活用分析 ===
  if (equipment.hasCT && latest.selfPayRatio < 15) {
    insights.push({
      id: genId(), category: 'warning', area: 'equipment',
      title: 'CT導入済みだが活用率が低い可能性',
      description: 'CT設備があるにもかかわらず、自費率が低いです。CT撮影を活用したインプラント・自費補綴の提案が不十分な可能性があります。',
      suggestion: 'CT撮影による診断を積極的に行い、患者への説明資料として活用しましょう。',
      impact: 'medium', difficulty: 'medium', priority: 5,
    });
  }

  // === 部門別採算分析（配賦後）===
  if (deptProfitability && deptProfitability.length > 0) {
    deptProfitability.forEach(dept => {
      if (dept.revenue > 0 && dept.operatingProfitRate < 0) {
        const deptLabels: Record<string, string> = {
          insurance: '保険診療', selfPay: '自費診療',
          maintenance: 'メンテナンス', homeVisit: '訪問診療'
        };
        insights.push({
          id: genId(), category: 'critical', area: 'department',
          title: `${deptLabels[dept.department]}部門が赤字`,
          description: `${deptLabels[dept.department]}の配賦後営業利益率は ${dept.operatingProfitRate.toFixed(1)}% で赤字です。間接費配賦額 ${(dept.allocatedIndirectCost / 10000).toFixed(1)}万円が利益を圧迫しています。`,
          suggestion: `${deptLabels[dept.department]}部門の売上拡大またはコスト構造の見直しを検討してください。`,
          impact: 'high', difficulty: 'hard', priority: 2,
          cause: `直接原価に加え、間接費配賦後に採算が悪化しています。売上規模に対してコストドライバー量（患者数・ユニット使用等）が大きい可能性があります。`,
          expectedImpact: '部門の売上を10%伸ばすか、配賦基準を見直すことで黒字化の可能性があります。',
        });
      }

      if (dept.revenue > 0 && dept.grossProfitRate < 40) {
        const deptLabels: Record<string, string> = {
          insurance: '保険診療', selfPay: '自費診療',
          maintenance: 'メンテナンス', homeVisit: '訪問診療'
        };
        insights.push({
          id: genId(), category: 'warning', area: 'allocation',
          title: `${deptLabels[dept.department]}の粗利率が低い`,
          description: `${deptLabels[dept.department]}の粗利率 ${dept.grossProfitRate.toFixed(1)}% は低水準です。直接原価が売上に対して高い可能性があります。`,
          suggestion: '直接材料費・技工料の見直し、または単価改善を検討してください。',
          impact: 'medium', difficulty: 'medium', priority: 4,
          cause: '技工料や直接材料費が高い、または売上単価が低い可能性があります。',
        });
      }
    });
  }

  // === 会計ベース利益分析 ===
  if (accountingPL) {
    if (accountingPL.operatingProfitRate < 0) {
      insights.push({
        id: genId(), category: 'critical', area: 'cost',
        title: '営業赤字',
        description: `営業利益率 ${accountingPL.operatingProfitRate.toFixed(1)}% で赤字経営です。早急な対策が必要です。`,
        suggestion: '売上増加とコスト削減の両面から、損益分岐点を超えるための具体策を立案してください。',
        impact: 'high', difficulty: 'hard', priority: 1,
        cause: '売上に対して固定費（人件費・家賃等）が重い、または売上総利益率が低い可能性があります。',
        expectedImpact: '損益分岐点を超えれば、増収分がそのまま利益として残ります。',
      });
    } else if (accountingPL.operatingProfitRate < BENCHMARKS.operatingProfitRate) {
      insights.push({
        id: genId(), category: 'warning', area: 'cost',
        title: '営業利益率が低い',
        description: `営業利益率 ${accountingPL.operatingProfitRate.toFixed(1)}% は目標 ${BENCHMARKS.operatingProfitRate}% を下回っています。`,
        suggestion: '売上総利益率の改善（材料費・技工料の見直し）と、販管費の効率化を並行して進めましょう。',
        impact: 'high', difficulty: 'medium', priority: 3,
        cause: '粗利率の低下、または間接費の増加が利益を圧迫しています。',
      });
    }

    if (accountingPL.grossProfitRate < BENCHMARKS.grossProfitRate) {
      insights.push({
        id: genId(), category: 'warning', area: 'cost',
        title: '売上総利益率が低い',
        description: `売上総利益率 ${accountingPL.grossProfitRate.toFixed(1)}% は目標 ${BENCHMARKS.grossProfitRate}% を下回っています。`,
        suggestion: '技工料・材料費の適正化、自費単価の見直しを検討してください。',
        impact: 'high', difficulty: 'medium', priority: 3,
      });
    }
  }

  // === 総合コメント生成 ===
  if (insights.length === 0) {
    insights.push({
      id: genId(), category: 'positive', area: 'revenue',
      title: '経営状況は概ね良好',
      description: '主要KPIに大きな問題は見られません。現在の取り組みを継続しながら、さらなる改善点を探りましょう。',
      suggestion: '患者満足度調査やスタッフ面談を通じて、数字に表れない課題を発見することをお勧めします。',
      impact: 'low', difficulty: 'easy', priority: 10,
    });
  }

  // 優先度でソート
  insights.sort((a, b) => a.priority - b.priority);

  return insights;
};

export const generateSummaryComment = (kpis: MonthlyKPI[], insights: AIInsight[], accountingPL?: AccountingPL): string => {
  if (kpis.length === 0) return 'データを取り込むと、AI診断コメントが表示されます。';

  const latest = kpis[kpis.length - 1];
  const criticals = insights.filter(i => i.category === 'critical');
  const warnings = insights.filter(i => i.category === 'warning');
  const positives = insights.filter(i => i.category === 'positive');

  let comment = `【${latest.yearMonth} 経営診断サマリー】\n\n`;
  comment += `月商 ${(latest.monthlyRevenue / 10000).toFixed(0)}万円`;
  comment += `（保険 ${(latest.insuranceRevenue / 10000).toFixed(0)}万円 / 自費 ${(latest.selfPayRevenue / 10000).toFixed(0)}万円）\n`;
  comment += `自費率 ${latest.selfPayRatio.toFixed(1)}% ｜ 新患 ${latest.newPatients}人 ｜ 再来率 ${latest.returnRate.toFixed(1)}%\n`;

  if (accountingPL) {
    comment += `売上総利益率 ${accountingPL.grossProfitRate.toFixed(1)}% ｜ 営業利益率 ${accountingPL.operatingProfitRate.toFixed(1)}%\n`;
  }

  comment += '\n';

  if (criticals.length > 0) {
    comment += `🔴 緊急課題: ${criticals.length}件\n`;
    criticals.forEach(c => { comment += `  ・${c.title}\n`; });
    comment += '\n';
  }
  if (warnings.length > 0) {
    comment += `🟡 改善余地: ${warnings.length}件\n`;
    warnings.slice(0, 3).forEach(w => { comment += `  ・${w.title}\n`; });
    comment += '\n';
  }
  if (positives.length > 0) {
    comment += `🟢 良好ポイント: ${positives.length}件\n`;
    positives.forEach(p => { comment += `  ・${p.title}\n`; });
  }

  return comment;
};
