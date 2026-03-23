import {
  type AppState,
  INITIAL_CLINIC_INFO,
  INITIAL_EQUIPMENT,
  INITIAL_STAFF_COUNT,
  INITIAL_FINANCIAL_BASIC,
  INITIAL_TARGETS,
  INITIAL_ALLOCATION_RULES,
} from '../types';

const STORAGE_KEY = 'dental-management-app';

export const getInitialState = (): AppState => ({
  clinicInfo: INITIAL_CLINIC_INFO,
  equipment: INITIAL_EQUIPMENT,
  staffCount: INITIAL_STAFF_COUNT,
  financialBasic: INITIAL_FINANCIAL_BASIC,
  monthlyData: [],
  isSetupComplete: false,
  currentStep: 0,
  directCosts: [],
  indirectCosts: [],
  allocationRules: INITIAL_ALLOCATION_RULES,
  departmentDriverValues: [],
  targets: INITIAL_TARGETS,
});

export const loadState = (): AppState => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // マイグレーション: 新フィールドのデフォルト値を設定
      return {
        ...getInitialState(),
        ...parsed,
        allocationRules: parsed.allocationRules || INITIAL_ALLOCATION_RULES,
        targets: parsed.targets || INITIAL_TARGETS,
        directCosts: parsed.directCosts || [],
        indirectCosts: parsed.indirectCosts || [],
        departmentDriverValues: parsed.departmentDriverValues || [],
      };
    }
  } catch {
    // ignore
  }
  return getInitialState();
};

export const saveState = (state: AppState): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const clearState = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};
