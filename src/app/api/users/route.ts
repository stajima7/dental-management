import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import { getClinicAccess, MAX_CLINIC_USERS, countClinicSlotsUsed } from "@/lib/access";
import { newInvitationToken, invitationExpiry, INVITE_EXPIRY_DAYS } from "@/lib/invitation";

/**
 * 仮パスワードを作る。メールや口頭で伝える前提のため、
 * 紛らわしい文字（0とO、1とlとI）を除いた文字種を使う。
 */
function generateTempPassword(length = 12): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const bytes = crypto.randomBytes(length)
  return Array.from(bytes).map((b) => chars[b % chars.length]).join("")
}

// GET /api/users?clinicId=xxx - 医院のユーザー一覧
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 })

    const clinicId = new URL(req.url).searchParams.get("clinicId")
    if (!clinicId) return NextResponse.json({ error: "clinicIdが必要です" }, { status: 400 })

    const cu = await getClinicAccess((session.user as any).id, clinicId)
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
      // 画面で「あと何名追加できるか」を出すため
      limit: MAX_CLINIC_USERS,
      used: await countClinicSlotsUsed(clinicId),
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
    // 本人に新規登録してもらう方式を基本とし、こちらでアカウントを作るのは
    // 管理者が画面で明示的に選んだときだけにする。
    // 管理者が相手のパスワードを知っている状態を、既定の運用にしないため。
    const createIfMissing = body.createIfMissing === true

    if (!clinicId || !email) return NextResponse.json({ error: "clinicId, emailが必要です" }, { status: 400 })

    // ADMIN権限チェック
    const cu = await getClinicAccess((session.user as any).id, clinicId)
    if (!cu || cu.role !== "ADMIN") return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 })

    // 既存ユーザーか確認
    const existingUser = await prisma.user.findUnique({ where: { email } })

    if (existingUser) {
      // 既に医院に所属しているか確認
      const existingCu = await prisma.clinicUser.findUnique({
        where: { userId_clinicId: { userId: existingUser.id, clinicId } },
      })
      if (existingCu) return NextResponse.json({ error: "このユーザーは既に所属しています" }, { status: 400 })
    }

    // 1医院あたりの人数の上限。既存ユーザーの追加でも新規作成でも1名増えるため、
    // 枝分かれの前にまとめて確認する。
    // システム全体の管理者は枠を使わない（保守のために所属しているだけのため）。
    if (existingUser?.role !== "SUPER_ADMIN") {
      const used = await countClinicSlotsUsed(clinicId)
      if (used >= MAX_CLINIC_USERS) {
        return NextResponse.json(
          {
            error: `この医院に登録できる利用者は${MAX_CLINIC_USERS}名までです（現在${used}名）。追加するには、使わなくなったアカウントを一覧の「除外」で外してください。`,
          },
          { status: 400 }
        )
      }
    }

    if (!existingUser && !createIfMissing) {
      // 招待を発行する。合言葉つきのURLを持つ人だけが登録できる。
      // 同じアドレスに出し直した場合は合言葉を作り替える（古いURLは使えなくなる）。
      const token = newInvitationToken()
      const expiresAt = invitationExpiry()
      await prisma.invitation.upsert({
        where: { clinicId_email: { clinicId, email } },
        update: { token, role: role || "MEMBER", expiresAt, accepted: false },
        create: { clinicId, email, role: role || "MEMBER", token, expiresAt },
      })

      // メールは送れないため、URLは画面に出して管理者から本人に伝えてもらう
      return NextResponse.json({
        success: true,
        type: "invited",
        message: `招待URLを発行しました（有効期限${INVITE_EXPIRY_DAYS}日）。ご本人にお伝えください。`,
        email,
        token,
        expiresAt,
      })
    }

    if (existingUser) {
      // 直接追加
      await prisma.clinicUser.create({
        data: { userId: existingUser.id, clinicId, role: role || "MEMBER" },
      })
      return NextResponse.json({ success: true, type: "added", message: "ユーザーを追加しました" })
    }

    // メールを送る仕組みが無く、招待トークンを受け取る画面も無いため、
    // 招待ではなくアカウントそのものを作成する。
    // 管理者が仮パスワードを発行して本人に伝え、初回ログイン時に変更してもらう。
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : email.split("@")[0]
    const tempPassword = generateTempPassword()

    // 発行済みの招待があれば取り消す。使われない招待が枠を占め続けないようにするため。
    await prisma.invitation.deleteMany({ where: { clinicId, email } })

    const created = await prisma.user.create({
      data: {
        name,
        email,
        password: await bcrypt.hash(tempPassword, 12),
        role: "MEMBER",
        // 変更するまでは他の画面を使わせない
        mustChangePassword: true,
        clinics: { create: { clinicId, role: role || "MEMBER" } },
      },
    })

    // 仮パスワードはこの応答でしか返さない（保存も再表示もしない）
    return NextResponse.json({
      success: true,
      type: "created",
      message: "アカウントを作成しました。仮パスワードを本人にお伝えください。",
      email: created.email,
      tempPassword,
    })
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

    const cu = await getClinicAccess((session.user as any).id, clinicId)
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

    const cu = await getClinicAccess((session.user as any).id, clinicId)
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
