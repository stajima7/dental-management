import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { KPI_DEFINITIONS } from "@/lib/kpi-calculator"

// GET /api/report?clinicId=xxx&yearMonth=2025-01&format=csv|json
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 })

    const sp = new URL(req.url).searchParams
    const clinicId = sp.get("clinicId")
    const yearMonth = sp.get("yearMonth")
    const format = sp.get("format") || "json"
    const type = sp.get("type") || "kpi" // kpi | department | costs | monthly

    if (!clinicId || !yearMonth) return NextResponse.json({ error: "clinicId, yearMonthが必要です" }, { status: 400 })

    const cu = await prisma.clinicUser.findUnique({
      where: { userId_clinicId: { userId: (session.user as any).id, clinicId } },
    })
    if (!cu) return NextResponse.json({ error: "アクセス権がありません" }, { status: 403 })

    let data: Record<string, any>[] = []
    let headers: string[] = []

    switch (type) {
      case "kpi": {
        const kpis = await prisma.monthlyKpis.findMany({ where: { clinicId, yearMonth } })
        headers = ["KPIコード", "KPI名", "値", "前月比", "前年比", "目標値", "達成率", "ベンチマーク"]
        data = kpis.map((k: any) => ({
          "KPIコード": k.kpiCode,
          "KPI名": KPI_DEFINITIONS[k.kpiCode]?.name || k.kpiCode,
          "値": k.kpiValue,
          "前月比": k.comparisonPrevMonth ?? "",
          "前年比": k.comparisonPrevYear ?? "",
          "目標値": k.targetValue ?? "",
          "達成率": k.achievementRate ?? "",
          "ベンチマーク": k.benchmarkValue ?? "",
        }))
        break
      }
      case "department": {
        const depts = await prisma.departmentProfitability.findMany({ where: { clinicId, yearMonth }, orderBy: { departmentType: "asc" } })
        headers = ["部門", "売上", "直接原価", "粗利益", "粗利率", "直接計上費", "配賦前利益", "間接配賦額", "営業利益", "営業利益率"]
        const deptLabels: Record<string, string> = { INSURANCE: "保険", SELF_PAY: "自費", MAINTENANCE: "メンテ", HOME_VISIT: "訪問", RETAIL: "物販", OTHER: "その他", TOTAL: "合計" }
        data = depts.map((d: any) => ({
          "部門": deptLabels[d.departmentType] || d.departmentType,
          "売上": d.revenue, "直接原価": d.directCost, "粗利益": d.grossProfit,
          "粗利率": `${(d.grossMargin || 0).toFixed(1)}%`,
          "直接計上費": d.directAssignedCost, "配賦前利益": d.preAllocationProfit,
          "間接配賦額": d.allocatedIndirectCost, "営業利益": d.postAllocationOperatingProfit,
          "営業利益率": `${(d.operatingMargin || 0).toFixed(1)}%`,
        }))
        break
      }
      case "costs": {
        const costs = await prisma.monthlyCosts.findMany({ where: { clinicId, yearMonth }, orderBy: { costItemCode: "asc" } })
        headers = ["費目コード", "費目名", "部門", "コスト区分", "金額"]
        const layerLabels: Record<string, string> = { DIRECT: "直接原価", DIRECT_ASSIGNED: "直接計上費", INDIRECT: "間接費" }
        data = costs.map((c: any) => ({
          "費目コード": c.costItemCode, "費目名": c.costItemCode,
          "部門": c.departmentType, "コスト区分": layerLabels[c.costLayer] || c.costLayer,
          "金額": c.amount,
        }))
        break
      }
      case "monthly": {
        const revenue = await prisma.monthlyRevenue.findMany({ where: { clinicId, yearMonth } })
        const patients = await prisma.monthlyPatients.findMany({ where: { clinicId, yearMonth } })
        const appointments = await prisma.monthlyAppointments.findMany({ where: { clinicId, yearMonth } })
        headers = ["カテゴリ", "区分", "値"]
        data = [
          ...revenue.map((r: any) => ({ "カテゴリ": "売上", "区分": `${r.departmentType}/${r.revenueType}`, "値": r.amount })),
          ...patients.map((p: any) => ({ "カテゴリ": "患者", "区分": `延患者:${p.totalPatientCount} 実患者:${p.uniquePatientCount} 新患:${p.newPatientCount}`, "値": p.totalPatientCount })),
          ...appointments.map((a: any) => ({ "カテゴリ": "予約", "区分": `予約:${a.appointmentCount} キャンセル:${a.cancelCount}`, "値": a.appointmentCount })),
        ]
        break
      }
    }

    if (format === "csv") {
      const csvRows = [headers.join(",")]
      for (const row of data) {
        csvRows.push(headers.map((h) => {
          const val = row[h]
          if (typeof val === "string" && (val.includes(",") || val.includes('"'))) {
            return `"${val.replace(/"/g, '""')}"`
          }
          return String(val ?? "")
        }).join(","))
      }
      const csvContent = "\uFEFF" + csvRows.join("\n") // BOM付きUTF-8
      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${type}_${yearMonth}.csv"`,
        },
      })
    }

    return NextResponse.json({ headers, data })
  } catch (error) {
    console.error("Report error:", error)
    return NextResponse.json({ error: "レポート生成に失敗しました" }, { status: 500 })
  }
}
