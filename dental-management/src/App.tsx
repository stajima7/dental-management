import { useState, useEffect, useCallback } from 'react';
import type { AppState, MonthlyData, DirectCost, IndirectCost, AllocationRule, MonthlyTargets } from './types';
import { loadState, saveState, clearState } from './utils/storage';
import SetupWizard from './components/SetupWizard';
import Dashboard from './components/Dashboard';
import CSVImport from './components/CSVImport';
import ActionPlan from './components/ActionPlan';
import HumanAnalysis from './components/HumanAnalysis';
import EquipmentAnalysis from './components/EquipmentAnalysis';
import FinanceAnalysis from './components/FinanceAnalysis';
import PatientAnalysis from './components/PatientAnalysis';
import AllocationSettings from './components/AllocationSettings';
import DepartmentProfitabilityPage from './components/DepartmentProfitability';

type Page = 'dashboard' | 'import' | 'human' | 'equipment' | 'finance' | 'allocation' | 'department' | 'patient' | 'action' | 'settings';

const NAV_ITEMS: { key: Page; label: string; icon: string }[] = [
  { key: 'dashboard', label: 'ダッシュボード', icon: '📊' },
  { key: 'import', label: 'データ取込', icon: '📄' },
  { key: 'human', label: 'ヒト分析', icon: '👥' },
  { key: 'equipment', label: 'モノ分析', icon: '🏥' },
  { key: 'finance', label: 'カネ分析', icon: '💰' },
  { key: 'allocation', label: '配賦設定', icon: '⚖️' },
  { key: 'department', label: '部門別採算', icon: '📋' },
  { key: 'patient', label: '患者分析', icon: '🧑‍⚕️' },
  { key: 'action', label: '改善提案', icon: '🎯' },
  { key: 'settings', label: '医院設定', icon: '⚙️' },
];

function App() {
  const [state, setState] = useState<AppState>(loadState);
  const [page, setPage] = useState<Page>('dashboard');

  useEffect(() => {
    saveState(state);
  }, [state]);

  const handleCompleteSetup = useCallback(() => {
    setState(prev => ({ ...prev, isSetupComplete: true }));
  }, []);

  const handleImportData = useCallback((data: MonthlyData[]) => {
    setState(prev => ({ ...prev, monthlyData: data }));
  }, []);

  const handleUpdateDirectCosts = useCallback((costs: DirectCost[]) => {
    setState(prev => ({ ...prev, directCosts: costs }));
  }, []);

  const handleUpdateIndirectCosts = useCallback((costs: IndirectCost[]) => {
    setState(prev => ({ ...prev, indirectCosts: costs }));
  }, []);

  const handleUpdateRules = useCallback((rules: AllocationRule[]) => {
    setState(prev => ({ ...prev, allocationRules: rules }));
  }, []);

  const handleReset = useCallback(() => {
    if (confirm('全データをリセットしますか？この操作は取り消せません。')) {
      clearState();
      setState(loadState());
      setPage('dashboard');
    }
  }, []);

  const workDays = (state.clinicInfo.monthlyWorkDays || 22) as number;

  if (!state.isSetupComplete) {
    return (
      <div className="app">
        <header className="header">
          <h1>🦷 歯科経営ダッシュボード</h1>
        </header>
        <div className="main-content">
          <SetupWizard
            clinicInfo={state.clinicInfo}
            equipment={state.equipment}
            staffCount={state.staffCount}
            financialBasic={state.financialBasic}
            currentStep={state.currentStep}
            onUpdateClinicInfo={info => setState(prev => ({ ...prev, clinicInfo: info }))}
            onUpdateEquipment={eq => setState(prev => ({ ...prev, equipment: eq }))}
            onUpdateStaffCount={sc => setState(prev => ({ ...prev, staffCount: sc }))}
            onUpdateFinancialBasic={fb => setState(prev => ({ ...prev, financialBasic: fb }))}
            onStepChange={step => setState(prev => ({ ...prev, currentStep: step }))}
            onComplete={handleCompleteSetup}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <h1>🦷 歯科経営ダッシュボード</h1>
        <div className="header-actions">
          <span className="header-clinic-name">{state.clinicInfo.clinicName}</span>
          <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }} onClick={handleReset}>
            リセット
          </button>
        </div>
      </header>

      <nav className="nav">
        {NAV_ITEMS.map(item => (
          <button
            key={item.key}
            className={`nav-item ${page === item.key ? 'active' : ''}`}
            onClick={() => setPage(item.key)}
          >
            {item.icon} {item.label}
          </button>
        ))}
      </nav>

      <main className="main-content">
        {page === 'dashboard' && (
          <Dashboard
            monthlyData={state.monthlyData}
            staffCount={state.staffCount}
            equipment={state.equipment}
            financialBasic={state.financialBasic}
            directCosts={state.directCosts}
            indirectCosts={state.indirectCosts}
            allocationRules={state.allocationRules}
            targets={state.targets}
            workDays={workDays}
          />
        )}
        {page === 'import' && (
          <CSVImport
            existingData={state.monthlyData}
            onImport={handleImportData}
          />
        )}
        {page === 'human' && (
          <HumanAnalysis
            monthlyData={state.monthlyData}
            staffCount={state.staffCount}
            equipment={state.equipment}
            financialBasic={state.financialBasic}
            workDays={workDays}
          />
        )}
        {page === 'equipment' && (
          <EquipmentAnalysis
            monthlyData={state.monthlyData}
            staffCount={state.staffCount}
            equipment={state.equipment}
            financialBasic={state.financialBasic}
            workDays={workDays}
          />
        )}
        {page === 'finance' && (
          <FinanceAnalysis
            monthlyData={state.monthlyData}
            staffCount={state.staffCount}
            equipment={state.equipment}
            financialBasic={state.financialBasic}
            directCosts={state.directCosts}
            indirectCosts={state.indirectCosts}
            workDays={workDays}
          />
        )}
        {page === 'allocation' && (
          <AllocationSettings
            allocationRules={state.allocationRules}
            indirectCosts={state.indirectCosts}
            monthlyData={state.monthlyData}
            financialBasic={state.financialBasic}
            onUpdateRules={handleUpdateRules}
            onUpdateIndirectCosts={handleUpdateIndirectCosts}
          />
        )}
        {page === 'department' && (
          <DepartmentProfitabilityPage
            monthlyData={state.monthlyData}
            directCosts={state.directCosts}
            indirectCosts={state.indirectCosts}
            allocationRules={state.allocationRules}
            financialBasic={state.financialBasic}
            onUpdateDirectCosts={handleUpdateDirectCosts}
          />
        )}
        {page === 'patient' && (
          <PatientAnalysis
            monthlyData={state.monthlyData}
            staffCount={state.staffCount}
            equipment={state.equipment}
            financialBasic={state.financialBasic}
            workDays={workDays}
          />
        )}
        {page === 'action' && (
          <ActionPlan
            monthlyData={state.monthlyData}
            staffCount={state.staffCount}
            equipment={state.equipment}
            financialBasic={state.financialBasic}
            directCosts={state.directCosts}
            indirectCosts={state.indirectCosts}
            allocationRules={state.allocationRules}
            workDays={workDays}
          />
        )}
        {page === 'settings' && (
          <SettingsPage state={state} setState={setState} />
        )}
      </main>
    </div>
  );
}

function SettingsPage({ state, setState }: { state: AppState; setState: React.Dispatch<React.SetStateAction<AppState>> }) {
  const { clinicInfo, equipment, staffCount, financialBasic, targets } = state;

  const numInput = (value: number | '', onChange: (v: number | '') => void) => (
    <input
      type="number"
      className="form-input"
      value={value}
      onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
    />
  );

  const updateTarget = (key: keyof MonthlyTargets, value: number) => {
    setState(prev => ({ ...prev, targets: { ...prev.targets, [key]: value } }));
  };

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">医院設定</h2>
      </div>

      <div className="card">
        <div className="card-title" style={{ marginBottom: 16 }}>基本情報</div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">医院名</label>
            <input className="form-input" value={clinicInfo.clinicName}
              onChange={e => setState(prev => ({ ...prev, clinicInfo: { ...prev.clinicInfo, clinicName: e.target.value } }))} />
          </div>
          <div className="form-group">
            <label className="form-label">所在地</label>
            <input className="form-input" value={clinicInfo.location}
              onChange={e => setState(prev => ({ ...prev, clinicInfo: { ...prev.clinicInfo, location: e.target.value } }))} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">開業年</label>
            {numInput(clinicInfo.foundedYear, v => setState(prev => ({ ...prev, clinicInfo: { ...prev.clinicInfo, foundedYear: v } })))}
          </div>
          <div className="form-group">
            <label className="form-label">法人形態</label>
            <select className="form-input" value={clinicInfo.corporateType}
              onChange={e => setState(prev => ({ ...prev, clinicInfo: { ...prev.clinicInfo, corporateType: e.target.value as 'individual' | 'corporation' } }))}>
              <option value="individual">個人</option>
              <option value="corporation">医療法人</option>
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">月間診療日数</label>
            {numInput(clinicInfo.monthlyWorkDays, v => setState(prev => ({ ...prev, clinicInfo: { ...prev.clinicInfo, monthlyWorkDays: v } })))}
          </div>
          <div className="form-group">
            <label className="form-label">診療時間</label>
            <input className="form-input" value={clinicInfo.workHours}
              onChange={e => setState(prev => ({ ...prev, clinicInfo: { ...prev.clinicInfo, workHours: e.target.value } }))} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title" style={{ marginBottom: 16 }}>設備</div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">ユニット台数</label>
            {numInput(equipment.unitCount, v => setState(prev => ({ ...prev, equipment: { ...prev.equipment, unitCount: v } })))}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
          {([
            ['hasOperationRoom', 'オペ室'],
            ['hasCT', 'CT'],
            ['hasMicroscope', 'マイクロスコープ'],
            ['hasCADCAM', 'CAD/CAM'],
            ['hasHomeVisit', '訪問診療'],
          ] as [keyof typeof equipment, string][]).map(([key, label]) => (
            <label key={key} className="form-checkbox">
              <input type="checkbox" checked={equipment[key] as boolean}
                onChange={e => setState(prev => ({ ...prev, equipment: { ...prev.equipment, [key]: e.target.checked } }))} />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title" style={{ marginBottom: 16 }}>人員構成</div>
        {([
          ['歯科医師', 'dentistFullTime', 'dentistPartTime'],
          ['歯科衛生士', 'hygienistFullTime', 'hygienistPartTime'],
          ['歯科助手', 'assistantFullTime', 'assistantPartTime'],
          ['受付', 'receptionFullTime', 'receptionPartTime'],
        ] as [string, keyof typeof staffCount, keyof typeof staffCount][]).map(([label, ftKey, ptKey]) => (
          <div key={label} className="staff-row">
            <div className="staff-label">{label}</div>
            <div className="staff-input-group">
              {numInput(staffCount[ftKey] as number | '', v => setState(prev => ({ ...prev, staffCount: { ...prev.staffCount, [ftKey]: v } })))}
              <span>常勤</span>
            </div>
            <div className="staff-input-group">
              {numInput(staffCount[ptKey] as number | '', v => setState(prev => ({ ...prev, staffCount: { ...prev.staffCount, [ptKey]: v } })))}
              <span>非常勤</span>
            </div>
          </div>
        ))}
        <div style={{ marginTop: 12, display: 'flex', gap: 16 }}>
          <label className="form-checkbox">
            <input type="checkbox" checked={staffCount.hasOfficeManager}
              onChange={e => setState(prev => ({ ...prev, staffCount: { ...prev.staffCount, hasOfficeManager: e.target.checked } }))} />
            事務長あり
          </label>
          <label className="form-checkbox">
            <input type="checkbox" checked={staffCount.hasTechnician}
              onChange={e => setState(prev => ({ ...prev, staffCount: { ...prev.staffCount, hasTechnician: e.target.checked } }))} />
            技工士あり
          </label>
        </div>
      </div>

      <div className="card">
        <div className="card-title" style={{ marginBottom: 16 }}>財務情報（月額）</div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">人件費</label>
            {numInput(financialBasic.laborCost, v => setState(prev => ({ ...prev, financialBasic: { ...prev.financialBasic, laborCost: v } })))}
          </div>
          <div className="form-group">
            <label className="form-label">材料費</label>
            {numInput(financialBasic.materialCost, v => setState(prev => ({ ...prev, financialBasic: { ...prev.financialBasic, materialCost: v } })))}
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">家賃</label>
            {numInput(financialBasic.rent, v => setState(prev => ({ ...prev, financialBasic: { ...prev.financialBasic, rent: v } })))}
          </div>
          <div className="form-group">
            <label className="form-label">広告費</label>
            {numInput(financialBasic.advertisingCost, v => setState(prev => ({ ...prev, financialBasic: { ...prev.financialBasic, advertisingCost: v } })))}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">借入返済額</label>
          {numInput(financialBasic.loanRepayment, v => setState(prev => ({ ...prev, financialBasic: { ...prev.financialBasic, loanRepayment: v } })))}
        </div>
      </div>

      {/* 目標値設定 */}
      <div className="card">
        <div className="card-title" style={{ marginBottom: 16 }}>目標値設定</div>
        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
          ダッシュボードで目標との比較表示に使用されます。
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">目標月商（円）</label>
            <input type="number" className="form-input" value={targets.monthlyRevenue}
              onChange={e => updateTarget('monthlyRevenue', Number(e.target.value) || 0)} />
          </div>
          <div className="form-group">
            <label className="form-label">目標自費率（%）</label>
            <input type="number" className="form-input" value={targets.selfPayRatio}
              onChange={e => updateTarget('selfPayRatio', Number(e.target.value) || 0)} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">目標新患数（人/月）</label>
            <input type="number" className="form-input" value={targets.newPatients}
              onChange={e => updateTarget('newPatients', Number(e.target.value) || 0)} />
          </div>
          <div className="form-group">
            <label className="form-label">目標再来率（%）</label>
            <input type="number" className="form-input" value={targets.returnRate}
              onChange={e => updateTarget('returnRate', Number(e.target.value) || 0)} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">目標人件費率（%）</label>
            <input type="number" className="form-input" value={targets.laborCostRatio}
              onChange={e => updateTarget('laborCostRatio', Number(e.target.value) || 0)} />
          </div>
          <div className="form-group">
            <label className="form-label">目標メンテ移行率（%）</label>
            <input type="number" className="form-input" value={targets.maintenanceTransitionRate}
              onChange={e => updateTarget('maintenanceTransitionRate', Number(e.target.value) || 0)} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
