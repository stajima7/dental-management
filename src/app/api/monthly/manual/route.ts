import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { DepartmentType, RevenueType, InsuranceType, CostLayer } from "@prisma/client"

// POST /api/monthly/manual - 手入力による月次データ保存
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const body = await req.json()
    const { clinicId, yearMonth, revenue, patients, appointments, costs } = body

    if (!clinicId || !yearMonth) {
      return NextResponse.json({ error: "clinicId, yearMonth が必要です" }, { status: 400 })
    }

    // アクセス権確認
    const clinicUser = await prisma.clinicUser.findUnique({
      where: {
        userId_clinicId: {
          userId: (session.user as any).id,
          clinicId,
        },
      },
    })
    if (!clinicUser) {
      return NextResponse.json({ error: "アクセス権がありません" }, { status: 403 })
    }

    // 売上データ保存
    if (revenue) {
      const entries: { dept: DepartmentType; type: RevenueType; ins: InsuranceType; amount: number; points?: number }[] = [
        { dept: "INSURANCE", type: "TREATMENT", ins: "INSURANCE", amount: revenue.insuranceRevenue, points: revenue.insurancePoints },
        { dept: "SELF_PAY", type: "TREATMENT", ins: "PRIVATE", amount: revenue.selfPayRevenue },
        { dept: "MAINTENANCE", type: "PREVENTION", ins: "MIXED", amount: revenue.maintenanceRevenue },
        { dept: "HOME_VISIT", type: "TREATMENT", ins: "INSURANCE", amount: revenue.homeVisitRevenue },
        { dept: "RETAIL", type: "OTHER", ins: "PRIVATE", amount: revenue.retailRevenue },
      ]

      for (const entry of entries) {
        if (entry.amount != null && entry.amount > 0) {
          await prisma.monthlyRevenue.upsert({
            where: {
              clinicId_yearMonth_departmentType_revenueType_insuranceOrPrivate: {
                clinicId, yearMonth,
                departmentType: entry.dept,
                revenueType: entry.type,
                insuranceOrPrivate: entry.ins,
              },
            },
            update: { amount: entry.amount, points: entry.points || 0 },
            create: {
              clinicId, yearMonth,
              departmentType: entry.dept,
              revenueType: entry.type,
              insuranceOrPrivate: entry.ins,
              amount: entry.amount,
              points: entry.points || 0,
            },
          })
        }
      }

      // 合計売上
      const totalRev = (revenue.insuranceRevenue || 0) + (revenue.selfPayRevenue || 0) +
        (revenue.maintenanceRevenue || 0) + (revenue.homeVisitRevenue || 0) + (revenue.retailRevenue || 0)
      await prisma.monthlyRevenue.upsert({
        where: {
          clinicId_yearMonth_departmentType_revenueType_insuranceOrPrivate: {
            clinicId, yearMonth,
            departmentType: "TOTAL" as DepartmentType, revenueType: "TREATMENT" as RevenueType, insuranceOrPrivate: "MIXED" as InsuranceType,
          },
        },
        update: { amount: totalRev },
        create: { clinicId, yearMonth, departmentType: "TOTAL" as DepartmentType, revenueType: "TREATMENT" as RevenueType, insuranceOrPrivate: "MIXED" as InsuranceType, amount: totalRev },
      })
    }

    // 患者データ保存
    if (patients) {
      await prisma.monthlyPatients.upsert({
        where: { clinicId_yearMonth_departmentType: { clinicId, yearMonth, departmentType: "TOTAL" as DepartmentType } },
        update: {
          totalPatientCount: patients.totalPatientCount || 0,
          uniquePatientCount: patients.uniquePatientCount || 0,
          newPatientCount: patients.newPatientCount || 0,
          returnPatientCount: patients.returnPatientCount || 0,
          dropoutCount: patients.dropoutCount || 0,
          maintenanceTransitionCount: patients.maintenanceTransitionCount || 0,
        },
        create: {
          clinicId, yearMonth, departmentType: "TOTAL" as DepartmentType,
          totalPatientCount: patients.totalPatientCount || 0,
          uniquePatientCount: patients.uniquePatientCount || 0,
          newPatientCount: patients.newPatientCount || 0,
          returnPatientCount: patients.returnPatientCount || 0,
          dropoutCount: patients.dropoutCount || 0,
          maintenanceTransitionCount: patients.maintenanceTransitionCount || 0,
        },
      })
    }

    // 予約データ保存
    if (appointments) {
      await prisma.monthlyAppointments.upsert({
        where: { clinicId_yearMonth_departmentType: { clinicId, yearMonth, departmentType: "TOTAL" as DepartmentType } },
        update: {
          appointmentCount: appointments.appointmentCount || 0,
          cancelCount: appointments.cancelCount || 0,
          noShowCount: appointments.noShowCount || 0,
          completedCount: (appointments.appointmentCount || 0) - (appointments.cancelCount || 0) - (appointments.noShowCount || 0),
        },
        create: {
          clinicId, yearMonth, departmentType: "TOTAL" as DepartmentType,
          appointmentCount: appointments.appointmentCount || 0,
          cancelCount: appointments.cancelCount || 0,
          noShowCount: appointments.noShowCount || 0,
          completedCount: (appointments.appointmentCount || 0) - (appointments.cancelCount || 0) - (appointments.noShowCount || 0),
        },
      })
    }

    // コストデータ保存
    if (costs && Array.isArray(costs)) {
      for (const cost of costs) {
        if (cost.costItemCode && cost.amount > 0) {
          await prisma.monthlyCosts.upsert({
            where: {
              clinicId_yearMonth_costItemCode_departmentType: {
                clinicId, yearMonth,
                costItemCode: cost.costItemCode,
                departmentType: (cost.departmentType || "TOTAL") as DepartmentType,
              },
            },
            update: { amount: cost.amount, costLayer: (cost.costLayer || "INDIRECT") as CostLayer },
            create: {
              clinicId, yearMonth,
              costItemCode: cost.costItemCode,
              departmentType: (cost.departmentType || "TOTAL") as DepartmentType,
              costLayer: (cost.costLayer || "INDIRECT") as CostLayer,
              amount: cost.amount,
            },
          })
        }
      }
    }

    // ImportJobレコード作成
    await prisma.importJob.create({
      data: {
        clinicId,
        sourceType: "MANUAL",
        status: "COMPLETED",
        totalRows: 1,
        importedRows: 1,
        yearMonth,
      },
    })

    return NextResponse.json({ success: true, message: "月次データを保存しました" })
  } catch (error) {
    console.error("Manual input error:", error)
    return NextResponse.json({ error: "データ保存に失敗しました" }, { status: 500 })
  }
}
