import { useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, ComposedChart, Area,
} from 'recharts';
import type { MonthlyData, StaffCount, Equipment, FinancialBasic, DirectCost, IndirectCost, AllocationRule, MonthlyTargets } from '../types';
import { calculateKPI, formatCurrency, formatPercent, BENCHMARKS } from '../utils/kpi';
import { generateDiagnosis, generateSummaryComment, type AIInsight } from '../utils/aiDiagnosis';
import { calculateAccountingPL, calculateDepartmentProfitability, createDefaultIndirectCost } from '../utils/accounting';

interface Props {
  monthlyData: MonthlyData[];
  staffCount: StaffCount;
  equipment: Equipment;
  financialBasic: FinancialBasic;
  directCosts: DirectCost[];
  indirectCosts: IndirectCost[];
  allocationRules: AllocationRule[];
  targets: MonthlyTargets;
  workDays: number;
}

const COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#8b5cf6', '#ec4899'];

const KPICard = ({ label, value, sub, status, change, target }: {
  label: string; value: string; sub?: string;
  status: 'positive' | 'warning' | 'critical' | 'neutral';
  change?: { value: number; label: string };
  target?: string;
}) => (
  <div className={`kpi-card ${status}`}>
    <div className="kpi-label">{label}</div>
    <div className="kpi-value">{value}</div>
    {sub && <div className="kpi-sub">{sub}</div>}
    {target && <div className="kpi-sub" style={{ color: '#2563eb' }}>目標: {target}</div>}
    {change && (
      <div className={`kpi-change ${change.value >= 0 ? 'up' : 'down'}`}>
        {change.value >= 0 ? '↑' : '↓'} {Math.abs(change.value).toFixed(1)}% {change.label}
      </div>
    )}
  </div>
);

export default function Dashboard({
  monthlyData, staffCount, equipment, financialBasic,
  directCosts, indirectCosts, allocationRules, targets, workDays,
}: Props) {
  const kpis = useMemo(() => {
    return monthlyData.map(d => calculateKPI(d, staffCount, equipment, financialBasic, workDays));
  }, [monthlyData, staffCount, equipment, financialBasic, workDays]);

  const latestPL = useMemo(() => {
    if (monthlyData.length === 0) return undefined;
    const d = monthlyData[monthlyData.length - 1];
    const ic = indirectCosts.find(ic => ic.yearMonth === d.yearMonth)
      || createDefaultIndirectCost(d.yearMonth, financialBasic);
    return calculateAccountingPL(d, directCosts, ic, financialBasic);
  }, [monthlyData, directCosts, indirectCosts, financialBasic]);

  const latestDeptProfit = useMemo(() => {
    if (monthlyData.length === 0) return [];
    const d = monthlyData[monthlyData.length - 1];
    const ic = indirectCosts.find(ic => ic.yearMonth === d.yearMonth)
      || createDefaultIndirectCost(d.yearMonth, financialBasic);
    return calculateDepartmentProfitability(d, directCosts, ic, allocationRules);
  }, [monthlyData, directCosts, indirectCosts, allocationRules, financialBasic]);

  const insights = useMemo(() => {
    return generateDiagnosis(kpis, staffCount, equipment, financialBasic, latestDeptProfit, latestPL);
  }, [kpis, staffCount, equipment, financialBasic, latestDeptProfit, latestPL]);

  const summaryComment = useMemo(() => {
    return generateSummaryComment(kpis, insights, latestPL);
  }, [kpis, insights, latestPL]);

  if (monthlyData.length === 0) {
    return (
      <div>
        <div className="section-header">
          <h2 className="section-title">経営ダッシュボード</h2>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <div className="empty-state-title">データがありません</div>
          <div className="empty-state-text">「データ取込」からCSVファイルを取り込むか、サンプルデータをお試しください</div>
        </div>
      </div>
    );
  }

  const latest = kpis[kpis.length - 1];
  const prev = kpis.length > 1 ? kpis[kpis.length - 2] : null;

  // 前年同月
  const prevYear = kpis.find(k => {
    const [y, m] = latest.yearMonth.split('-').map(Number);
    return k.yearMonth === `${y - 1}-${String(m).padStart(2, '0')}`;
  });

  const getChange = (current: number, previous: number | undefined) => {
    if (previous === undefined || previous === 0) return undefined;
    return { value: ((current - previous) / previous) * 100, label: '前月比' };
  };

  const getStatus = (value: number, benchmark: number, higherIsBetter: boolean): 'positive' | 'warning' | 'critical' | 'neutral' => {
    if (higherIsBetter) {
      if (value >= benchmark) return 'positive';
      if (value >= benchmark * 0.8) return 'warning';
      return 'critical';
    } else {
      if (value <= benchmark) return 'positive';
      if (value <= benchmark * 1.2) return 'warning';
      return 'critical';
    }
  };

  const toNum = (v: number | ''): number => (v === '' ? 0 : v);

  // 売上構成比データ
  const pieData = [
    { name: '保険売上', value: latest.insuranceRevenue },
    { name: '自費売上', value: latest.selfPayRevenue },
  ];

  // コスト構成
  const costData = [
    { name: '人件費', value: toNum(financialBasic.laborCost) },
    { name: '材料費', value: toNum(financialBasic.materialCost) },
    { name: '家賃', value: toNum(financialBasic.rent) },
    { name: '広告費', value: toNum(financialBasic.advertisingCost) },
    { name: '借入返済', value: toNum(financialBasic.loanRepayment) },
  ].filter(d => d.value > 0);

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">経営ダッシュボード</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 14, color: '#6b7280' }}>{latest.yearMonth}</span>
          {prevYear && (
            <span style={{ fontSize: 12, color: '#9ca3af' }}>
              前年同月比: {((latest.monthlyRevenue - prevYear.monthlyRevenue) / prevYear.monthlyRevenue * 100).toFixed(1)}%
            </span>
          )}
        </div>
      </div>

      {/* AI診断サマリー */}
      <div className="diagnosis-summary">{summaryComment}</div>

      {/* 主要KPI */}
      <div className="kpi-grid">
        <KPICard
          label="月商"
          value={formatCurrency(latest.monthlyRevenue)}
          status="neutral"
          change={prev ? getChange(latest.monthlyRevenue, prev.monthlyRevenue) : undefined}
          target={targets.monthlyRevenue > 0 ? formatCurrency(targets.monthlyRevenue) : undefined}
        />
        <KPICard
          label="自費率"
          value={formatPercent(latest.selfPayRatio)}
          sub={`業界平均: ${BENCHMARKS.selfPayRatio}%`}
          status={getStatus(latest.selfPayRatio, targets.selfPayRatio || BENCHMARKS.selfPayRatio, true)}
          change={prev ? getChange(latest.selfPayRatio, prev.selfPayRatio) : undefined}
        />
        <KPICard
          label="新患数"
          value={`${latest.newPatients}人`}
          sub={`目安: ${BENCHMARKS.newPatientsMin}人以上`}
          status={getStatus(latest.newPatients, targets.newPatients || BENCHMARKS.newPatientsMin, true)}
          change={prev ? getChange(latest.newPatients, prev.newPatients) : undefined}
        />
        <KPICard
          label="再来率"
          value={formatPercent(latest.returnRate)}
          sub={`目標: ${targets.returnRate || BENCHMARKS.returnRate}%`}
          status={getStatus(latest.returnRate, targets.returnRate || BENCHMARKS.returnRate, true)}
          change={prev ? getChange(latest.returnRate, prev.returnRate) : undefined}
        />
        <KPICard
          label="ユニット1台あたり売上"
          value={formatCurrency(latest.revenuePerUnit)}
          sub={`業界平均: ${formatCurrency(BENCHMARKS.revenuePerUnit)}`}
          status={getStatus(latest.revenuePerUnit, BENCHMARKS.revenuePerUnit, true)}
        />
        <KPICard
          label="Dr1人あたり売上"
          value={formatCurrency(latest.revenuePerDentist)}
          status="neutral"
        />
        <KPICard
          label="DH1人あたり売上"
          value={formatCurrency(latest.revenuePerHygienist)}
          status="neutral"
        />
        <KPICard
          label="人件費率"
          value={formatPercent(latest.laborCostRatio)}
          sub={`適正: ${BENCHMARKS.laborCostRatio}%以下`}
          status={getStatus(latest.laborCostRatio, targets.laborCostRatio || BENCHMARKS.laborCostRatio, false)}
        />
        {latestPL && (
          <>
            <KPICard
              label="売上総利益率"
              value={formatPercent(latestPL.grossProfitRate)}
              status={getStatus(latestPL.grossProfitRate, BENCHMARKS.grossProfitRate, true)}
            />
            <KPICard
              label="営業利益率"
              value={formatPercent(latestPL.operatingProfitRate)}
              status={getStatus(latestPL.operatingProfitRate, BENCHMARKS.operatingProfitRate, true)}
            />
          </>
        )}
        <KPICard
          label="キャンセル率"
          value={formatPercent(latest.cancelRate)}
          sub={`適正: ${BENCHMARKS.cancelRate}%以下`}
          status={getStatus(latest.cancelRate, BENCHMARKS.cancelRate, false)}
        />
        <KPICard
          label="メンテ移行率"
          value={formatPercent(latest.maintenanceTransitionRate)}
          sub={`目標: ${BENCHMARKS.maintenanceTransitionRate}%`}
          status={getStatus(latest.maintenanceTransitionRate, BENCHMARKS.maintenanceTransitionRate, true)}
        />
      </div>

      {/* チャート */}
      <div className="charts-grid">
        <div className="card">
          <div className="card-title">売上推移</div>
          <div className="chart-container">
            <ResponsiveContainer>
              <ComposedChart data={kpis}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="yearMonth" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={v => `${(v / 10000).toFixed(0)}万`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Legend />
                <Area dataKey="monthlyRevenue" name="総売上" fill="#dbeafe" stroke="#2563eb" />
                <Bar dataKey="insuranceRevenue" name="保険" fill="#93c5fd" />
                <Bar dataKey="selfPayRevenue" name="自費" fill="#2563eb" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-title">患者数推移</div>
          <div className="chart-container">
            <ResponsiveContainer>
              <LineChart data={kpis}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="yearMonth" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line dataKey="totalPatients" name="延患者数" stroke="#2563eb" strokeWidth={2} />
                <Line dataKey="newPatients" name="新患数" stroke="#16a34a" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-title">売上構成比</div>
          <div className="chart-container">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-title">コスト構成</div>
          <div className="chart-container">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={costData} cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                  {costData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-title">自費率・再来率推移</div>
          <div className="chart-container">
            <ResponsiveContainer>
              <LineChart data={kpis}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="yearMonth" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
                <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />
                <Legend />
                <Line dataKey="selfPayRatio" name="自費率" stroke="#d97706" strokeWidth={2} />
                <Line dataKey="returnRate" name="再来率" stroke="#2563eb" strokeWidth={2} />
                <Line dataKey="cancelRate" name="キャンセル率" stroke="#dc2626" strokeWidth={2} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

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
      </div>

      {/* AI改善提案 */}
      <div style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>AI改善提案</h3>
        <InsightsList insights={insights} />
      </div>
    </div>
  );
}

function InsightsList({ insights }: { insights: AIInsight[] }) {
  const impactLabel: Record<string, string> = { high: '高', medium: '中', low: '低' };
  const difficultyLabel: Record<string, string> = { easy: '容易', medium: '普通', hard: '難' };

  return (
    <div>
      {insights.map((insight, i) => (
        <div key={insight.id} className={`insight-card ${insight.category}`}>
          <div className="insight-title">
            {i < 3 && <span style={{ marginRight: 8 }}>#{i + 1}</span>}
            {insight.title}
          </div>
          <div className="insight-description">{insight.description}</div>
          {insight.cause && (
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>
              🔍 原因仮説: {insight.cause}
            </div>
          )}
          <div className="insight-suggestion">💡 {insight.suggestion}</div>
          {insight.expectedImpact && (
            <div style={{ fontSize: 12, color: '#2563eb', marginTop: 4 }}>
              📈 期待インパクト: {insight.expectedImpact}
            </div>
          )}
          <div className="insight-meta">
            <span className={`badge badge-${insight.impact}`}>
              インパクト: {impactLabel[insight.impact]}
            </span>
            <span className={`badge ${insight.difficulty === 'easy' ? 'badge-easy' : insight.difficulty === 'hard' ? 'badge-hard' : 'badge-medium'}`}>
              難易度: {difficultyLabel[insight.difficulty]}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
