import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"

// GET /api/audit?clinicId=xxx&limit=50&offset=0
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 })

    const sp = new URL(req.url).searchParams
    const clinicId = sp.get("clinicId")
    const limit = Math.min(parseInt(sp.get("limit") || "50"), 200)
    const offset = parseInt(sp.get("offset") || "0")

    // ADMIN権限チェック
    if (clinicId) {
      const cu = await prisma.clinicUser.findUnique({
        where: { userId_clinicId: { userId: (session.user as any).id, clinicId } },
      })
      if (!cu || cu.role !== "ADMIN") return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 })
    }

    const where: any = {}
    if (clinicId) where.clinicId = clinicId

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.auditLog.count({ where }),
    ])

    return NextResponse.json({ logs, total, limit, offset })
  } catch (error) {
    console.error("Audit log fetch error:", error)
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 })
  }
}
