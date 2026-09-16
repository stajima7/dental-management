import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import prisma from "@/lib/prisma"
import { registerSchema, formatZodErrors } from "@/lib/validations"
import { findValidInvitation } from "@/lib/invitation"
import { MAX_CLINIC_USERS, countClinicMembers } from "@/lib/access"

/**
 * POST /api/auth/register - 新規登録（招待された人だけ）
 *
 * 以前はURLを知っていれば誰でもアカウントを作れた。
 * 招待の合言葉を必須にし、招待された医院に自動で所属させる。
 * パスワードは本人が決めるため、こちらが知ることはない。
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()

    // Zodバリデーション
    const result = registerSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: "入力内容に問題があります", details: formatZodErrors(result.error) },
        { status: 400 }
      )
    }

    const { name, password } = result.data
    // 保存するアドレスは揃える（招待・ログインと表記がずれないようにする）
    const email = result.data.email.trim().toLowerCase()

    // 招待が無ければ登録できない
    const invitation = await findValidInvitation(typeof body.token === "string" ? body.token : null)
    if (!invitation) {
      return NextResponse.json(
        { error: "ご登録には招待が必要です。管理者からお送りした招待URLからお手続きください。" },
        { status: 403 }
      )
    }

    // 招待したアドレス以外では登録させない。
    // 招待URLが転送されても、別の人のアカウントは作れないようにするため。
    if (invitation.email.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json(
        { error: `この招待は ${invitation.email} 宛です。招待されたメールアドレスをご入力ください。` },
        { status: 400 }
      )
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: "このメールアドレスは既に登録されています" }, { status: 400 })
    }

    // 招待を出したあとに枠が埋まることがあるため、ここでも確認する
    const used = await countClinicMembers(invitation.clinicId)
    if (used >= MAX_CLINIC_USERS) {
      return NextResponse.json(
        { error: `この医院の登録枠（${MAX_CLINIC_USERS}名）が埋まっています。管理者にご連絡ください。` },
        { status: 400 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    // 招待された医院への所属も同時に作る。
    // 登録しても何も見えない状態を挟まないため。
    const user = await prisma.user.create({
      data: {
        name: name || email.split("@")[0],
        email,
        password: hashedPassword,
        role: "MEMBER",
        clinics: { create: { clinicId: invitation.clinicId, role: invitation.role as "ADMIN" | "MEMBER" | "VIEWER" } },
      },
    })

    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { accepted: true },
    })

    return NextResponse.json(
      { id: user.id, email: user.email, clinicName: invitation.clinicName },
      { status: 201 }
    )
  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json({ error: "登録に失敗しました" }, { status: 500 })
  }
}
