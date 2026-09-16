import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { isSuperAdmin } from "@/lib/access";

// GET /api/dashboard/multi?yearMonth=2025-01 - 全医院横断ダッシュボード
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 })

    const yearMonth = new URL(req.url).searchParams.get("yearMonth")
    if (!yearMonth) return NextResponse.json({ error: "yearMonthが必要です" }, { status: 400 })

    const userId = (session.user as any).id
    // 管理者は所属していない医院も含めて横断して見られる
    const clinicUsers = (await isSuperAdmin(userId))
      ? (await prisma.clinic.findMany({
          select: { id: true, clinicName: true },
          orderBy: { clinicName: "asc" },
        })).map((clinic) => ({ clinicId: clinic.id, clinic }))
      : await prisma.clinicUser.findMany({
          // 停止されている医院は集計に含めない
          where: { userId, isActive: true },
          include: { clinic: { select: { id: true, clinicName: true } } },
        })

    const clinicIds = clinicUsers.map((cu: any) => cu.clinic.id)

    const results = await Promise.all(
      clinicUsers.map(async (cu: any) => {
        const kpis = await prisma.monthlyKpis.findMany({
          where: { clinicId: cu.clinic.id, yearMonth },
        })
        const kpiMap: Record<string, number> = {}
        kpis.forEach((k: any) => { kpiMap[k.kpiCode] = k.kpiValue })

        return {
          clinicId: cu.clinic.id,
          clinicName: cu.clinic.clinicName,
          kpis: kpiMap,
        }
      })
    )

    // 法人合計の計算
    const totalKpis: Record<string, number> = {}
    const sumKeys = ["totalRevenue", "insuranceRevenue", "selfPayRevenue", "totalPatientCount", "newPatientCount", "grossProfit", "operatingProfit"]
    for (const key of sumKeys) {
      totalKpis[key] = results.reduce((sum, r) => sum + (r.kpis[key] || 0), 0)
    }
    if (totalKpis.totalRevenue > 0) {
      totalKpis.selfPayRatio = (totalKpis.selfPayRevenue / totalKpis.totalRevenue) * 100
      totalKpis.grossProfitRate = (totalKpis.grossProfit / totalKpis.totalRevenue) * 100
      totalKpis.operatingProfitRate = (totalKpis.operatingProfit / totalKpis.totalRevenue) * 100
    }

    return NextResponse.json({ clinics: results, total: totalKpis })
  } catch (error) {
    console.error("Multi dashboard error:", error)
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 })
  }
}
