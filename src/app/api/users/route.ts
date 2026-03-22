import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import bcrypt from "bcryptjs"
import crypto from "crypto"

// GET /api/users?clinicId=xxx - 医院のユーザー一覧
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 })

    const clinicId = new URL(req.url).searchParams.get("clinicId")
    if (!clinicId) return NextResponse.json({ error: "clinicIdが必要です" }, { status: 400 })

    const cu = await prisma.clinicUser.findUnique({
      where: { userId_clinicId: { userId: (session.user as any).id, clinicId } },
    })
    if (!cu) return NextResponse.json({ error: "アクセス権がありません" }, { status: 403 })

    const clinicUsers = await prisma.clinicUser.findMany({
      where: { clinicId },
      include: { user: { select: { id: true, name: true, email: true, isActive: true, createdAt: true } } },
    })

    const invitations = await prisma.invitation.findMany({
      where: { clinicId, accepted: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({
      users: clinicUsers.map((cu: any) => ({ ...cu.user, clinicRole: cu.role })),
      invitations,
    })
  } catch (error) {
    console.error("Users fetch error:", error)
    return NextResponse.json({ error: "ユーザー一覧の取得に失敗しました" }, { status: 500 })
  }
}

// POST /api/users - ユーザー招待
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 })

    const body = await req.json()
    const { clinicId, email, role } = body

    if (!clinicId || !email) return NextResponse.json({ error: "clinicId, emailが必要です" }, { status: 400 })

    // ADMIN権限チェック
    const cu = await prisma.clinicUser.findUnique({
      where: { userId_clinicId: { userId: (session.user as any).id, clinicId } },
    })
    if (!cu || cu.role !== "ADMIN") return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 })

    // 既存ユーザーか確認
    const existingUser = await prisma.user.findUnique({ where: { email } })

    if (existingUser) {
      // 既に医院に所属しているか確認
      const existingCu = await prisma.clinicUser.findUnique({
        where: { userId_clinicId: { userId: existingUser.id, clinicId } },
      })
      if (existingCu) return NextResponse.json({ error: "このユーザーは既に所属しています" }, { status: 400 })

      // 直接追加
      await prisma.clinicUser.create({
        data: { userId: existingUser.id, clinicId, role: role || "MEMBER" },
      })
      return NextResponse.json({ success: true, type: "added", message: "ユーザーを追加しました" })
    }

    // 招待トークン生成
    const token = crypto.randomBytes(32).toString("hex")
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7日

    await prisma.invitation.upsert({
      where: { clinicId_email: { clinicId, email } },
      update: { token, role: role || "MEMBER", expiresAt, accepted: false },
      create: { clinicId, email, role: role || "MEMBER", token, expiresAt },
    })

    return NextResponse.json({ success: true, type: "invited", message: "招待を作成しました", token })
  } catch (error) {
    console.error("User invite error:", error)
    return NextResponse.json({ error: "招待に失敗しました" }, { status: 500 })
  }
}

// PUT /api/users - ユーザー権限変更/停止
export async function PUT(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 })

    const body = await req.json()
    const { clinicId, userId, role, isActive } = body

    if (!clinicId || !userId) return NextResponse.json({ error: "clinicId, userIdが必要です" }, { status: 400 })

    const cu = await prisma.clinicUser.findUnique({
      where: { userId_clinicId: { userId: (session.user as any).id, clinicId } },
    })
    if (!cu || cu.role !== "ADMIN") return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 })

    // 自分自身のADMIN権限は変更不可
    if (userId === (session.user as any).id && role && role !== "ADMIN") {
      return NextResponse.json({ error: "自分自身の管理者権限は変更できません" }, { status: 400 })
    }

    if (role !== undefined) {
      await prisma.clinicUser.update({
        where: { userId_clinicId: { userId, clinicId } },
        data: { role },
      })
    }

    if (isActive !== undefined) {
      await prisma.user.update({ where: { id: userId }, data: { isActive } })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("User update error:", error)
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 })
  }
}

// DELETE /api/users?clinicId=xxx&userId=yyy - ユーザー削除（医院から除外）
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 })

    const sp = new URL(req.url).searchParams
    const clinicId = sp.get("clinicId")
    const userId = sp.get("userId")
    const invitationId = sp.get("invitationId")

    if (!clinicId) return NextResponse.json({ error: "clinicIdが必要です" }, { status: 400 })

    const cu = await prisma.clinicUser.findUnique({
      where: { userId_clinicId: { userId: (session.user as any).id, clinicId } },
    })
    if (!cu || cu.role !== "ADMIN") return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 })

    if (invitationId) {
      await prisma.invitation.delete({ where: { id: invitationId } })
      return NextResponse.json({ success: true })
    }

    if (userId) {
      if (userId === (session.user as any).id) return NextResponse.json({ error: "自分自身は削除できません" }, { status: 400 })
      await prisma.clinicUser.delete({ where: { userId_clinicId: { userId, clinicId } } })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "userId or invitationIdが必要です" }, { status: 400 })
  } catch (error) {
    console.error("User delete error:", error)
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 })
  }
}
