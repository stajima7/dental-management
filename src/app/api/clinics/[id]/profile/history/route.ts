import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"

// GET /api/clinics/[id]/profile/history - プロファイル履歴一覧
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 })

    const { id } = await params
    const cu = await prisma.clinicUser.findUnique({
      where: { userId_clinicId: { userId: (session.user as any).id, clinicId: id } },
    })
    if (!cu) return NextResponse.json({ error: "アクセス権がありません" }, { status: 403 })

    const profiles = await prisma.clinicProfile.findMany({
      where: { clinicId: id },
      orderBy: { createdAt: "desc" },
      take: 24, // 直近2年分
    })

    return NextResponse.json(profiles)
  } catch (error) {
    console.error("Profile history error:", error)
    return NextResponse.json({ error: "履歴の取得に失敗しました" }, { status: 500 })
  }
}
