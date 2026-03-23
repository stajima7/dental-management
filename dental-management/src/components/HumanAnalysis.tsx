import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell, LineChart, Line,
} from 'recharts';
import type { MonthlyData, StaffCount, Equipment, FinancialBasic } from '../types';
import { calculateKPI, calculateFTE, formatCurrency, formatPercent } from '../utils/kpi';

interface Props {
  monthlyData: MonthlyData[];
  staffCount: StaffCount;
  equipment: Equipment;
  financialBasic: FinancialBasic;
  workDays: number;
}

const COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#8b5cf6', '#ec4899'];
const toNum = (v: number | ''): number => (v === '' ? 0 : v);

export default function HumanAnalysis({ monthlyData, staffCount, equipment, financialBasic, workDays }: Props) {
  const kpis = useMemo(() => {
    return monthlyData.map(d => calculateKPI(d, staffCount, equipment, financialBasic, workDays));
  }, [monthlyData, staffCount, equipment, financialBasic, workDays]);

  const fte = calculateFTE(staffCount);
  const latest = kpis.length > 0 ? kpis[kpis.length - 1] : null;

  const staffData = [
    { name: '歯科医師', fullTime: toNum(staffCount.dentistFullTime), partTime: toNum(staffCount.dentistPartTime), fte: fte.dentistFTE },
    { name: '歯科衛生士', fullTime: toNum(staffCount.hygienistFullTime), partTime: toNum(staffCount.hygienistPartTime), fte: fte.hygienistFTE },
    { name: '歯科助手', fullTime: toNum(staffCount.assistantFullTime), partTime: toNum(staffCount.assistantPartTime), fte: fte.assistantFTE },
    { name: '受付', fullTime: toNum(staffCount.receptionFullTime), partTime: toNum(staffCount.receptionPartTime), fte: fte.receptionFTE },
  ];

  const fteData = staffData.map(s => ({ name: s.name, FTE: s.fte }));

  const productivityData = latest ? [
    { name: 'Dr1人あたり', value: latest.revenuePerDentist },
    { name: 'DH1人あたり', value: latest.revenuePerHygienist },
    { name: 'ユニット1台あたり', value: latest.revenuePerUnit },
  ] : [];

  const laborCost = toNum(financialBasic.laborCost);
  const totalStaff = fte.totalFTE;
  const avgLaborPerFTE = totalStaff > 0 ? laborCost / totalStaff : 0;

  // 非常勤比率
  const totalFullTime = toNum(staffCount.dentistFullTime) + toNum(staffCount.hygienistFullTime) + toNum(staffCount.assistantFullTime) + toNum(staffCount.receptionFullTime);
  const totalPartTime = toNum(staffCount.dentistPartTime) + toNum(staffCount.hygienistPartTime) + toNum(staffCount.assistantPartTime) + toNum(staffCount.receptionPartTime);
  const partTimeRatio = (totalFullTime + totalPartTime) > 0 ? (totalPartTime / (totalFullTime + totalPartTime)) * 100 : 0;

  const compositionData = [
    { name: '常勤', value: totalFullTime },
    { name: '非常勤', value: totalPartTime },
  ];

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">ヒト分析（人材・生産性）</h2>
      </div>

      {/* 人員サマリーKPI */}
      <div className="kpi-grid">
        <div className="kpi-card neutral">
          <div className="kpi-label">総FTE</div>
          <div className="kpi-value">{fte.totalFTE.toFixed(1)}</div>
          <div className="kpi-sub">常勤換算</div>
        </div>
        <div className="kpi-card neutral">
          <div className="kpi-label">人件費率</div>
          <div className="kpi-value">{latest ? formatPercent(latest.laborCostRatio) : '-'}</div>
          <div className="kpi-sub">適正: 25%以下</div>
        </div>
        <div className="kpi-card neutral">
          <div className="kpi-label">FTE1人あたり人件費</div>
          <div className="kpi-value">{formatCurrency(avgLaborPerFTE)}</div>
          <div className="kpi-sub">月額</div>
        </div>
        <div className="kpi-card neutral">
          <div className="kpi-label">非常勤比率</div>
          <div className="kpi-value">{formatPercent(partTimeRatio)}</div>
          <div className="kpi-sub">全スタッフ中</div>
        </div>
      </div>

      <div className="charts-grid">
        {/* 職種別人数 */}
        <div className="card">
          <div className="card-title">職種別人数（常勤/非常勤）</div>
          <div className="chart-container">
            <ResponsiveContainer>
              <BarChart data={staffData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="fullTime" name="常勤" fill="#2563eb" stackId="a" />
                <Bar dataKey="partTime" name="非常勤" fill="#93c5fd" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* FTE */}
        <div className="card">
          <div className="card-title">職種別FTE（常勤換算）</div>
          <div className="chart-container">
            <ResponsiveContainer>
              <BarChart data={fteData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="FTE" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 雇用形態構成 */}
        <div className="card">
          <div className="card-title">雇用形態構成</div>
          <div className="chart-container">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={compositionData} cx="50%" cy="50%" outerRadius={100}
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                  {compositionData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 生産性 */}
        <div className="card">
          <div className="card-title">1人あたり生産性</div>
          <div className="chart-container">
            <ResponsiveContainer>
              <BarChart data={productivityData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={v => `${(v / 10000).toFixed(0)}万`} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={120} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Bar dataKey="value" fill="#16a34a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 人件費率推移 */}
        {kpis.length > 0 && (
          <div className="card">
            <div className="card-title">人件費率推移</div>
            <div className="chart-container">
              <ResponsiveContainer>
                <LineChart data={kpis}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="yearMonth" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 50]} tick={{ fontSize: 12 }} unit="%" />
                  <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />
                  <Line dataKey="laborCostRatio" name="人件費率" stroke="#dc2626" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Dr/DH生産性推移 */}
        {kpis.length > 0 && (
          <div className="card">
            <div className="card-title">Dr/DH1人あたり売上推移</div>
            <div className="chart-container">
              <ResponsiveContainer>
                <LineChart data={kpis}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="yearMonth" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={v => `${(v / 10000).toFixed(0)}万`} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                  <Legend />
                  <Line dataKey="revenuePerDentist" name="Dr1人あたり" stroke="#2563eb" strokeWidth={2} />
                  <Line dataKey="revenuePerHygienist" name="DH1人あたり" stroke="#16a34a" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* 改善提案 */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-title" style={{ marginBottom: 16 }}>💡 ヒトに関する改善提案</div>
        <div style={{ display: 'grid', gap: 12 }}>
          {partTimeRatio > 40 && (
            <div className="insight-card warning">
              <div className="insight-title">非常勤比率が高い</div>
              <div className="insight-description">非常勤比率 {partTimeRatio.toFixed(1)}% は高水準です。継続患者管理や教育体制に影響が出る可能性があります。</div>
              <div className="insight-suggestion">💡 常勤スタッフの採用を計画的に進め、非常勤依存度を下げましょう。</div>
            </div>
          )}
          {latest && latest.laborCostRatio > 30 && (
            <div className="insight-card warning">
              <div className="insight-title">人件費率が高止まり</div>
              <div className="insight-description">人件費率 {latest.laborCostRatio.toFixed(1)}% です。売上拡大による比率改善を優先してください。</div>
              <div className="insight-suggestion">💡 1人あたり生産性の向上（アポ枠最適化、自費提案力強化）で対応しましょう。</div>
            </div>
          )}
          {fte.hygienistFTE > 0 && latest && latest.revenuePerHygienist < 500000 && (
            <div className="insight-card warning">
              <div className="insight-title">DH数に対してSP/メンテ売上が少ない</div>
              <div className="insight-description">衛生士の稼働に見合う売上が出ていません。メンテ枠の拡大を検討してください。</div>
              <div className="insight-suggestion">💡 SP枠の見直し、メンテ移行率の改善、衛生士による自費メニュー提案を導入しましょう。</div>
            </div>
          )}
          {fte.assistantFTE < fte.dentistFTE * 0.8 && fte.dentistFTE > 0 && (
            <div className="insight-card warning">
              <div className="insight-title">Dr稼働に対してアシスタント配置が不足気味</div>
              <div className="insight-description">歯科医師FTE {fte.dentistFTE} に対してアシスタントFTE {fte.assistantFTE} です。</div>
              <div className="insight-suggestion">💡 アシスタントの増員またはシフト調整でDrの診療効率を上げましょう。</div>
            </div>
          )}
          {!staffCount.hasOfficeManager && fte.totalFTE >= 5 && (
            <div className="insight-card warning">
              <div className="insight-title">事務長不在</div>
              <div className="insight-description">スタッフ規模FTE {fte.totalFTE}名に対して事務長がいません。院長の管理負担が大きくなっている可能性があります。</div>
              <div className="insight-suggestion">💡 事務長の配置を検討し、院長は診療に集中できる体制を構築しましょう。</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
