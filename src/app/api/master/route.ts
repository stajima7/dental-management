import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"

// GET /api/master?clinicId=xxx&type=costItems|drivers|benchmarks|kpiDisplay
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 })

    const sp = new URL(req.url).searchParams
    const clinicId = sp.get("clinicId")
    const type = sp.get("type")
    if (!clinicId || !type) return NextResponse.json({ error: "clinicId, typeが必要です" }, { status: 400 })

    const cu = await prisma.clinicUser.findUnique({
      where: { userId_clinicId: { userId: (session.user as any).id, clinicId } },
    })
    if (!cu) return NextResponse.json({ error: "アクセス権がありません" }, { status: 403 })

    switch (type) {
      case "costItems":
        return NextResponse.json(await prisma.customCostItem.findMany({ where: { clinicId }, orderBy: { sortOrder: "asc" } }))
      case "drivers":
        return NextResponse.json(await prisma.customDriver.findMany({ where: { clinicId }, orderBy: { sortOrder: "asc" } }))
      case "benchmarks":
        return NextResponse.json(await prisma.customBenchmark.findMany({ where: { clinicId } }))
      case "kpiDisplay":
        return NextResponse.json(await prisma.kpiDisplaySetting.findMany({ where: { clinicId }, orderBy: { sortOrder: "asc" } }))
      default:
        return NextResponse.json({ error: "不明なtypeです" }, { status: 400 })
    }
  } catch (error) {
    console.error("Master fetch error:", error)
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 })
  }
}

// POST /api/master - マスタ作成/更新（バルク対応）
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 })

    const body = await req.json()
    const { clinicId, type, items } = body
    if (!clinicId || !type || !Array.isArray(items)) return NextResponse.json({ error: "clinicId, type, itemsが必要です" }, { status: 400 })

    const cu = await prisma.clinicUser.findUnique({
      where: { userId_clinicId: { userId: (session.user as any).id, clinicId } },
    })
    if (!cu || cu.role !== "ADMIN") return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 })

    switch (type) {
      case "costItems":
        for (const item of items) {
          await prisma.customCostItem.upsert({
            where: { clinicId_code: { clinicId, code: item.code } },
            update: { name: item.name, isIndirect: item.isIndirect ?? true, isActive: item.isActive ?? true, sortOrder: item.sortOrder ?? 0 },
            create: { clinicId, code: item.code, name: item.name, isIndirect: item.isIndirect ?? true, isActive: item.isActive ?? true, sortOrder: item.sortOrder ?? 0 },
          })
        }
        break
      case "drivers":
        for (const item of items) {
          await prisma.customDriver.upsert({
            where: { clinicId_code: { clinicId, code: item.code } },
            update: { name: item.name, isActive: item.isActive ?? true, sortOrder: item.sortOrder ?? 0 },
            create: { clinicId, code: item.code, name: item.name, isActive: item.isActive ?? true, sortOrder: item.sortOrder ?? 0 },
          })
        }
        break
      case "benchmarks":
        for (const item of items) {
          await prisma.customBenchmark.upsert({
            where: { clinicId_kpiCode: { clinicId, kpiCode: item.kpiCode } },
            update: { value: item.value },
            create: { clinicId, kpiCode: item.kpiCode, value: item.value },
          })
        }
        break
      case "kpiDisplay":
        for (const item of items) {
          await prisma.kpiDisplaySetting.upsert({
            where: { clinicId_kpiCode: { clinicId, kpiCode: item.kpiCode } },
            update: { isVisible: item.isVisible ?? true, sortOrder: item.sortOrder ?? 0 },
            create: { clinicId, kpiCode: item.kpiCode, isVisible: item.isVisible ?? true, sortOrder: item.sortOrder ?? 0 },
          })
        }
        break
      default:
        return NextResponse.json({ error: "不明なtypeです" }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Master save error:", error)
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 })
  }
}

// DELETE /api/master?clinicId=xxx&type=xxx&id=yyy
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 })

    const sp = new URL(req.url).searchParams
    const clinicId = sp.get("clinicId")
    const type = sp.get("type")
    const id = sp.get("id")
    if (!clinicId || !type || !id) return NextResponse.json({ error: "clinicId, type, idが必要です" }, { status: 400 })

    const cu = await prisma.clinicUser.findUnique({
      where: { userId_clinicId: { userId: (session.user as any).id, clinicId } },
    })
    if (!cu || cu.role !== "ADMIN") return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 })

    switch (type) {
      case "costItems": await prisma.customCostItem.delete({ where: { id } }); break
      case "drivers": await prisma.customDriver.delete({ where: { id } }); break
      case "benchmarks": await prisma.customBenchmark.delete({ where: { id } }); break
      case "kpiDisplay": await prisma.kpiDisplaySetting.delete({ where: { id } }); break
      default: return NextResponse.json({ error: "不明なtypeです" }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Master delete error:", error)
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 })
  }
}
