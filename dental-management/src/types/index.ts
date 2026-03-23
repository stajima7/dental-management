// 医院基本情報
export interface ClinicInfo {
  clinicName: string;
  location: string;
  foundedYear: number | '';
  monthlyWorkDays: number | '';
  workHours: string;
  clinicType: ClinicType[];
  corporateType: 'individual' | 'corporation';
}

export type ClinicType = 'insurance' | 'self-pay' | 'maintenance' | 'home-visit' | 'pediatric' | 'general';

export const CLINIC_TYPE_LABELS: Record<ClinicType, string> = {
  insurance: '保険中心',
  'self-pay': '自費強化',
  maintenance: 'メンテ重視',
  'home-visit': '訪問あり',
  pediatric: '小児中心',
  general: '総合診療型',
};

// 設備情報
export interface Equipment {
  unitCount: number | '';
  hasOperationRoom: boolean;
  hasCT: boolean;
  hasMicroscope: boolean;
  hasCADCAM: boolean;
  hasHomeVisit: boolean;
}

// 人員構成
export interface StaffCount {
  dentistFullTime: number | '';
  dentistPartTime: number | '';
  hygienistFullTime: number | '';
  hygienistPartTime: number | '';
  assistantFullTime: number | '';
  assistantPartTime: number | '';
  receptionFullTime: number | '';
  receptionPartTime: number | '';
  hasOfficeManager: boolean;
  hasTechnician: boolean;
}

// 財務基本情報
export interface FinancialBasic {
  monthlyRevenue: number | '';
  rent: number | '';
  laborCost: number | '';
  materialCost: number | '';
  advertisingCost: number | '';
  loanRepayment: number | '';
  selfPayRatio: number | '';
}

// 月次データ（CSV取込）
export interface MonthlyData {
  yearMonth: string; // YYYY-MM
  totalRevenue: number;
  insuranceRevenue: number;
  selfPayRevenue: number;
  totalPatients: number;
  newPatients: number;
  returnPatients: number;
  cancelCount: number;
  appointmentCount: number;
  maintenancePatients: number;
  insurancePoints: number;
  // 追加: 部門別データ
  maintenanceRevenue?: number;
  homeVisitRevenue?: number;
  homeVisitPatients?: number;
  uniquePatients?: number; // 実患者数
  discontinuedPatients?: number; // 中断患者数
}

// KPI
export interface MonthlyKPI {
  yearMonth: string;
  monthlyRevenue: number;
  insuranceRevenue: number;
  selfPayRevenue: number;
  selfPayRatio: number;
  totalPatients: number;
  newPatients: number;
  returnRate: number;
  cancelRate: number;
  revenuePerUnit: number;
  revenuePerDentist: number;
  revenuePerHygienist: number;
  laborCostRatio: number;
  maintenanceTransitionRate: number;
  revenuePerHour: number;
  // 追加KPI
  materialCostRatio: number;
  uniquePatients: number;
  discontinuedRate: number;
  maintenanceRevenue: number;
  homeVisitRevenue: number;
}

// AI診断結果
export interface AIInsight {
  id: string;
  category: 'positive' | 'warning' | 'critical';
  area: 'revenue' | 'patient' | 'staff' | 'cost' | 'equipment' | 'department' | 'allocation';
  title: string;
  description: string;
  suggestion: string;
  impact: 'high' | 'medium' | 'low';
  difficulty: 'easy' | 'medium' | 'hard';
  priority: number;
  cause?: string; // 原因仮説
  expectedImpact?: string; // 期待インパクト
}

// ===== 管理会計 =====

// 診療部門
export type Department = 'insurance' | 'selfPay' | 'maintenance' | 'homeVisit';

export const DEPARTMENT_LABELS: Record<Department, string> = {
  insurance: '保険診療',
  selfPay: '自費診療',
  maintenance: 'メンテナンス',
  homeVisit: '訪問診療',
};

// 直接原価項目
export interface DirectCost {
  yearMonth: string;
  department: Department;
  labFee: number;           // 技工料
  directMaterial: number;   // 直接材料費
  outsourcing: number;      // 外注費
  otherDirect: number;      // その他直接費
}

// 間接費項目
export interface IndirectCost {
  yearMonth: string;
  receptionLabor: number;     // 受付人件費
  commonStaffLabor: number;   // 共通スタッフ人件費
  rent: number;               // 家賃
  utilities: number;          // 水道光熱費
  communication: number;      // 通信費
  lease: number;              // リース料
  systemFee: number;          // システム利用料
  advertising: number;        // 広告宣伝費
  consumables: number;        // 消耗品費
  repair: number;             // 修繕費
  depreciation: number;       // 減価償却費
  miscellaneous: number;      // 雑費
}

export const INDIRECT_COST_LABELS: Record<keyof Omit<IndirectCost, 'yearMonth'>, string> = {
  receptionLabor: '受付人件費',
  commonStaffLabor: '共通スタッフ人件費',
  rent: '家賃',
  utilities: '水道光熱費',
  communication: '通信費',
  lease: 'リース料',
  systemFee: 'システム利用料',
  advertising: '広告宣伝費',
  consumables: '消耗品費',
  repair: '修繕費',
  depreciation: '減価償却費',
  miscellaneous: '雑費',
};

// コストドライバー
export type CostDriver =
  | 'patientCount'      // 来院患者数
  | 'newPatientCount'   // 新患数
  | 'appointmentCount'  // 予約件数
  | 'workHours'         // 勤務時間
  | 'fte'               // FTE
  | 'unitTime'          // ユニット使用時間
  | 'unitUsage'         // ユニット使用回数
  | 'area'              // 面積
  | 'revenueRatio';     // 売上比率

export const COST_DRIVER_LABELS: Record<CostDriver, string> = {
  patientCount: '来院患者数',
  newPatientCount: '新患数',
  appointmentCount: '予約件数',
  workHours: '勤務時間',
  fte: 'FTE',
  unitTime: 'ユニット使用時間',
  unitUsage: 'ユニット使用回数',
  area: '面積',
  revenueRatio: '売上比率',
};

// 配賦ルール
export interface AllocationRule {
  costItem: keyof Omit<IndirectCost, 'yearMonth'>;
  driver: CostDriver;
  // 各部門のドライバー量（比率）
  driverValues: Record<Department, number>;
  memo?: string;
}

// 部門別ドライバー量入力
export interface DepartmentDriverValues {
  yearMonth: string;
  department: Department;
  patientCount: number;
  newPatientCount: number;
  appointmentCount: number;
  workHours: number;
  fte: number;
  unitTime: number;
  unitUsage: number;
  area: number;
  revenueRatio: number;
}

// 部門別採算結果
export interface DepartmentProfitability {
  department: Department;
  revenue: number;
  directCost: number;
  grossProfit: number;
  grossProfitRate: number;
  allocatedIndirectCost: number;
  operatingProfit: number;
  operatingProfitRate: number;
}

// 会計ベース利益計算
export interface AccountingPL {
  yearMonth: string;
  revenue: number;
  cogs: number;             // 売上原価
  grossProfit: number;       // 売上総利益
  grossProfitRate: number;
  sgaExpenses: number;       // 販管費
  operatingProfit: number;   // 営業利益
  operatingProfitRate: number;
}

// アプリ全体の状態
export interface AppState {
  clinicInfo: ClinicInfo;
  equipment: Equipment;
  staffCount: StaffCount;
  financialBasic: FinancialBasic;
  monthlyData: MonthlyData[];
  isSetupComplete: boolean;
  currentStep: number;
  // 管理会計データ
  directCosts: DirectCost[];
  indirectCosts: IndirectCost[];
  allocationRules: AllocationRule[];
  departmentDriverValues: DepartmentDriverValues[];
  // 目標値
  targets: MonthlyTargets;
}

// 月次目標
export interface MonthlyTargets {
  monthlyRevenue: number;
  selfPayRatio: number;
  newPatients: number;
  returnRate: number;
  laborCostRatio: number;
  revenuePerUnit: number;
  maintenanceTransitionRate: number;
}

export const INITIAL_CLINIC_INFO: ClinicInfo = {
  clinicName: '',
  location: '',
  foundedYear: '',
  monthlyWorkDays: '',
  workHours: '9:00-18:00',
  clinicType: [],
  corporateType: 'individual',
};

export const INITIAL_EQUIPMENT: Equipment = {
  unitCount: '',
  hasOperationRoom: false,
  hasCT: false,
  hasMicroscope: false,
  hasCADCAM: false,
  hasHomeVisit: false,
};

export const INITIAL_STAFF_COUNT: StaffCount = {
  dentistFullTime: '',
  dentistPartTime: '',
  hygienistFullTime: '',
  hygienistPartTime: '',
  assistantFullTime: '',
  assistantPartTime: '',
  receptionFullTime: '',
  receptionPartTime: '',
  hasOfficeManager: false,
  hasTechnician: false,
};

export const INITIAL_FINANCIAL_BASIC: FinancialBasic = {
  monthlyRevenue: '',
  rent: '',
  laborCost: '',
  materialCost: '',
  advertisingCost: '',
  loanRepayment: '',
  selfPayRatio: '',
};

export const INITIAL_TARGETS: MonthlyTargets = {
  monthlyRevenue: 0,
  selfPayRatio: 20,
  newPatients: 20,
  returnRate: 80,
  laborCostRatio: 25,
  revenuePerUnit: 1500000,
  maintenanceTransitionRate: 30,
};

export const INITIAL_ALLOCATION_RULES: AllocationRule[] = [
  { costItem: 'receptionLabor', driver: 'patientCount', driverValues: { insurance: 60, selfPay: 20, maintenance: 15, homeVisit: 5 } },
  { costItem: 'commonStaffLabor', driver: 'revenueRatio', driverValues: { insurance: 60, selfPay: 25, maintenance: 10, homeVisit: 5 } },
  { costItem: 'rent', driver: 'area', driverValues: { insurance: 50, selfPay: 25, maintenance: 20, homeVisit: 5 } },
  { costItem: 'utilities', driver: 'area', driverValues: { insurance: 50, selfPay: 25, maintenance: 20, homeVisit: 5 } },
  { costItem: 'communication', driver: 'revenueRatio', driverValues: { insurance: 50, selfPay: 25, maintenance: 15, homeVisit: 10 } },
  { costItem: 'lease', driver: 'revenueRatio', driverValues: { insurance: 50, selfPay: 30, maintenance: 15, homeVisit: 5 } },
  { costItem: 'systemFee', driver: 'revenueRatio', driverValues: { insurance: 50, selfPay: 25, maintenance: 15, homeVisit: 10 } },
  { costItem: 'advertising', driver: 'newPatientCount', driverValues: { insurance: 50, selfPay: 30, maintenance: 15, homeVisit: 5 } },
  { costItem: 'consumables', driver: 'patientCount', driverValues: { insurance: 50, selfPay: 25, maintenance: 20, homeVisit: 5 } },
  { costItem: 'repair', driver: 'unitUsage', driverValues: { insurance: 50, selfPay: 25, maintenance: 20, homeVisit: 5 } },
  { costItem: 'depreciation', driver: 'revenueRatio', driverValues: { insurance: 50, selfPay: 30, maintenance: 15, homeVisit: 5 } },
  { costItem: 'miscellaneous', driver: 'revenueRatio', driverValues: { insurance: 50, selfPay: 25, maintenance: 15, homeVisit: 10 } },
];
