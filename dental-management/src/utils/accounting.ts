import type {
  DirectCost, IndirectCost, AllocationRule, Department,
  DepartmentProfitability, AccountingPL, MonthlyData, FinancialBasic
} from '../types';

const DEPARTMENTS: Department[] = ['insurance', 'selfPay', 'maintenance', 'homeVisit'];

// 部門別売上を取得
export const getDepartmentRevenue = (data: MonthlyData): Record<Department, number> => {
  const maintenanceRev = data.maintenanceRevenue || Math.round(data.insuranceRevenue * 0.2);
  const homeVisitRev = data.homeVisitRevenue || 0;
  const pureInsurance = data.insuranceRevenue - maintenanceRev - homeVisitRev;

  return {
    insurance: Math.max(0, pureInsurance),
    selfPay: data.selfPayRevenue,
    maintenance: maintenanceRev,
    homeVisit: homeVisitRev,
  };
};

// 部門別直接原価合計
export const getDepartmentDirectCost = (
  directCosts: DirectCost[],
  yearMonth: string
): Record<Department, number> => {
  const result: Record<Department, number> = { insurance: 0, selfPay: 0, maintenance: 0, homeVisit: 0 };

  directCosts
    .filter(dc => dc.yearMonth === yearMonth)
    .forEach(dc => {
      result[dc.department] = dc.labFee + dc.directMaterial + dc.outsourcing + dc.otherDirect;
    });

  return result;
};

// 間接費合計
export const getTotalIndirectCost = (ic: IndirectCost): number => {
  return ic.receptionLabor + ic.commonStaffLabor + ic.rent + ic.utilities +
    ic.communication + ic.lease + ic.systemFee + ic.advertising +
    ic.consumables + ic.repair + ic.depreciation + ic.miscellaneous;
};

// 間接費の個別項目金額を取得
export const getIndirectCostValue = (ic: IndirectCost, key: keyof Omit<IndirectCost, 'yearMonth'>): number => {
  return ic[key] as number;
};

// 配賦計算
export const calculateAllocation = (
  indirectCost: IndirectCost,
  rules: AllocationRule[]
): Record<Department, number> => {
  const result: Record<Department, number> = { insurance: 0, selfPay: 0, maintenance: 0, homeVisit: 0 };

  rules.forEach(rule => {
    const costAmount = getIndirectCostValue(indirectCost, rule.costItem);
    const totalDriver = Object.values(rule.driverValues).reduce((a, b) => a + b, 0);

    if (totalDriver === 0) return;

    DEPARTMENTS.forEach(dept => {
      const ratio = rule.driverValues[dept] / totalDriver;
      result[dept] += costAmount * ratio;
    });
  });

  return result;
};

// 配賦レート計算
export const calculateAllocationRate = (
  rule: AllocationRule,
  indirectCost: IndirectCost
): { rate: number; allocated: Record<Department, number> } => {
  const costAmount = getIndirectCostValue(indirectCost, rule.costItem);
  const totalDriver = Object.values(rule.driverValues).reduce((a, b) => a + b, 0);
  const rate = totalDriver > 0 ? costAmount / totalDriver : 0;

  const allocated: Record<Department, number> = { insurance: 0, selfPay: 0, maintenance: 0, homeVisit: 0 };
  DEPARTMENTS.forEach(dept => {
    allocated[dept] = totalDriver > 0 ? costAmount * (rule.driverValues[dept] / totalDriver) : 0;
  });

  return { rate, allocated };
};

// 部門別採算計算
export const calculateDepartmentProfitability = (
  data: MonthlyData,
  directCosts: DirectCost[],
  indirectCost: IndirectCost | undefined,
  rules: AllocationRule[]
): DepartmentProfitability[] => {
  const revenue = getDepartmentRevenue(data);
  const directCostByDept = getDepartmentDirectCost(directCosts, data.yearMonth);
  const allocation = indirectCost
    ? calculateAllocation(indirectCost, rules)
    : { insurance: 0, selfPay: 0, maintenance: 0, homeVisit: 0 };

  return DEPARTMENTS.map(dept => {
    const rev = revenue[dept];
    const dc = directCostByDept[dept];
    const grossProfit = rev - dc;
    const grossProfitRate = rev > 0 ? (grossProfit / rev) * 100 : 0;
    const allocatedCost = allocation[dept];
    const operatingProfit = grossProfit - allocatedCost;
    const operatingProfitRate = rev > 0 ? (operatingProfit / rev) * 100 : 0;

    return {
      department: dept,
      revenue: rev,
      directCost: dc,
      grossProfit,
      grossProfitRate,
      allocatedIndirectCost: allocatedCost,
      operatingProfit,
      operatingProfitRate,
    };
  });
};

// 会計ベースPL計算
export const calculateAccountingPL = (
  data: MonthlyData,
  directCosts: DirectCost[],
  indirectCost: IndirectCost | undefined,
  financial: FinancialBasic
): AccountingPL => {
  const toNum = (v: number | ''): number => (v === '' ? 0 : v);

  const revenue = data.totalRevenue;

  // 直接原価合計
  const totalDirectCost = directCosts
    .filter(dc => dc.yearMonth === data.yearMonth)
    .reduce((sum, dc) => sum + dc.labFee + dc.directMaterial + dc.outsourcing + dc.otherDirect, 0);

  // 直接原価が未入力の場合は材料費を使用
  const cogs = totalDirectCost > 0 ? totalDirectCost : toNum(financial.materialCost);
  const grossProfit = revenue - cogs;
  const grossProfitRate = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

  // 間接費合計
  const totalIndirect = indirectCost ? getTotalIndirectCost(indirectCost) : (
    toNum(financial.laborCost) + toNum(financial.rent) + toNum(financial.advertisingCost)
  );

  const sgaExpenses = totalIndirect;
  const operatingProfit = grossProfit - sgaExpenses;
  const operatingProfitRate = revenue > 0 ? (operatingProfit / revenue) * 100 : 0;

  return {
    yearMonth: data.yearMonth,
    revenue,
    cogs,
    grossProfit,
    grossProfitRate,
    sgaExpenses,
    operatingProfit,
    operatingProfitRate,
  };
};

// デフォルトの間接費を財務基本情報から作成
export const createDefaultIndirectCost = (yearMonth: string, financial: FinancialBasic): IndirectCost => {
  const toNum = (v: number | ''): number => (v === '' ? 0 : v);
  return {
    yearMonth,
    receptionLabor: 0,
    commonStaffLabor: toNum(financial.laborCost),
    rent: toNum(financial.rent),
    utilities: 0,
    communication: 0,
    lease: 0,
    systemFee: 0,
    advertising: toNum(financial.advertisingCost),
    consumables: 0,
    repair: 0,
    depreciation: 0,
    miscellaneous: 0,
  };
};
