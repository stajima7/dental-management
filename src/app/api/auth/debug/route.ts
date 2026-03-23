import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json()

    const user = await prisma.user.findUnique({ where: { email } })

    if (!user) {
      return NextResponse.json({
        step: "findUser",
        error: "User not found",
        email,
      })
    }

    const isValid = await bcrypt.compare(password, user.password || "")

    return NextResponse.json({
      step: "verify",
      userFound: true,
      userId: user.id,
      userName: user.name,
      hasPassword: !!user.password,
      passwordValid: isValid,
    })
  } catch (error: any) {
    return NextResponse.json({
      step: "error",
      message: error.message,
    }, { status: 500 })
  }
}

// GET - セッション確認用
export async function GET() {
  try {
    const session = await auth()
    return NextResponse.json({
      hasSession: !!session,
      user: session?.user || null,
    })
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack?.split("\n").slice(0, 5),
    }, { status: 500 })
  }
}
