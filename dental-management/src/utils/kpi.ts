import type { MonthlyData, MonthlyKPI, StaffCount, Equipment, FinancialBasic } from '../types';
export type { MonthlyKPI } from '../types';

const toNum = (v: number | ''): number => (v === '' ? 0 : v);

export const calculateFTE = (staff: StaffCount) => {
  const dentistFTE = toNum(staff.dentistFullTime) + toNum(staff.dentistPartTime) * 0.5;
  const hygienistFTE = toNum(staff.hygienistFullTime) + toNum(staff.hygienistPartTime) * 0.5;
  const assistantFTE = toNum(staff.assistantFullTime) + toNum(staff.assistantPartTime) * 0.5;
  const receptionFTE = toNum(staff.receptionFullTime) + toNum(staff.receptionPartTime) * 0.5;
  return { dentistFTE, hygienistFTE, assistantFTE, receptionFTE, totalFTE: dentistFTE + hygienistFTE + assistantFTE + receptionFTE };
};

export const calculateKPI = (
  data: MonthlyData,
  staff: StaffCount,
  equipment: Equipment,
  financial: FinancialBasic,
  workDays: number
): MonthlyKPI => {
  const fte = calculateFTE(staff);
  const unitCount = toNum(equipment.unitCount) || 1;
  const laborCost = toNum(financial.laborCost);
  const materialCost = toNum(financial.materialCost);
  const workHoursPerDay = 8;
  const totalWorkHours = workDays * workHoursPerDay;

  const selfPayRatio = data.totalRevenue > 0
    ? (data.selfPayRevenue / data.totalRevenue) * 100
    : 0;

  const returnRate = data.totalPatients > 0
    ? (data.returnPatients / data.totalPatients) * 100
    : 0;

  const cancelRate = data.appointmentCount > 0
    ? (data.cancelCount / data.appointmentCount) * 100
    : 0;

  const maintenanceTransitionRate = data.totalPatients > 0
    ? (data.maintenancePatients / data.totalPatients) * 100
    : 0;

  const materialCostRatio = data.totalRevenue > 0
    ? (materialCost / data.totalRevenue) * 100
    : 0;

  const uniquePatients = data.uniquePatients || Math.round(data.totalPatients * 0.65);
  const discontinuedPatients = data.discontinuedPatients || 0;
  const discontinuedRate = uniquePatients > 0 ? (discontinuedPatients / uniquePatients) * 100 : 0;

  const maintenanceRevenue = data.maintenanceRevenue || Math.round(data.insuranceRevenue * 0.2);
  const homeVisitRevenue = data.homeVisitRevenue || 0;

  return {
    yearMonth: data.yearMonth,
    monthlyRevenue: data.totalRevenue,
    insuranceRevenue: data.insuranceRevenue,
    selfPayRevenue: data.selfPayRevenue,
    selfPayRatio,
    totalPatients: data.totalPatients,
    newPatients: data.newPatients,
    returnRate,
    cancelRate,
    revenuePerUnit: data.totalRevenue / unitCount,
    revenuePerDentist: fte.dentistFTE > 0 ? data.totalRevenue / fte.dentistFTE : 0,
    revenuePerHygienist: fte.hygienistFTE > 0 ? (maintenanceRevenue + data.insuranceRevenue * 0.3) / fte.hygienistFTE : 0,
    laborCostRatio: data.totalRevenue > 0 ? (laborCost / data.totalRevenue) * 100 : 0,
    maintenanceTransitionRate,
    revenuePerHour: totalWorkHours > 0 ? data.totalRevenue / totalWorkHours : 0,
    materialCostRatio,
    uniquePatients,
    discontinuedRate,
    maintenanceRevenue,
    homeVisitRevenue,
  };
};

// 業界平均ベンチマーク
export const BENCHMARKS = {
  selfPayRatio: 20,
  returnRate: 80,
  cancelRate: 10,
  laborCostRatio: 25,
  revenuePerUnit: 1500000,
  newPatientsMin: 20,
  maintenanceTransitionRate: 30,
  materialCostRatio: 8,
  grossProfitRate: 70,
  operatingProfitRate: 20,
  discontinuedRate: 5,
};

export const formatCurrency = (value: number): string => {
  if (Math.abs(value) >= 10000) {
    return `${(value / 10000).toFixed(1)}万円`;
  }
  return `${value.toLocaleString()}円`;
};

export const formatPercent = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

export const formatNumber = (value: number): string => {
  return value.toLocaleString();
};
