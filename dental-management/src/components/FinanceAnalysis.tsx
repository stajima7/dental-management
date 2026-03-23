import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend, ComposedChart, Area,
} from 'recharts';
import type { MonthlyData, FinancialBasic, StaffCount, Equipment, DirectCost, IndirectCost } from '../types';
import { calculateKPI, formatCurrency, formatPercent, BENCHMARKS } from '../utils/kpi';
import { calculateAccountingPL, getTotalIndirectCost, createDefaultIndirectCost } from '../utils/accounting';

interface Props {
  monthlyData: MonthlyData[];
  staffCount: StaffCount;
  equipment: Equipment;
  financialBasic: FinancialBasic;
  directCosts: DirectCost[];
  indirectCosts: IndirectCost[];
  workDays: number;
}

const COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e'];
const toNum = (v: number | ''): number => (v === '' ? 0 : v);

export default function FinanceAnalysis({ monthlyData, staffCount, equipment, financialBasic, directCosts, indirectCosts, workDays }: Props) {
  const kpis = useMemo(() => {
    return monthlyData.map(d => calculateKPI(d, staffCount, equipment, financialBasic, workDays));
  }, [monthlyData, staffCount, equipment, financialBasic, workDays]);

  const plData = useMemo(() => {
    return monthlyData.map(d => {
      const ic = indirectCosts.find(ic => ic.yearMonth === d.yearMonth) || createDefaultIndirectCost(d.yearMonth, financialBasic);
      return calculateAccountingPL(d, directCosts, ic, financialBasic);
    });
  }, [monthlyData, directCosts, indirectCosts, financialBasic]);

  const latest = kpis.length > 0 ? kpis[kpis.length - 1] : null;
  const latestPL = plData.length > 0 ? plData[plData.length - 1] : null;

  // コスト構成
  const costBreakdown = [
    { name: '人件費', value: toNum(financialBasic.laborCost) },
    { name: '材料費', value: toNum(financialBasic.materialCost) },
    { name: '家賃', value: toNum(financialBasic.rent) },
    { name: '広告費', value: toNum(financialBasic.advertisingCost) },
    { name: '借入返済', value: toNum(financialBasic.loanRepayment) },
  ].filter(d => d.value > 0);

  const totalCost = costBreakdown.reduce((s, d) => s + d.value, 0);

  // PL推移チャートデータ
  const plChartData = plData.map(pl => ({
    yearMonth: pl.yearMonth,
    売上: pl.revenue,
    売上原価: pl.cogs,
    売上総利益: pl.grossProfit,
    販管費: pl.sgaExpenses,
    営業利益: pl.operatingProfit,
  }));

  const profitRateData = plData.map(pl => ({
    yearMonth: pl.yearMonth,
    売上総利益率: pl.grossProfitRate,
    営業利益率: pl.operatingProfitRate,
  }));

  // 損益分岐点
  const fixedCosts = toNum(financialBasic.laborCost) + toNum(financialBasic.rent) + toNum(financialBasic.loanRepayment);
  const variableRatio = latest && latest.monthlyRevenue > 0 ? toNum(financialBasic.materialCost) / latest.monthlyRevenue : 0.1;
  const breakEvenRevenue = variableRatio < 1 ? fixedCosts / (1 - variableRatio) : 0;
  const breakEvenRate = latest && latest.monthlyRevenue > 0 ? (latest.monthlyRevenue / breakEvenRevenue) * 100 : 0;

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">カネ分析（売上・利益・コスト）</h2>
      </div>

      {/* KPIカード */}
      <div className="kpi-grid">
        <div className="kpi-card neutral">
          <div className="kpi-label">月商</div>
          <div className="kpi-value">{latest ? formatCurrency(latest.monthlyRevenue) : '-'}</div>
        </div>
        <div className={`kpi-card ${latestPL && latestPL.grossProfitRate >= BENCHMARKS.grossProfitRate ? 'positive' : 'warning'}`}>
          <div className="kpi-label">売上総利益率</div>
          <div className="kpi-value">{latestPL ? formatPercent(latestPL.grossProfitRate) : '-'}</div>
          <div className="kpi-sub">目標: {BENCHMARKS.grossProfitRate}%</div>
        </div>
        <div className={`kpi-card ${latestPL && latestPL.operatingProfitRate >= BENCHMARKS.operatingProfitRate ? 'positive' : latestPL && latestPL.operatingProfitRate >= 0 ? 'warning' : 'critical'}`}>
          <div className="kpi-label">営業利益率</div>
          <div className="kpi-value">{latestPL ? formatPercent(latestPL.operatingProfitRate) : '-'}</div>
          <div className="kpi-sub">目標: {BENCHMARKS.operatingProfitRate}%</div>
        </div>
        <div className={`kpi-card ${breakEvenRate >= 100 ? 'positive' : 'critical'}`}>
          <div className="kpi-label">損益分岐点達成率</div>
          <div className="kpi-value">{formatPercent(breakEvenRate)}</div>
          <div className="kpi-sub">BEP: {formatCurrency(breakEvenRevenue)}</div>
        </div>
      </div>

      {/* 会計ベースPL表 */}
      {latestPL && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 16 }}>損益計算書（会計ベース）- {latestPL.yearMonth}</div>
          <div className="data-preview">
            <table>
              <tbody>
                <tr style={{ fontWeight: 700, background: '#f9fafb' }}>
                  <td>売上高</td>
                  <td style={{ textAlign: 'right' }}>{latestPL.revenue.toLocaleString()}円</td>
                  <td style={{ textAlign: 'right' }}>100.0%</td>
                </tr>
                <tr>
                  <td>売上原価（直接原価）</td>
                  <td style={{ textAlign: 'right' }}>△{latestPL.cogs.toLocaleString()}円</td>
                  <td style={{ textAlign: 'right' }}>{latestPL.revenue > 0 ? (latestPL.cogs / latestPL.revenue * 100).toFixed(1) : 0}%</td>
                </tr>
                <tr style={{ fontWeight: 700, background: '#f0fdf4' }}>
                  <td>売上総利益</td>
                  <td style={{ textAlign: 'right' }}>{latestPL.grossProfit.toLocaleString()}円</td>
                  <td style={{ textAlign: 'right' }}>{latestPL.grossProfitRate.toFixed(1)}%</td>
                </tr>
                <tr>
                  <td>販管費（間接費）</td>
                  <td style={{ textAlign: 'right' }}>△{latestPL.sgaExpenses.toLocaleString()}円</td>
                  <td style={{ textAlign: 'right' }}>{latestPL.revenue > 0 ? (latestPL.sgaExpenses / latestPL.revenue * 100).toFixed(1) : 0}%</td>
                </tr>
                <tr style={{ fontWeight: 700, background: latestPL.operatingProfit >= 0 ? '#f0fdf4' : '#fef2f2' }}>
                  <td>営業利益</td>
                  <td style={{ textAlign: 'right', color: latestPL.operatingProfit >= 0 ? '#16a34a' : '#dc2626' }}>
                    {latestPL.operatingProfit >= 0 ? '' : '△'}{Math.abs(latestPL.operatingProfit).toLocaleString()}円
                  </td>
                  <td style={{ textAlign: 'right', color: latestPL.operatingProfit >= 0 ? '#16a34a' : '#dc2626' }}>
                    {latestPL.operatingProfitRate.toFixed(1)}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="charts-grid">
        {/* 売上推移 */}
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

        {/* 利益率推移 */}
        <div className="card">
          <div className="card-title">利益率推移</div>
          <div className="chart-container">
            <ResponsiveContainer>
              <LineChart data={profitRateData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="yearMonth" tick={{ fontSize: 12 }} />
                <YAxis domain={[-20, 100]} tick={{ fontSize: 12 }} unit="%" />
                <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />
                <Legend />
                <Line dataKey="売上総利益率" stroke="#16a34a" strokeWidth={2} />
                <Line dataKey="営業利益率" stroke="#2563eb" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* コスト構成 */}
        <div className="card">
          <div className="card-title">コスト構成</div>
          <div className="chart-container">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={costBreakdown} cx="50%" cy="50%" outerRadius={100}
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                  {costBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* PL推移 */}
        <div className="card">
          <div className="card-title">営業利益推移</div>
          <div className="chart-container">
            <ResponsiveContainer>
              <BarChart data={plChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="yearMonth" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={v => `${(v / 10000).toFixed(0)}万`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Legend />
                <Bar dataKey="売上総利益" fill="#16a34a" />
                <Bar dataKey="営業利益" fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* コスト比率一覧 */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-title" style={{ marginBottom: 16 }}>コスト比率一覧</div>
        <div className="data-preview">
          <table>
            <thead>
              <tr>
                <th>費目</th>
                <th style={{ textAlign: 'right' }}>金額</th>
                <th style={{ textAlign: 'right' }}>対売上比率</th>
                <th>判定</th>
              </tr>
            </thead>
            <tbody>
              {costBreakdown.map(item => {
                const ratio = latest ? (item.value / latest.monthlyRevenue) * 100 : 0;
                return (
                  <tr key={item.name}>
                    <td>{item.name}</td>
                    <td style={{ textAlign: 'right' }}>{item.value.toLocaleString()}円</td>
                    <td style={{ textAlign: 'right' }}>{ratio.toFixed(1)}%</td>
                    <td>
                      {item.name === '人件費' && (
                        <span className={`badge ${ratio <= 25 ? 'badge-low' : ratio <= 30 ? 'badge-medium' : 'badge-high'}`}>
                          {ratio <= 25 ? '適正' : ratio <= 30 ? 'やや高' : '高い'}
                        </span>
                      )}
                      {item.name === '材料費' && (
                        <span className={`badge ${ratio <= 8 ? 'badge-low' : ratio <= 10 ? 'badge-medium' : 'badge-high'}`}>
                          {ratio <= 8 ? '適正' : ratio <= 10 ? 'やや高' : '高い'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              <tr style={{ fontWeight: 700, background: '#f9fafb' }}>
                <td>合計</td>
                <td style={{ textAlign: 'right' }}>{totalCost.toLocaleString()}円</td>
                <td style={{ textAlign: 'right' }}>{latest ? ((totalCost / latest.monthlyRevenue) * 100).toFixed(1) : 0}%</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
