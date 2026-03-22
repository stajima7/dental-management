import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"

// GET /api/dashboard/layout?clinicId=xxx - ダッシュボードレイアウト取得
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 })

    const clinicId = new URL(req.url).searchParams.get("clinicId")
    const userId = (session.user as any).id

    const layout = await prisma.dashboardLayout.findUnique({
      where: { userId_clinicId: { userId, clinicId: clinicId || "" } },
    })

    if (!layout) {
      // デフォルトレイアウト
      return NextResponse.json({
        layout: {
          mainKpis: ["totalRevenue", "selfPayRatio", "newPatientCount", "returnRate", "revenuePerUnit", "laborCostRatio", "grossProfitRate", "operatingProfitRate"],
          charts: ["revenueTrend", "revenueComposition", "patientTrend", "profitabilityTrend"],
          showKpiTable: true,
        },
      })
    }

    return NextResponse.json({ layout: JSON.parse(layout.layoutJson) })
  } catch (error) {
    console.error("Dashboard layout fetch error:", error)
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 })
  }
}

// POST /api/dashboard/layout - ダッシュボードレイアウト保存
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 })

    const body = await req.json()
    const { clinicId, layout } = body
    const userId = (session.user as any).id

    await prisma.dashboardLayout.upsert({
      where: { userId_clinicId: { userId, clinicId: clinicId || "" } },
      update: { layoutJson: JSON.stringify(layout) },
      create: { userId, clinicId: clinicId || null, layoutJson: JSON.stringify(layout) },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Dashboard layout save error:", error)
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 })
  }
}
