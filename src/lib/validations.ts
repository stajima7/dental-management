import { z } from "zod"

// ============ 認証 ============
export const registerSchema = z.object({
  name: z.string().min(1, "名前を入力してください").max(100, "名前は100文字以内で入力してください"),
  email: z.string().email("有効なメールアドレスを入力してください"),
  password: z.string().min(8, "パスワードは8文字以上で入力してください").max(100),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "パスワードが一致しません",
  path: ["confirmPassword"],
})

export const loginSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
  password: z.string().min(1, "パスワードを入力してください"),
})

// ============ 医院 ============
export const clinicCreateSchema = z.object({
  clinicName: z.string().min(1, "医院名を入力してください").max(200),
  corporateName: z.string().max(200).optional().nullable(),
  prefecture: z.string().max(10).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  openingYear: z.number().int().min(1900).max(2100).optional().nullable(),
  corporateType: z.enum(["INDIVIDUAL", "CORPORATION"]).default("INDIVIDUAL"),
  clinicType: z.string().optional().default("[]"),
  isHomeVisit: z.boolean().default(false),
})

export const clinicProfileSchema = z.object({
  unitCount: z.number().int().min(0).max(100).default(0),
  activeUnitCount: z.number().int().min(0).max(100).default(0),
  hasCt: z.boolean().default(false),
  hasMicroscope: z.boolean().default(false),
  hasCadcam: z.boolean().default(false),
  hasOperationRoom: z.boolean().default(false),
  fulltimeDentistCount: z.number().int().min(0).max(100).default(0),
  parttimeDentistCount: z.number().int().min(0).max(100).default(0),
  fulltimeHygienistCount: z.number().int().min(0).max(100).default(0),
  parttimeHygienistCount: z.number().int().min(0).max(100).default(0),
  fulltimeAssistantCount: z.number().int().min(0).max(100).default(0),
  parttimeAssistantCount: z.number().int().min(0).max(100).default(0),
  fulltimeReceptionCount: z.number().int().min(0).max(100).default(0),
  parttimeReceptionCount: z.number().int().min(0).max(100).default(0),
  fulltimeTechnicianCount: z.number().int().min(0).max(100).default(0),
  parttimeTechnicianCount: z.number().int().min(0).max(100).default(0),
  hasOfficeManager: z.boolean().default(false),
  clinicDaysPerMonth: z.number().int().min(1).max(31).default(22),
  avgHoursPerDay: z.number().min(1).max(24).default(8),
  avgOvertimeHours: z.number().min(0).max(200).default(0),
})

// ============ 月次データ ============
const yearMonthRegex = /^\d{4}-(0[1-9]|1[0-2])$/
export const yearMonthSchema = z.string().regex(yearMonthRegex, "年月はYYYY-MM形式で入力してください")

export const manualInputSchema = z.object({
  clinicId: z.string().min(1, "医院IDが必要です"),
  yearMonth: yearMonthSchema,
  revenue: z.object({
    insuranceRevenue: z.number().min(0).default(0),
    insurancePoints: z.number().int().min(0).default(0),
    selfPayRevenue: z.number().min(0).default(0),
    maintenanceRevenue: z.number().min(0).default(0),
    homeVisitRevenue: z.number().min(0).default(0),
    retailRevenue: z.number().min(0).default(0),
  }).optional(),
  patients: z.object({
    totalPatientCount: z.number().int().min(0).default(0),
    uniquePatientCount: z.number().int().min(0).default(0),
    newPatientCount: z.number().int().min(0).default(0),
    returnPatientCount: z.number().int().min(0).default(0),
    dropoutCount: z.number().int().min(0).default(0),
    maintenanceTransitionCount: z.number().int().min(0).default(0),
  }).optional(),
  appointments: z.object({
    appointmentCount: z.number().int().min(0).default(0),
    cancelCount: z.number().int().min(0).default(0),
    noShowCount: z.number().int().min(0).default(0),
  }).optional(),
  costs: z.array(z.object({
    costItemCode: z.string().min(1),
    amount: z.number().min(0),
    costLayer: z.enum(["DIRECT", "DIRECT_ASSIGNED", "INDIRECT"]).default("INDIRECT"),
    departmentType: z.string().default("TOTAL"),
  })).optional(),
})

// ============ コスト ============
export const costSaveSchema = z.object({
  clinicId: z.string().min(1, "医院IDが必要です"),
  yearMonth: yearMonthSchema,
  costs: z.array(z.object({
    costItemCode: z.string().min(1, "費目コードが必要です"),
    departmentType: z.string().default("TOTAL"),
    costLayer: z.enum(["DIRECT", "DIRECT_ASSIGNED", "INDIRECT"]).default("INDIRECT"),
    amount: z.number().min(0, "金額は0以上で入力してください"),
    memo: z.string().max(500).optional(),
  })),
})

// ============ 配賦 ============
export const allocationRuleSchema = z.object({
  clinicId: z.string().min(1),
  costItemCode: z.string().min(1),
  allocationTargetType: z.string().min(1),
  driverType: z.string().min(1),
  driverRatio: z.number().min(0).max(100),
  manualOverride: z.boolean().default(false),
})

export const allocationDriverSchema = z.object({
  clinicId: z.string().min(1),
  yearMonth: yearMonthSchema,
  drivers: z.array(z.object({
    driverType: z.string().min(1),
    departmentType: z.string().min(1),
    driverValue: z.number().min(0),
  })),
})

// ============ 目標値 ============
export const targetSchema = z.object({
  monthlyRevenue: z.number().min(0).optional().nullable(),
  selfPayRatio: z.number().min(0).max(100).optional().nullable(),
  newPatients: z.number().int().min(0).optional().nullable(),
  returnRate: z.number().min(0).max(100).optional().nullable(),
  cancelRate: z.number().min(0).max(100).optional().nullable(),
  laborCostRatio: z.number().min(0).max(100).optional().nullable(),
  materialCostRatio: z.number().min(0).max(100).optional().nullable(),
  maintenanceTransitionRate: z.number().min(0).max(100).optional().nullable(),
  grossProfitRate: z.number().min(0).max(100).optional().nullable(),
  operatingProfitRate: z.number().min(0).max(100).optional().nullable(),
  revenuePerUnit: z.number().min(0).optional().nullable(),
  revenuePerActiveUnit: z.number().min(0).optional().nullable(),
  revenuePerDentist: z.number().min(0).optional().nullable(),
  revenuePerHygienist: z.number().min(0).optional().nullable(),
  discontinuedRate: z.number().min(0).max(100).optional().nullable(),
})

// ============ ActionPlan ============
export const actionPlanCreateSchema = z.object({
  clinicId: z.string().min(1),
  insightId: z.string().optional().nullable(),
  title: z.string().min(1, "タイトルを入力してください").max(200),
  description: z.string().min(1, "説明を入力してください").max(2000),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE", "CANCELLED"]).default("TODO"),
  dueDate: z.string().optional().nullable(),
  assignee: z.string().max(100).optional().nullable(),
})

export const actionPlanUpdateSchema = actionPlanCreateSchema.partial().extend({
  id: z.string().min(1),
})

// ============ CSV取込 ============
export const csvImportSchema = z.object({
  clinicId: z.string().min(1, "医院IDが必要です"),
  data: z.array(z.record(z.string(), z.string())).min(1, "データが空です"),
  mapping: z.record(z.string(), z.string()).optional(),
})

// ============ ユーティリティ ============
export type ValidationError = {
  field: string
  message: string
}

export function formatZodErrors(error: z.ZodError): ValidationError[] {
  return (error as any).issues.map((issue: any) => ({
    field: Array.isArray(issue.path) ? issue.path.join(".") : String(issue.path || ""),
    message: issue.message || "入力エラー",
  }))
}
