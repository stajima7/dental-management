import { useMemo } from 'react';
import type { MonthlyData, StaffCount, Equipment, FinancialBasic, DirectCost, IndirectCost, AllocationRule } from '../types';
import { calculateKPI } from '../utils/kpi';
import { generateDiagnosis } from '../utils/aiDiagnosis';
import { calculateAccountingPL, calculateDepartmentProfitability, createDefaultIndirectCost } from '../utils/accounting';

interface Props {
  monthlyData: MonthlyData[];
  staffCount: StaffCount;
  equipment: Equipment;
  financialBasic: FinancialBasic;
  directCosts: DirectCost[];
  indirectCosts: IndirectCost[];
  allocationRules: AllocationRule[];
  workDays: number;
}

const IMPACT_LABELS = { high: '高', medium: '中', low: '低' };
const DIFFICULTY_LABELS = { easy: '容易', medium: '普通', hard: '難' };
const AREA_LABELS: Record<string, string> = {
  revenue: '売上', patient: '患者', staff: '人材', cost: 'コスト',
  equipment: '設備', department: '部門', allocation: '配賦',
};
const AREA_ICONS: Record<string, string> = {
  revenue: '💰', patient: '👥', staff: '🧑‍⚕️', cost: '📊',
  equipment: '🏥', department: '📋', allocation: '⚖️',
};

export default function ActionPlan({
  monthlyData, staffCount, equipment, financialBasic,
  directCosts, indirectCosts, allocationRules, workDays,
}: Props) {
  const insights = useMemo(() => {
    if (monthlyData.length === 0) return [];
    const kpis = monthlyData.map(d => calculateKPI(d, staffCount, equipment, financialBasic, workDays));
    const latestData = monthlyData[monthlyData.length - 1];
    const ic = indirectCosts.find(ic => ic.yearMonth === latestData.yearMonth)
      || createDefaultIndirectCost(latestData.yearMonth, financialBasic);
    const deptProfit = calculateDepartmentProfitability(latestData, directCosts, ic, allocationRules);
    const pl = calculateAccountingPL(latestData, directCosts, ic, financialBasic);
    return generateDiagnosis(kpis, staffCount, equipment, financialBasic, deptProfit, pl);
  }, [monthlyData, staffCount, equipment, financialBasic, directCosts, indirectCosts, allocationRules, workDays]);

  if (insights.length === 0) {
    return (
      <div>
        <div className="section-header">
          <h2 className="section-title">改善アクション</h2>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon">🎯</div>
          <div className="empty-state-title">データがありません</div>
          <div className="empty-state-text">データを取り込むと改善アクションが表示されます</div>
        </div>
      </div>
    );
  }

  const topActions = insights.slice(0, 5);
  const criticals = insights.filter(i => i.category === 'critical');
  const warnings = insights.filter(i => i.category === 'warning');
  const positives = insights.filter(i => i.category === 'positive');

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">改善アクション</h2>
      </div>

      {/* サマリー */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ textAlign: 'center', borderTop: '4px solid #dc2626' }}>
          <div style={{ fontSize: 36, fontWeight: 800, color: '#dc2626' }}>{criticals.length}</div>
          <div style={{ fontSize: 14, color: '#6b7280' }}>緊急課題</div>
        </div>
        <div className="card" style={{ textAlign: 'center', borderTop: '4px solid #d97706' }}>
          <div style={{ fontSize: 36, fontWeight: 800, color: '#d97706' }}>{warnings.length}</div>
          <div style={{ fontSize: 14, color: '#6b7280' }}>改善余地</div>
        </div>
        <div className="card" style={{ textAlign: 'center', borderTop: '4px solid #16a34a' }}>
          <div style={{ fontSize: 36, fontWeight: 800, color: '#16a34a' }}>{positives.length}</div>
          <div style={{ fontSize: 14, color: '#6b7280' }}>良好ポイント</div>
        </div>
      </div>

      {/* 優先アクション */}
      <div className="card">
        <div className="card-title" style={{ marginBottom: 16 }}>🎯 優先課題 TOP{topActions.length}</div>
        {topActions.map((action, i) => (
          <div key={action.id} className="action-card">
            <div className={`action-priority ${i === 0 ? 'p1' : i < 3 ? 'p2' : 'p3'}`}>
              {i + 1}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                {AREA_ICONS[action.area] || '📌'} {action.title}
              </div>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>{action.description}</div>
              {action.cause && (
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                  🔍 原因仮説: {action.cause}
                </div>
              )}
              <div style={{ fontSize: 13, color: '#374151' }}>💡 {action.suggestion}</div>
              {action.expectedImpact && (
                <div style={{ fontSize: 12, color: '#2563eb', marginTop: 4 }}>
                  📈 {action.expectedImpact}
                </div>
              )}
            </div>
            <span className={`badge badge-${action.impact}`}>
              {IMPACT_LABELS[action.impact]}
            </span>
            <span className={`badge ${action.difficulty === 'easy' ? 'badge-easy' : action.difficulty === 'hard' ? 'badge-hard' : 'badge-medium'}`}>
              {DIFFICULTY_LABELS[action.difficulty]}
            </span>
          </div>
        ))}
      </div>

      {/* 今月のToDoリスト */}
      <div className="card">
        <div className="card-title" style={{ marginBottom: 16 }}>📋 今月やるべきこと</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {topActions.slice(0, 3).map((action, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              padding: 12, background: '#f9fafb', borderRadius: 8,
            }}>
              <input type="checkbox" style={{ marginTop: 3, width: 18, height: 18 }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{action.suggestion}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                  {AREA_LABELS[action.area] || action.area} | インパクト: {IMPACT_LABELS[action.impact]}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 来月チェックすべき指標 */}
      <div className="card">
        <div className="card-title" style={{ marginBottom: 16 }}>📈 来月チェックすべき指標</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {insights.filter(i => i.category !== 'positive').slice(0, 4).map((insight, i) => (
            <div key={i} style={{
              padding: 16, background: '#f9fafb', borderRadius: 8,
              borderLeft: '3px solid var(--primary)',
            }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{insight.title}</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                改善されているか確認
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 全課題一覧 */}
      <div className="card">
        <div className="card-title" style={{ marginBottom: 16 }}>全課題一覧（{insights.length}件）</div>
        <div className="data-preview">
          <table>
            <thead>
              <tr>
                <th>優先</th>
                <th>状態</th>
                <th>領域</th>
                <th>課題</th>
                <th>インパクト</th>
                <th>難易度</th>
              </tr>
            </thead>
            <tbody>
              {insights.map((insight, i) => (
                <tr key={insight.id}>
                  <td style={{ fontWeight: 700 }}>{i + 1}</td>
                  <td>
                    <span style={{
                      display: 'inline-block', width: 12, height: 12, borderRadius: '50%',
                      background: insight.category === 'critical' ? '#dc2626' : insight.category === 'warning' ? '#d97706' : '#16a34a',
                    }} />
                  </td>
                  <td>{AREA_LABELS[insight.area] || insight.area}</td>
                  <td>{insight.title}</td>
                  <td><span className={`badge badge-${insight.impact}`}>{IMPACT_LABELS[insight.impact]}</span></td>
                  <td>
                    <span className={`badge ${insight.difficulty === 'easy' ? 'badge-easy' : insight.difficulty === 'hard' ? 'badge-hard' : 'badge-medium'}`}>
                      {DIFFICULTY_LABELS[insight.difficulty]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
