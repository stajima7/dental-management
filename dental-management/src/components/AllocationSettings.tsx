import { useState } from 'react';
import type {
  AllocationRule, IndirectCost, Department, CostDriver,
  MonthlyData, FinancialBasic,
} from '../types';
import { DEPARTMENT_LABELS, INDIRECT_COST_LABELS, COST_DRIVER_LABELS } from '../types';
import { createDefaultIndirectCost, calculateAllocationRate } from '../utils/accounting';
import { formatCurrency } from '../utils/kpi';

interface Props {
  allocationRules: AllocationRule[];
  indirectCosts: IndirectCost[];
  monthlyData: MonthlyData[];
  financialBasic: FinancialBasic;
  onUpdateRules: (rules: AllocationRule[]) => void;
  onUpdateIndirectCosts: (costs: IndirectCost[]) => void;
}

const DEPARTMENTS: Department[] = ['insurance', 'selfPay', 'maintenance', 'homeVisit'];
const DRIVERS: CostDriver[] = ['patientCount', 'newPatientCount', 'appointmentCount', 'workHours', 'fte', 'unitTime', 'unitUsage', 'area', 'revenueRatio'];

export default function AllocationSettings({
  allocationRules, indirectCosts, monthlyData, financialBasic,
  onUpdateRules, onUpdateIndirectCosts,
}: Props) {
  const [editingMonth, setEditingMonth] = useState<string>(
    monthlyData.length > 0 ? monthlyData[monthlyData.length - 1].yearMonth : ''
  );
  const [activeTab, setActiveTab] = useState<'indirect' | 'rules' | 'result'>('indirect');

  // 対象月の間接費取得
  const currentIC = indirectCosts.find(ic => ic.yearMonth === editingMonth)
    || createDefaultIndirectCost(editingMonth, financialBasic);

  const handleICChange = (key: keyof Omit<IndirectCost, 'yearMonth'>, value: number) => {
    const updated = { ...currentIC, [key]: value };
    const existing = indirectCosts.findIndex(ic => ic.yearMonth === editingMonth);
    const newList = [...indirectCosts];
    if (existing >= 0) {
      newList[existing] = updated;
    } else {
      newList.push(updated);
    }
    onUpdateIndirectCosts(newList);
  };

  const handleRuleChange = (index: number, field: 'driver' | 'driverValues', value: CostDriver | Record<Department, number>) => {
    const newRules = [...allocationRules];
    if (field === 'driver') {
      newRules[index] = { ...newRules[index], driver: value as CostDriver };
    } else {
      newRules[index] = { ...newRules[index], driverValues: value as Record<Department, number> };
    }
    onUpdateRules(newRules);
  };

  const handleDriverValueChange = (ruleIndex: number, dept: Department, value: number) => {
    const newValues = { ...allocationRules[ruleIndex].driverValues, [dept]: value };
    handleRuleChange(ruleIndex, 'driverValues', newValues);
  };

  const totalIndirectCost = Object.entries(currentIC)
    .filter(([k]) => k !== 'yearMonth')
    .reduce((sum, [, v]) => sum + (v as number), 0);

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">配賦設定</h2>
      </div>

      {/* 月選択 */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <label className="form-label" style={{ marginBottom: 0 }}>対象月:</label>
          <select className="form-input" style={{ width: 200 }} value={editingMonth}
            onChange={e => setEditingMonth(e.target.value)}>
            {monthlyData.map(d => (
              <option key={d.yearMonth} value={d.yearMonth}>{d.yearMonth}</option>
            ))}
          </select>
        </div>
      </div>

      {/* タブ */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20 }}>
        {(['indirect', 'rules', 'result'] as const).map(tab => (
          <button key={tab} className={`nav-item ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}>
            {tab === 'indirect' && '間接費入力'}
            {tab === 'rules' && '配賦ルール設定'}
            {tab === 'result' && '配賦結果確認'}
          </button>
        ))}
      </div>

      {/* 間接費入力 */}
      {activeTab === 'indirect' && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 16 }}>
            間接費入力（{editingMonth}）
            <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 12 }}>
              合計: {formatCurrency(totalIndirectCost)}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {(Object.keys(INDIRECT_COST_LABELS) as (keyof Omit<IndirectCost, 'yearMonth'>)[]).map(key => (
              <div key={key} className="form-group" style={{ marginBottom: 8 }}>
                <label className="form-label" style={{ fontSize: 13 }}>{INDIRECT_COST_LABELS[key]}</label>
                <input
                  type="number"
                  className="form-input"
                  value={currentIC[key]}
                  onChange={e => handleICChange(key, Number(e.target.value) || 0)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 配賦ルール */}
      {activeTab === 'rules' && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 8 }}>配賦ルール設定</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
            各間接費項目に対して、コストドライバーと各部門のドライバー量（配分比率）を設定します。
            合計が100になるように設定してください。
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={{ padding: '10px 8px', textAlign: 'left', minWidth: 140 }}>費目</th>
                  <th style={{ padding: '10px 8px', textAlign: 'left', minWidth: 140 }}>ドライバー</th>
                  {DEPARTMENTS.map(dept => (
                    <th key={dept} style={{ padding: '10px 8px', textAlign: 'center', minWidth: 90 }}>
                      {DEPARTMENT_LABELS[dept]}
                    </th>
                  ))}
                  <th style={{ padding: '10px 8px', textAlign: 'center', minWidth: 60 }}>合計</th>
                </tr>
              </thead>
              <tbody>
                {allocationRules.map((rule, i) => {
                  const total = Object.values(rule.driverValues).reduce((a, b) => a + b, 0);
                  return (
                    <tr key={rule.costItem} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px', fontWeight: 600 }}>{INDIRECT_COST_LABELS[rule.costItem]}</td>
                      <td style={{ padding: '4px 8px' }}>
                        <select className="form-input" style={{ fontSize: 12, padding: '6px 8px' }}
                          value={rule.driver}
                          onChange={e => handleRuleChange(i, 'driver', e.target.value as CostDriver)}>
                          {DRIVERS.map(d => (
                            <option key={d} value={d}>{COST_DRIVER_LABELS[d]}</option>
                          ))}
                        </select>
                      </td>
                      {DEPARTMENTS.map(dept => (
                        <td key={dept} style={{ padding: '4px 4px', textAlign: 'center' }}>
                          <input
                            type="number"
                            className="form-input"
                            style={{ width: 70, fontSize: 12, padding: '6px 4px', textAlign: 'center' }}
                            value={rule.driverValues[dept]}
                            onChange={e => handleDriverValueChange(i, dept, Number(e.target.value) || 0)}
                          />
                        </td>
                      ))}
                      <td style={{ padding: '8px', textAlign: 'center', fontWeight: 600, color: total === 100 ? '#16a34a' : '#dc2626' }}>
                        {total}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 配賦結果 */}
      {activeTab === 'result' && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 16 }}>配賦結果確認（{editingMonth}）</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
            各間接費がどのように各部門に配賦されるかを表示します。
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={{ padding: '10px 8px', textAlign: 'left' }}>費目</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right' }}>金額</th>
                  <th style={{ padding: '10px 8px', textAlign: 'left' }}>ドライバー</th>
                  {DEPARTMENTS.map(dept => (
                    <th key={dept} style={{ padding: '10px 8px', textAlign: 'right' }}>
                      {DEPARTMENT_LABELS[dept]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allocationRules.map(rule => {
                  const { allocated } = calculateAllocationRate(rule, currentIC);
                  const costAmount = currentIC[rule.costItem] as number;

                  return (
                    <tr key={rule.costItem} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px', fontWeight: 600 }}>{INDIRECT_COST_LABELS[rule.costItem]}</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>{costAmount.toLocaleString()}円</td>
                      <td style={{ padding: '8px', fontSize: 12, color: '#6b7280' }}>{COST_DRIVER_LABELS[rule.driver]}</td>
                      {DEPARTMENTS.map(dept => (
                        <td key={dept} style={{ padding: '8px', textAlign: 'right' }}>
                          {Math.round(allocated[dept]).toLocaleString()}円
                        </td>
                      ))}
                    </tr>
                  );
                })}
                <tr style={{ fontWeight: 700, background: '#f9fafb', borderTop: '2px solid #e5e7eb' }}>
                  <td style={{ padding: '10px 8px' }}>合計</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right' }}>{totalIndirectCost.toLocaleString()}円</td>
                  <td></td>
                  {DEPARTMENTS.map(dept => {
                    const deptTotal = allocationRules.reduce((sum, rule) => {
                      const { allocated } = calculateAllocationRate(rule, currentIC);
                      return sum + allocated[dept];
                    }, 0);
                    return (
                      <td key={dept} style={{ padding: '10px 8px', textAlign: 'right' }}>
                        {Math.round(deptTotal).toLocaleString()}円
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>

          {/* 配賦ルール説明 */}
          <div style={{ marginTop: 24, padding: 16, background: '#eff6ff', borderRadius: 8, fontSize: 13 }}>
            <div style={{ fontWeight: 700, marginBottom: 8, color: '#1d4ed8' }}>配賦計算の考え方</div>
            <div style={{ color: '#374151', lineHeight: 1.8 }}>
              <div>・<strong>コストドライバー・レート</strong> = 配賦対象間接費 ÷ 総ドライバー量</div>
              <div>・<strong>部門配賦額</strong> = 各部門のドライバー量 × コストドライバー・レート</div>
              <div>・配賦前と配賦後の利益を「部門別採算」画面で比較できます</div>
              <div>・配賦ルールは「納得感」が大切です。院長と協議の上、適切な基準を設定してください</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
