import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from 'recharts';
import type {
  MonthlyData, DirectCost, IndirectCost, AllocationRule, FinancialBasic, Department,
} from '../types';
import { DEPARTMENT_LABELS } from '../types';
import { calculateDepartmentProfitability, createDefaultIndirectCost, getDepartmentRevenue } from '../utils/accounting';
import { formatCurrency, formatPercent } from '../utils/kpi';

interface Props {
  monthlyData: MonthlyData[];
  directCosts: DirectCost[];
  indirectCosts: IndirectCost[];
  allocationRules: AllocationRule[];
  financialBasic: FinancialBasic;
  onUpdateDirectCosts: (costs: DirectCost[]) => void;
}

const DEPARTMENTS: Department[] = ['insurance', 'selfPay', 'maintenance', 'homeVisit'];
const COLORS = ['#2563eb', '#16a34a', '#d97706', '#8b5cf6'];

export default function DepartmentProfitability({
  monthlyData, directCosts, indirectCosts, allocationRules, financialBasic,
  onUpdateDirectCosts,
}: Props) {
  const [selectedMonth, setSelectedMonth] = useState<string>(
    monthlyData.length > 0 ? monthlyData[monthlyData.length - 1].yearMonth : ''
  );
  const [showDirectCostInput, setShowDirectCostInput] = useState(false);

  const selectedData = monthlyData.find(d => d.yearMonth === selectedMonth);

  const profitability = useMemo(() => {
    if (!selectedData) return [];
    const ic = indirectCosts.find(ic => ic.yearMonth === selectedMonth)
      || createDefaultIndirectCost(selectedMonth, financialBasic);
    return calculateDepartmentProfitability(selectedData, directCosts, ic, allocationRules);
  }, [selectedData, directCosts, indirectCosts, allocationRules, financialBasic, selectedMonth]);

  const totalRevenue = profitability.reduce((s, p) => s + p.revenue, 0);
  const totalDirectCost = profitability.reduce((s, p) => s + p.directCost, 0);
  const totalGrossProfit = profitability.reduce((s, p) => s + p.grossProfit, 0);
  const totalAllocated = profitability.reduce((s, p) => s + p.allocatedIndirectCost, 0);
  const totalOperating = profitability.reduce((s, p) => s + p.operatingProfit, 0);

  // 直接原価入力
  const handleDirectCostChange = (dept: Department, field: keyof Pick<DirectCost, 'labFee' | 'directMaterial' | 'outsourcing' | 'otherDirect'>, value: number) => {
    const existing = directCosts.find(dc => dc.yearMonth === selectedMonth && dc.department === dept);
    const updated: DirectCost = existing
      ? { ...existing, [field]: value }
      : { yearMonth: selectedMonth, department: dept, labFee: 0, directMaterial: 0, outsourcing: 0, otherDirect: 0, [field]: value };

    const newList = directCosts.filter(dc => !(dc.yearMonth === selectedMonth && dc.department === dept));
    newList.push(updated);
    onUpdateDirectCosts(newList);
  };

  const getDirectCost = (dept: Department): DirectCost => {
    return directCosts.find(dc => dc.yearMonth === selectedMonth && dc.department === dept)
      || { yearMonth: selectedMonth, department: dept, labFee: 0, directMaterial: 0, outsourcing: 0, otherDirect: 0 };
  };

  // チャートデータ
  const chartData = profitability.map(p => ({
    name: DEPARTMENT_LABELS[p.department],
    売上: p.revenue,
    直接原価: p.directCost,
    粗利: p.grossProfit,
    配賦額: p.allocatedIndirectCost,
    営業利益: p.operatingProfit,
  }));

  const revenueShareData = profitability.filter(p => p.revenue > 0).map(p => ({
    name: DEPARTMENT_LABELS[p.department],
    value: p.revenue,
  }));

  if (monthlyData.length === 0) {
    return (
      <div>
        <div className="section-header">
          <h2 className="section-title">部門別採算</h2>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-title">データがありません</div>
          <div className="empty-state-text">データを取り込むと部門別採算が表示されます</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">部門別採算</h2>
      </div>

      {/* 月選択 */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label className="form-label" style={{ marginBottom: 0 }}>対象月:</label>
            <select className="form-input" style={{ width: 200 }} value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}>
              {monthlyData.map(d => (
                <option key={d.yearMonth} value={d.yearMonth}>{d.yearMonth}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-secondary btn-sm"
            onClick={() => setShowDirectCostInput(!showDirectCostInput)}>
            {showDirectCostInput ? '直接原価入力を閉じる' : '直接原価を入力'}
          </button>
        </div>
      </div>

      {/* 直接原価入力 */}
      {showDirectCostInput && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 16 }}>直接原価入力（{selectedMonth}）</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
            各部門に直接紐づく費用を入力してください。技工料、直接材料費、外注費など。
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={{ padding: '10px 8px', textAlign: 'left' }}>部門</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center' }}>技工料</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center' }}>直接材料費</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center' }}>外注費</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center' }}>その他</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right' }}>合計</th>
                </tr>
              </thead>
              <tbody>
                {DEPARTMENTS.map(dept => {
                  const dc = getDirectCost(dept);
                  const total = dc.labFee + dc.directMaterial + dc.outsourcing + dc.otherDirect;
                  return (
                    <tr key={dept} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px', fontWeight: 600 }}>{DEPARTMENT_LABELS[dept]}</td>
                      {(['labFee', 'directMaterial', 'outsourcing', 'otherDirect'] as const).map(field => (
                        <td key={field} style={{ padding: '4px 4px', textAlign: 'center' }}>
                          <input type="number" className="form-input"
                            style={{ width: 100, fontSize: 12, padding: '6px 4px', textAlign: 'right' }}
                            value={dc[field]} onChange={e => handleDirectCostChange(dept, field, Number(e.target.value) || 0)} />
                        </td>
                      ))}
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>
                        {total.toLocaleString()}円
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 部門別採算表 */}
      <div className="card">
        <div className="card-title" style={{ marginBottom: 16 }}>部門別採算表（{selectedMonth}）</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ padding: '10px 8px', textAlign: 'left' }}>項目</th>
                {DEPARTMENTS.map(dept => (
                  <th key={dept} style={{ padding: '10px 8px', textAlign: 'right', minWidth: 110 }}>
                    {DEPARTMENT_LABELS[dept]}
                  </th>
                ))}
                <th style={{ padding: '10px 8px', textAlign: 'right', minWidth: 110, fontWeight: 800 }}>合計</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ background: '#f9fafb' }}>
                <td style={{ padding: '8px', fontWeight: 700 }}>売上高</td>
                {profitability.map(p => (
                  <td key={p.department} style={{ padding: '8px', textAlign: 'right' }}>{p.revenue.toLocaleString()}</td>
                ))}
                <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700 }}>{totalRevenue.toLocaleString()}</td>
              </tr>
              <tr>
                <td style={{ padding: '8px' }}>直接原価</td>
                {profitability.map(p => (
                  <td key={p.department} style={{ padding: '8px', textAlign: 'right', color: '#dc2626' }}>
                    △{p.directCost.toLocaleString()}
                  </td>
                ))}
                <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>△{totalDirectCost.toLocaleString()}</td>
              </tr>
              <tr style={{ background: '#f0fdf4', fontWeight: 700 }}>
                <td style={{ padding: '8px' }}>部門粗利（配賦前）</td>
                {profitability.map(p => (
                  <td key={p.department} style={{ padding: '8px', textAlign: 'right', color: p.grossProfit >= 0 ? '#16a34a' : '#dc2626' }}>
                    {p.grossProfit.toLocaleString()}
                  </td>
                ))}
                <td style={{ padding: '8px', textAlign: 'right', color: totalGrossProfit >= 0 ? '#16a34a' : '#dc2626' }}>{totalGrossProfit.toLocaleString()}</td>
              </tr>
              <tr style={{ fontSize: 12, color: '#6b7280' }}>
                <td style={{ padding: '4px 8px' }}>　粗利率</td>
                {profitability.map(p => (
                  <td key={p.department} style={{ padding: '4px 8px', textAlign: 'right' }}>
                    {p.revenue > 0 ? formatPercent(p.grossProfitRate) : '-'}
                  </td>
                ))}
                <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                  {totalRevenue > 0 ? formatPercent((totalGrossProfit / totalRevenue) * 100) : '-'}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '8px' }}>間接費配賦額</td>
                {profitability.map(p => (
                  <td key={p.department} style={{ padding: '8px', textAlign: 'right', color: '#d97706' }}>
                    △{Math.round(p.allocatedIndirectCost).toLocaleString()}
                  </td>
                ))}
                <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#d97706' }}>△{Math.round(totalAllocated).toLocaleString()}</td>
              </tr>
              <tr style={{ background: profitability.some(p => p.operatingProfit < 0) ? '#fef2f2' : '#eff6ff', fontWeight: 700, borderTop: '2px solid #e5e7eb' }}>
                <td style={{ padding: '10px 8px' }}>配賦後営業利益</td>
                {profitability.map(p => (
                  <td key={p.department} style={{ padding: '10px 8px', textAlign: 'right', color: p.operatingProfit >= 0 ? '#2563eb' : '#dc2626' }}>
                    {p.operatingProfit >= 0 ? '' : '△'}{Math.abs(Math.round(p.operatingProfit)).toLocaleString()}
                  </td>
                ))}
                <td style={{ padding: '10px 8px', textAlign: 'right', color: totalOperating >= 0 ? '#2563eb' : '#dc2626' }}>
                  {totalOperating >= 0 ? '' : '△'}{Math.abs(Math.round(totalOperating)).toLocaleString()}
                </td>
              </tr>
              <tr style={{ fontSize: 12, color: '#6b7280' }}>
                <td style={{ padding: '4px 8px' }}>　営業利益率</td>
                {profitability.map(p => (
                  <td key={p.department} style={{ padding: '4px 8px', textAlign: 'right', color: p.operatingProfitRate >= 0 ? '#2563eb' : '#dc2626' }}>
                    {p.revenue > 0 ? formatPercent(p.operatingProfitRate) : '-'}
                  </td>
                ))}
                <td style={{ padding: '4px 8px', textAlign: 'right', color: totalOperating >= 0 ? '#2563eb' : '#dc2626' }}>
                  {totalRevenue > 0 ? formatPercent((totalOperating / totalRevenue) * 100) : '-'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 説明文 */}
        <div style={{ marginTop: 16, padding: 12, background: '#f9fafb', borderRadius: 8, fontSize: 13, color: '#4b5563', lineHeight: 1.8 }}>
          <strong>この利益率になった理由：</strong>
          {profitability.filter(p => p.revenue > 0).map(p => {
            const label = DEPARTMENT_LABELS[p.department];
            if (p.operatingProfitRate < 0) {
              return ` ${label}は売上${formatCurrency(p.revenue)}に対し、直接原価${formatCurrency(p.directCost)}と間接費配賦${formatCurrency(Math.round(p.allocatedIndirectCost))}がかかり赤字です。`;
            }
            if (p.operatingProfitRate < 10) {
              return ` ${label}は配賦後利益率${formatPercent(p.operatingProfitRate)}で薄利です。`;
            }
            return ` ${label}は配賦後利益率${formatPercent(p.operatingProfitRate)}で健全です。`;
          }).join('')}
        </div>
      </div>

      <div className="charts-grid">
        {/* 部門別売上構成 */}
        <div className="card">
          <div className="card-title">部門別売上構成</div>
          <div className="chart-container">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={revenueShareData} cx="50%" cy="50%" outerRadius={100}
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                  {revenueShareData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 部門別利益比較 */}
        <div className="card">
          <div className="card-title">部門別 粗利 vs 配賦後営業利益</div>
          <div className="chart-container">
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={v => `${(v / 10000).toFixed(0)}万`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Legend />
                <Bar dataKey="粗利" fill="#16a34a" />
                <Bar dataKey="配賦額" fill="#d97706" />
                <Bar dataKey="営業利益" fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
