import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"

// GET /api/backup?clinicId=xxx - 医院データのJSONバックアップ
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 })

    const clinicId = new URL(req.url).searchParams.get("clinicId")
    if (!clinicId) return NextResponse.json({ error: "clinicIdが必要です" }, { status: 400 })

    const cu = await prisma.clinicUser.findUnique({
      where: { userId_clinicId: { userId: (session.user as any).id, clinicId } },
    })
    if (!cu || cu.role !== "ADMIN") return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 })

    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } })
    const profiles = await prisma.clinicProfile.findMany({ where: { clinicId } })
    const targets = await prisma.clinicTarget.findMany({ where: { clinicId } })
    const revenue = await prisma.monthlyRevenue.findMany({ where: { clinicId } })
    const patients = await prisma.monthlyPatients.findMany({ where: { clinicId } })
    const appointments = await prisma.monthlyAppointments.findMany({ where: { clinicId } })
    const costs = await prisma.monthlyCosts.findMany({ where: { clinicId } })
    const kpis = await prisma.monthlyKpis.findMany({ where: { clinicId } })
    const allocationRules = await prisma.allocationRule.findMany({ where: { clinicId } })
    const allocationDrivers = await prisma.allocationDriverValue.findMany({ where: { clinicId } })
    const allocationResults = await prisma.allocationResult.findMany({ where: { clinicId } })
    const deptProfit = await prisma.departmentProfitability.findMany({ where: { clinicId } })
    const insights = await prisma.aiInsight.findMany({ where: { clinicId } })
    const actionPlans = await prisma.actionPlan.findMany({ where: { clinicId } })

    const backup = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      clinic,
      profiles,
      targets,
      monthlyRevenue: revenue,
      monthlyPatients: patients,
      monthlyAppointments: appointments,
      monthlyCosts: costs,
      monthlyKpis: kpis,
      allocationRules,
      allocationDriverValues: allocationDrivers,
      allocationResults,
      departmentProfitability: deptProfit,
      aiInsights: insights,
      actionPlans,
    }

    const jsonString = JSON.stringify(backup, null, 2)
    const clinicName = clinic?.clinicName || "clinic"
    const date = new Date().toISOString().slice(0, 10)

    return new NextResponse(jsonString, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${clinicName}_backup_${date}.json"`,
      },
    })
  } catch (error) {
    console.error("Backup error:", error)
    return NextResponse.json({ error: "バックアップに失敗しました" }, { status: 500 })
  }
}

// POST /api/backup - JSONデータからリストア
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 })

    const body = await req.json()
    const { clinicId, backupData } = body

    if (!clinicId || !backupData) return NextResponse.json({ error: "clinicId, backupDataが必要です" }, { status: 400 })

    const cu = await prisma.clinicUser.findUnique({
      where: { userId_clinicId: { userId: (session.user as any).id, clinicId } },
    })
    if (!cu || cu.role !== "ADMIN") return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 })

    // リストアは既存データを上書きする形
    let restoredCount = 0

    if (backupData.monthlyRevenue) {
      for (const r of backupData.monthlyRevenue) {
        try {
          await prisma.monthlyRevenue.upsert({
            where: {
              clinicId_yearMonth_departmentType_revenueType_insuranceOrPrivate: {
                clinicId, yearMonth: r.yearMonth, departmentType: r.departmentType,
                revenueType: r.revenueType, insuranceOrPrivate: r.insuranceOrPrivate,
              },
            },
            update: { amount: r.amount, points: r.points || 0 },
            create: { clinicId, yearMonth: r.yearMonth, departmentType: r.departmentType, revenueType: r.revenueType, insuranceOrPrivate: r.insuranceOrPrivate, amount: r.amount, points: r.points || 0 },
          })
          restoredCount++
        } catch { /* skip */ }
      }
    }

    return NextResponse.json({ success: true, restoredCount })
  } catch (error) {
    console.error("Restore error:", error)
    return NextResponse.json({ error: "リストアに失敗しました" }, { status: 500 })
  }
}
