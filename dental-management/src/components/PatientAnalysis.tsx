import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend, PieChart, Pie, Cell,
} from 'recharts';
import type { MonthlyData, StaffCount, Equipment, FinancialBasic } from '../types';
import { calculateKPI, formatPercent, BENCHMARKS } from '../utils/kpi';

interface Props {
  monthlyData: MonthlyData[];
  staffCount: StaffCount;
  equipment: Equipment;
  financialBasic: FinancialBasic;
  workDays: number;
}

const COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#8b5cf6'];

export default function PatientAnalysis({ monthlyData, staffCount, equipment, financialBasic, workDays }: Props) {
  const kpis = useMemo(() => {
    return monthlyData.map(d => calculateKPI(d, staffCount, equipment, financialBasic, workDays));
  }, [monthlyData, staffCount, equipment, financialBasic, workDays]);

  const latest = kpis.length > 0 ? kpis[kpis.length - 1] : null;
  const prev = kpis.length > 1 ? kpis[kpis.length - 2] : null;

  if (!latest) {
    return (
      <div>
        <div className="section-header">
          <h2 className="section-title">患者分析</h2>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon">👥</div>
          <div className="empty-state-title">データがありません</div>
          <div className="empty-state-text">データを取り込むと患者分析が表示されます</div>
        </div>
      </div>
    );
  }

  // 患者構成データ
  const patientComposition = [
    { name: '新患', value: latest.newPatients },
    { name: '再来', value: latest.totalPatients - latest.newPatients },
  ];

  // 月別データ
  const patientTrendData = monthlyData.map((d, i) => ({
    yearMonth: d.yearMonth,
    延患者数: d.totalPatients,
    新患数: d.newPatients,
    再来: d.returnPatients,
    メンテ: d.maintenancePatients,
    キャンセル: d.cancelCount,
    実患者数: kpis[i]?.uniquePatients || 0,
  }));

  const rateData = kpis.map(k => ({
    yearMonth: k.yearMonth,
    再来率: k.returnRate,
    キャンセル率: k.cancelRate,
    メンテ移行率: k.maintenanceTransitionRate,
  }));

  // 新患→再来変換率（推計）
  const conversionData = monthlyData.map((d, i) => {
    const nextMonth = monthlyData[i + 1];
    const convRate = nextMonth && d.newPatients > 0
      ? Math.min((nextMonth.returnPatients / (d.totalPatients)) * 100, 100)
      : null;
    return {
      yearMonth: d.yearMonth,
      新患数: d.newPatients,
      推定継続率: convRate,
    };
  });

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">患者分析</h2>
      </div>

      {/* KPIカード */}
      <div className="kpi-grid">
        <div className="kpi-card neutral">
          <div className="kpi-label">延患者数</div>
          <div className="kpi-value">{latest.totalPatients}人</div>
          {prev && (
            <div className={`kpi-change ${latest.totalPatients >= prev.totalPatients ? 'up' : 'down'}`}>
              {latest.totalPatients >= prev.totalPatients ? '↑' : '↓'} {Math.abs(latest.totalPatients - prev.totalPatients)}人
            </div>
          )}
        </div>
        <div className="kpi-card neutral">
          <div className="kpi-label">実患者数</div>
          <div className="kpi-value">{latest.uniquePatients}人</div>
        </div>
        <div className={`kpi-card ${latest.newPatients >= BENCHMARKS.newPatientsMin ? 'positive' : 'warning'}`}>
          <div className="kpi-label">新患数</div>
          <div className="kpi-value">{latest.newPatients}人</div>
          <div className="kpi-sub">目安: {BENCHMARKS.newPatientsMin}人以上</div>
        </div>
        <div className={`kpi-card ${latest.returnRate >= BENCHMARKS.returnRate ? 'positive' : 'warning'}`}>
          <div className="kpi-label">再来率</div>
          <div className="kpi-value">{formatPercent(latest.returnRate)}</div>
          <div className="kpi-sub">目標: {BENCHMARKS.returnRate}%</div>
        </div>
        <div className={`kpi-card ${latest.cancelRate <= BENCHMARKS.cancelRate ? 'positive' : 'warning'}`}>
          <div className="kpi-label">キャンセル率</div>
          <div className="kpi-value">{formatPercent(latest.cancelRate)}</div>
          <div className="kpi-sub">適正: {BENCHMARKS.cancelRate}%以下</div>
        </div>
        <div className={`kpi-card ${latest.maintenanceTransitionRate >= BENCHMARKS.maintenanceTransitionRate ? 'positive' : 'warning'}`}>
          <div className="kpi-label">メンテ移行率</div>
          <div className="kpi-value">{formatPercent(latest.maintenanceTransitionRate)}</div>
          <div className="kpi-sub">目標: {BENCHMARKS.maintenanceTransitionRate}%</div>
        </div>
      </div>

      <div className="charts-grid">
        {/* 患者数推移 */}
        <div className="card">
          <div className="card-title">患者数推移</div>
          <div className="chart-container">
            <ResponsiveContainer>
              <BarChart data={patientTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="yearMonth" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="延患者数" fill="#2563eb" />
                <Bar dataKey="新患数" fill="#16a34a" />
                <Bar dataKey="メンテ" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 患者構成 */}
        <div className="card">
          <div className="card-title">患者構成（今月）</div>
          <div className="chart-container">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={patientComposition} cx="50%" cy="50%" outerRadius={100}
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                  {patientComposition.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 各率推移 */}
        <div className="card">
          <div className="card-title">再来率・キャンセル率・メンテ移行率</div>
          <div className="chart-container">
            <ResponsiveContainer>
              <LineChart data={rateData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="yearMonth" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
                <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />
                <Legend />
                <Line dataKey="再来率" stroke="#2563eb" strokeWidth={2} />
                <Line dataKey="キャンセル率" stroke="#dc2626" strokeWidth={2} strokeDasharray="5 5" />
                <Line dataKey="メンテ移行率" stroke="#8b5cf6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 新患推移 */}
        <div className="card">
          <div className="card-title">新患数推移</div>
          <div className="chart-container">
            <ResponsiveContainer>
              <LineChart data={conversionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="yearMonth" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line dataKey="新患数" stroke="#16a34a" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 改善提案 */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-title" style={{ marginBottom: 16 }}>💡 患者に関する改善提案</div>
        <div style={{ display: 'grid', gap: 12 }}>
          {latest.returnRate < BENCHMARKS.returnRate && (
            <div className="insight-card warning">
              <div className="insight-title">新患は来るが再来率が低い</div>
              <div className="insight-description">再来率 {formatPercent(latest.returnRate)} は目標 {BENCHMARKS.returnRate}% を下回っています。</div>
              <div className="insight-suggestion">💡 次回予約の確実な取得、リコール体制の強化、患者満足度向上を進めましょう。</div>
            </div>
          )}
          {latest.maintenanceTransitionRate < BENCHMARKS.maintenanceTransitionRate && (
            <div className="insight-card warning">
              <div className="insight-title">メンテナンス移行率に改善余地あり</div>
              <div className="insight-description">メンテ移行率 {formatPercent(latest.maintenanceTransitionRate)} は目標 {BENCHMARKS.maintenanceTransitionRate}% に未達です。</div>
              <div className="insight-suggestion">💡 治療完了時のメンテ移行カウンセリングを衛生士が主導する体制を構築しましょう。</div>
            </div>
          )}
          {latest.cancelRate > BENCHMARKS.cancelRate && (
            <div className="insight-card warning">
              <div className="insight-title">キャンセル率が高い</div>
              <div className="insight-description">キャンセル率 {formatPercent(latest.cancelRate)} は適正値 {BENCHMARKS.cancelRate}% を超えています。</div>
              <div className="insight-suggestion">💡 LINE・SMSリマインドの導入、キャンセルポリシーの明確化を検討しましょう。</div>
            </div>
          )}
          {latest.newPatients < BENCHMARKS.newPatientsMin && (
            <div className="insight-card critical">
              <div className="insight-title">新患獲得が不足</div>
              <div className="insight-description">新患 {latest.newPatients}人/月は目安 {BENCHMARKS.newPatientsMin}人を下回っています。</div>
              <div className="insight-suggestion">💡 Googleビジネスプロフィールの最適化、Web広告、紹介患者施策を強化しましょう。</div>
            </div>
          )}
          {latest.selfPayRatio < BENCHMARKS.selfPayRatio && (
            <div className="insight-card warning">
              <div className="insight-title">自費化率が低い</div>
              <div className="insight-description">自費率 {formatPercent(latest.selfPayRatio)} は業界平均 {BENCHMARKS.selfPayRatio}% を下回っています。</div>
              <div className="insight-suggestion">💡 カウンセリングルームの設置、自費メニュー表の整備、初診時の説明フローを見直しましょう。</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
