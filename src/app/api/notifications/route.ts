import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"

// GET /api/notifications - 自分宛通知一覧
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 })

    const sp = new URL(req.url).searchParams
    const unreadOnly = sp.get("unreadOnly") === "true"

    const where: any = { userId: (session.user as any).id }
    if (unreadOnly) where.isRead = false

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
    })

    const unreadCount = await prisma.notification.count({
      where: { userId: (session.user as any).id, isRead: false },
    })

    return NextResponse.json({ notifications, unreadCount })
  } catch (error) {
    console.error("Notifications fetch error:", error)
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 })
  }
}

// PUT /api/notifications - 既読にする
export async function PUT(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 })

    const body = await req.json()
    const { id, markAllRead } = body

    if (markAllRead) {
      await prisma.notification.updateMany({
        where: { userId: (session.user as any).id, isRead: false },
        data: { isRead: true },
      })
    } else if (id) {
      await prisma.notification.update({ where: { id }, data: { isRead: true } })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Notification update error:", error)
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 })
  }
}
