import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend,
} from 'recharts';
import type { MonthlyData, StaffCount, Equipment, FinancialBasic } from '../types';
import { calculateKPI, formatCurrency, formatPercent, BENCHMARKS } from '../utils/kpi';

interface Props {
  monthlyData: MonthlyData[];
  staffCount: StaffCount;
  equipment: Equipment;
  financialBasic: FinancialBasic;
  workDays: number;
}

const toNum = (v: number | ''): number => (v === '' ? 0 : v);

export default function EquipmentAnalysis({ monthlyData, staffCount, equipment, financialBasic, workDays }: Props) {
  const kpis = useMemo(() => {
    return monthlyData.map(d => calculateKPI(d, staffCount, equipment, financialBasic, workDays));
  }, [monthlyData, staffCount, equipment, financialBasic, workDays]);

  const latest = kpis.length > 0 ? kpis[kpis.length - 1] : null;
  const unitCount = toNum(equipment.unitCount) || 1;
  const materialCost = toNum(financialBasic.materialCost);

  // ユニット稼働推計（予約件数 / (ユニット数 × 診療日数 × 1日あたり枠数)）
  const utilizationData = monthlyData.map((d, i) => {
    const maxSlots = unitCount * workDays * 6; // 1台6枠/日と仮定
    const utilization = maxSlots > 0 ? (d.appointmentCount / maxSlots) * 100 : 0;
    return {
      yearMonth: d.yearMonth,
      稼働率: Math.min(utilization, 100),
      revenuePerUnit: kpis[i]?.revenuePerUnit || 0,
    };
  });

  // 設備一覧
  const equipmentList = [
    { name: 'ユニット', count: `${unitCount}台`, status: true },
    { name: 'オペ室', count: equipment.hasOperationRoom ? 'あり' : 'なし', status: equipment.hasOperationRoom },
    { name: 'CT', count: equipment.hasCT ? 'あり' : 'なし', status: equipment.hasCT },
    { name: 'マイクロスコープ', count: equipment.hasMicroscope ? 'あり' : 'なし', status: equipment.hasMicroscope },
    { name: 'CAD/CAM', count: equipment.hasCADCAM ? 'あり' : 'なし', status: equipment.hasCADCAM },
    { name: '訪問診療', count: equipment.hasHomeVisit ? 'あり' : 'なし', status: equipment.hasHomeVisit },
  ];

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">モノ分析（設備・材料・診療資源）</h2>
      </div>

      {/* KPIカード */}
      <div className="kpi-grid">
        <div className="kpi-card neutral">
          <div className="kpi-label">ユニット台数</div>
          <div className="kpi-value">{unitCount}台</div>
        </div>
        <div className={`kpi-card ${latest && latest.revenuePerUnit >= BENCHMARKS.revenuePerUnit ? 'positive' : 'warning'}`}>
          <div className="kpi-label">ユニット1台あたり売上</div>
          <div className="kpi-value">{latest ? formatCurrency(latest.revenuePerUnit) : '-'}</div>
          <div className="kpi-sub">業界平均: {formatCurrency(BENCHMARKS.revenuePerUnit)}</div>
        </div>
        <div className="kpi-card neutral">
          <div className="kpi-label">材料費</div>
          <div className="kpi-value">{formatCurrency(materialCost)}</div>
          <div className="kpi-sub">月額</div>
        </div>
        <div className={`kpi-card ${latest && latest.materialCostRatio <= BENCHMARKS.materialCostRatio ? 'positive' : 'warning'}`}>
          <div className="kpi-label">材料費率</div>
          <div className="kpi-value">{latest ? formatPercent(latest.materialCostRatio) : '-'}</div>
          <div className="kpi-sub">適正: {BENCHMARKS.materialCostRatio}%以下</div>
        </div>
      </div>

      {/* 設備一覧 */}
      <div className="card">
        <div className="card-title" style={{ marginBottom: 16 }}>設備一覧</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          {equipmentList.map(eq => (
            <div key={eq.name} style={{
              padding: 16, borderRadius: 8, textAlign: 'center',
              background: eq.status ? '#f0fdf4' : '#f9fafb',
              border: `2px solid ${eq.status ? '#16a34a' : '#e5e7eb'}`,
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: eq.status ? '#16a34a' : '#9ca3af' }}>{eq.name}</div>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4, color: eq.status ? '#15803d' : '#d1d5db' }}>{eq.count}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="charts-grid">
        {/* ユニット稼働率推移 */}
        <div className="card">
          <div className="card-title">ユニット推定稼働率推移</div>
          <div className="chart-container">
            <ResponsiveContainer>
              <LineChart data={utilizationData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="yearMonth" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
                <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />
                <Line dataKey="稼働率" stroke="#8b5cf6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ユニット1台あたり売上推移 */}
        <div className="card">
          <div className="card-title">ユニット1台あたり売上推移</div>
          <div className="chart-container">
            <ResponsiveContainer>
              <BarChart data={kpis}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="yearMonth" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={v => `${(v / 10000).toFixed(0)}万`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Bar dataKey="revenuePerUnit" name="ユニット1台あたり" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 材料費率推移 */}
        <div className="card">
          <div className="card-title">材料費率推移</div>
          <div className="chart-container">
            <ResponsiveContainer>
              <LineChart data={kpis}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="yearMonth" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 20]} tick={{ fontSize: 12 }} unit="%" />
                <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />
                <Legend />
                <Line dataKey="materialCostRatio" name="材料費率" stroke="#d97706" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 1時間あたり売上推移 */}
        <div className="card">
          <div className="card-title">1時間あたり売上推移</div>
          <div className="chart-container">
            <ResponsiveContainer>
              <LineChart data={kpis}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="yearMonth" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={v => `${v.toLocaleString()}`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Line dataKey="revenuePerHour" name="時間単価" stroke="#2563eb" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 改善提案 */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-title" style={{ marginBottom: 16 }}>💡 モノに関する改善提案</div>
        <div style={{ display: 'grid', gap: 12 }}>
          {latest && latest.revenuePerUnit < BENCHMARKS.revenuePerUnit && (
            <div className="insight-card warning">
              <div className="insight-title">ユニット稼働が低い可能性</div>
              <div className="insight-description">ユニット1台あたり売上 {formatCurrency(latest.revenuePerUnit)} は業界平均を下回っています。</div>
              <div className="insight-suggestion">💡 予約枠の見直し、急患枠の設定、空き時間帯の活用を検討しましょう。</div>
            </div>
          )}
          {equipment.hasCT && latest && latest.selfPayRatio < 15 && (
            <div className="insight-card warning">
              <div className="insight-title">CT導入済みだが活用率が低い</div>
              <div className="insight-description">CT設備がありますが、自費率が低く、CT活用による自費提案が不十分な可能性があります。</div>
              <div className="insight-suggestion">💡 CT撮影を活用したインプラント・自費補綴の診断と提案を積極的に行いましょう。</div>
            </div>
          )}
          {latest && latest.materialCostRatio > BENCHMARKS.materialCostRatio + 2 && (
            <div className="insight-card warning">
              <div className="insight-title">材料費率が高く粗利を圧迫</div>
              <div className="insight-description">材料費率 {formatPercent(latest.materialCostRatio)} は適正値を超えています。</div>
              <div className="insight-suggestion">💡 仕入先の比較検討、共同購入、使用量の見直しを進めましょう。</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
