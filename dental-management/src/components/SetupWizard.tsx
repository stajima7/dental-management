import { useState } from 'react';
import {
  type ClinicInfo, type Equipment, type StaffCount, type FinancialBasic,
  type ClinicType, CLINIC_TYPE_LABELS,
} from '../types';

interface Props {
  clinicInfo: ClinicInfo;
  equipment: Equipment;
  staffCount: StaffCount;
  financialBasic: FinancialBasic;
  currentStep: number;
  onUpdateClinicInfo: (info: ClinicInfo) => void;
  onUpdateEquipment: (eq: Equipment) => void;
  onUpdateStaffCount: (sc: StaffCount) => void;
  onUpdateFinancialBasic: (fb: FinancialBasic) => void;
  onStepChange: (step: number) => void;
  onComplete: () => void;
}

const STEPS = ['医院情報', '設備・規模', '人員構成', '財務情報', '確認'];

export default function SetupWizard({
  clinicInfo, equipment, staffCount, financialBasic,
  currentStep, onUpdateClinicInfo, onUpdateEquipment,
  onUpdateStaffCount, onUpdateFinancialBasic, onStepChange, onComplete,
}: Props) {
  const [errors, setErrors] = useState<string[]>([]);

  const validateStep = (step: number): boolean => {
    const errs: string[] = [];
    if (step === 0) {
      if (!clinicInfo.clinicName) errs.push('医院名を入力してください');
    }
    if (step === 1) {
      if (!equipment.unitCount) errs.push('ユニット台数を入力してください');
    }
    setErrors(errs);
    return errs.length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < STEPS.length - 1) {
        onStepChange(currentStep + 1);
      } else {
        onComplete();
      }
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) onStepChange(currentStep - 1);
  };

  const toggleClinicType = (type: ClinicType) => {
    const types = clinicInfo.clinicType.includes(type)
      ? clinicInfo.clinicType.filter(t => t !== type)
      : [...clinicInfo.clinicType, type];
    onUpdateClinicInfo({ ...clinicInfo, clinicType: types });
  };

  const numInput = (value: number | '', onChange: (v: number | '') => void, placeholder?: string) => (
    <input
      type="number"
      className="form-input"
      value={value}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
    />
  );

  return (
    <div className="setup-container">
      {/* Progress */}
      <div className="setup-progress">
        {STEPS.map((label, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
            {i > 0 && <div className={`step-connector ${i <= currentStep ? 'completed' : ''}`} />}
            <div
              className={`step-number ${i === currentStep ? 'active' : i < currentStep ? 'completed' : ''}`}
              onClick={() => i < currentStep && onStepChange(i)}
              style={{ cursor: i < currentStep ? 'pointer' : 'default' }}
            >
              {i < currentStep ? '✓' : i + 1}
            </div>
            <span className={`step-label ${i === currentStep ? 'active' : ''}`}>{label}</span>
          </div>
        ))}
      </div>

      {errors.length > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 14, color: '#dc2626' }}>
          {errors.map((e, i) => <div key={i}>{e}</div>)}
        </div>
      )}

      <div className="card">
        {/* Step 0: 医院情報 */}
        {currentStep === 0 && (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>医院基本情報</h2>
            <div className="form-group">
              <label className="form-label">医院名 *</label>
              <input className="form-input" value={clinicInfo.clinicName}
                onChange={e => onUpdateClinicInfo({ ...clinicInfo, clinicName: e.target.value })}
                placeholder="○○歯科クリニック" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">所在地</label>
                <input className="form-input" value={clinicInfo.location}
                  onChange={e => onUpdateClinicInfo({ ...clinicInfo, location: e.target.value })}
                  placeholder="東京都渋谷区" />
              </div>
              <div className="form-group">
                <label className="form-label">開業年</label>
                {numInput(clinicInfo.foundedYear, v => onUpdateClinicInfo({ ...clinicInfo, foundedYear: v }), '2010')}
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">月間診療日数</label>
                {numInput(clinicInfo.monthlyWorkDays, v => onUpdateClinicInfo({ ...clinicInfo, monthlyWorkDays: v }), '22')}
              </div>
              <div className="form-group">
                <label className="form-label">診療時間</label>
                <input className="form-input" value={clinicInfo.workHours}
                  onChange={e => onUpdateClinicInfo({ ...clinicInfo, workHours: e.target.value })}
                  placeholder="9:00-18:00" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">法人形態</label>
              <select className="form-input" value={clinicInfo.corporateType}
                onChange={e => onUpdateClinicInfo({ ...clinicInfo, corporateType: e.target.value as 'individual' | 'corporation' })}>
                <option value="individual">個人</option>
                <option value="corporation">医療法人</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">医院タイプ（複数選択可）</label>
              <div className="clinic-type-grid">
                {(Object.entries(CLINIC_TYPE_LABELS) as [ClinicType, string][]).map(([type, label]) => (
                  <button
                    key={type}
                    className={`clinic-type-btn ${clinicInfo.clinicType.includes(type) ? 'selected' : ''}`}
                    onClick={() => toggleClinicType(type)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Step 1: 設備 */}
        {currentStep === 1 && (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>設備・規模</h2>
            <div className="form-group">
              <label className="form-label">ユニット台数 *</label>
              {numInput(equipment.unitCount, v => onUpdateEquipment({ ...equipment, unitCount: v }), '5')}
            </div>
            <div className="form-group">
              <label className="form-label">設備</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                {([
                  ['hasOperationRoom', 'オペ室'],
                  ['hasCT', 'CT'],
                  ['hasMicroscope', 'マイクロスコープ'],
                  ['hasCADCAM', 'セレック/CAD/CAM'],
                  ['hasHomeVisit', '訪問診療'],
                ] as [keyof Equipment, string][]).map(([key, label]) => (
                  <label key={key} className="form-checkbox">
                    <input type="checkbox" checked={equipment[key] as boolean}
                      onChange={e => onUpdateEquipment({ ...equipment, [key]: e.target.checked })} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Step 2: 人員構成 */}
        {currentStep === 2 && (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>人員構成</h2>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
              各職種の常勤・非常勤人数を入力してください
            </div>
            <div className="staff-row" style={{ borderBottom: '2px solid var(--gray-300)' }}>
              <div className="staff-label">職種</div>
              <div style={{ fontSize: 13, fontWeight: 600, textAlign: 'center' }}>常勤</div>
              <div style={{ fontSize: 13, fontWeight: 600, textAlign: 'center' }}>非常勤</div>
            </div>
            {([
              ['歯科医師', 'dentistFullTime', 'dentistPartTime'],
              ['歯科衛生士', 'hygienistFullTime', 'hygienistPartTime'],
              ['歯科助手', 'assistantFullTime', 'assistantPartTime'],
              ['受付', 'receptionFullTime', 'receptionPartTime'],
            ] as [string, keyof StaffCount, keyof StaffCount][]).map(([label, ftKey, ptKey]) => (
              <div key={label} className="staff-row">
                <div className="staff-label">{label}</div>
                <div className="staff-input-group">
                  {numInput(staffCount[ftKey] as number | '', v => onUpdateStaffCount({ ...staffCount, [ftKey]: v }))}
                  <span>人</span>
                </div>
                <div className="staff-input-group">
                  {numInput(staffCount[ptKey] as number | '', v => onUpdateStaffCount({ ...staffCount, [ptKey]: v }))}
                  <span>人</span>
                </div>
              </div>
            ))}
            <div style={{ marginTop: 16, display: 'flex', gap: 16 }}>
              <label className="form-checkbox">
                <input type="checkbox" checked={staffCount.hasOfficeManager}
                  onChange={e => onUpdateStaffCount({ ...staffCount, hasOfficeManager: e.target.checked })} />
                事務長あり
              </label>
              <label className="form-checkbox">
                <input type="checkbox" checked={staffCount.hasTechnician}
                  onChange={e => onUpdateStaffCount({ ...staffCount, hasTechnician: e.target.checked })} />
                技工士あり
              </label>
            </div>
          </>
        )}

        {/* Step 3: 財務情報 */}
        {currentStep === 3 && (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>財務基本情報</h2>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
              月間の概算値を入力してください（後から変更可能です）
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">月商（円）</label>
                {numInput(financialBasic.monthlyRevenue, v => onUpdateFinancialBasic({ ...financialBasic, monthlyRevenue: v }), '7000000')}
              </div>
              <div className="form-group">
                <label className="form-label">自費比率（%）</label>
                {numInput(financialBasic.selfPayRatio, v => onUpdateFinancialBasic({ ...financialBasic, selfPayRatio: v }), '20')}
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">人件費（円/月）</label>
                {numInput(financialBasic.laborCost, v => onUpdateFinancialBasic({ ...financialBasic, laborCost: v }), '1800000')}
              </div>
              <div className="form-group">
                <label className="form-label">家賃（円/月）</label>
                {numInput(financialBasic.rent, v => onUpdateFinancialBasic({ ...financialBasic, rent: v }), '500000')}
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">材料費（円/月）</label>
                {numInput(financialBasic.materialCost, v => onUpdateFinancialBasic({ ...financialBasic, materialCost: v }), '400000')}
              </div>
              <div className="form-group">
                <label className="form-label">広告費（円/月）</label>
                {numInput(financialBasic.advertisingCost, v => onUpdateFinancialBasic({ ...financialBasic, advertisingCost: v }), '100000')}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">借入返済額（円/月）</label>
              {numInput(financialBasic.loanRepayment, v => onUpdateFinancialBasic({ ...financialBasic, loanRepayment: v }), '200000')}
            </div>
          </>
        )}

        {/* Step 4: 確認 */}
        {currentStep === 4 && (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>入力内容の確認</h2>
            <div style={{ display: 'grid', gap: 16 }}>
              <div style={{ background: 'var(--gray-50)', padding: 16, borderRadius: 8 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: 'var(--primary)' }}>医院情報</h3>
                <div style={{ fontSize: 14, lineHeight: 2 }}>
                  <div><strong>医院名:</strong> {clinicInfo.clinicName || '-'}</div>
                  <div><strong>所在地:</strong> {clinicInfo.location || '-'}</div>
                  <div><strong>開業年:</strong> {clinicInfo.foundedYear || '-'}</div>
                  <div><strong>診療日数:</strong> {clinicInfo.monthlyWorkDays || '-'}日/月</div>
                  <div><strong>法人形態:</strong> {clinicInfo.corporateType === 'corporation' ? '医療法人' : '個人'}</div>
                </div>
              </div>
              <div style={{ background: 'var(--gray-50)', padding: 16, borderRadius: 8 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: 'var(--primary)' }}>設備</h3>
                <div style={{ fontSize: 14, lineHeight: 2 }}>
                  <div><strong>ユニット:</strong> {equipment.unitCount}台</div>
                  <div><strong>設備:</strong> {[
                    equipment.hasOperationRoom && 'オペ室',
                    equipment.hasCT && 'CT',
                    equipment.hasMicroscope && 'マイクロ',
                    equipment.hasCADCAM && 'CAD/CAM',
                    equipment.hasHomeVisit && '訪問診療',
                  ].filter(Boolean).join('、') || 'なし'}</div>
                </div>
              </div>
              <div style={{ background: 'var(--gray-50)', padding: 16, borderRadius: 8 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: 'var(--primary)' }}>人員構成</h3>
                <div style={{ fontSize: 14, lineHeight: 2 }}>
                  <div><strong>歯科医師:</strong> 常勤{staffCount.dentistFullTime || 0}名 / 非常勤{staffCount.dentistPartTime || 0}名</div>
                  <div><strong>歯科衛生士:</strong> 常勤{staffCount.hygienistFullTime || 0}名 / 非常勤{staffCount.hygienistPartTime || 0}名</div>
                  <div><strong>歯科助手:</strong> 常勤{staffCount.assistantFullTime || 0}名 / 非常勤{staffCount.assistantPartTime || 0}名</div>
                  <div><strong>受付:</strong> 常勤{staffCount.receptionFullTime || 0}名 / 非常勤{staffCount.receptionPartTime || 0}名</div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Navigation */}
        <div className="btn-group">
          {currentStep > 0 && (
            <button className="btn btn-secondary" onClick={handlePrev}>戻る</button>
          )}
          <button className="btn btn-primary" onClick={handleNext}>
            {currentStep === STEPS.length - 1 ? '設定を完了してダッシュボードへ' : '次へ'}
          </button>
        </div>
      </div>
    </div>
  );
}
