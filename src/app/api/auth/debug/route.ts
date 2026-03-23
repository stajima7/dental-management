import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import prisma from "@/lib/prisma"

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json()

    const user = await prisma.user.findUnique({ where: { email } })

    if (!user) {
      return NextResponse.json({
        step: "findUser",
        error: "User not found",
        email,
        dbUrl: process.env.PRISMA_DATABASE_URL ? "SET" : "NOT_SET",
        postgresUrl: process.env.POSTGRES_URL ? "SET" : "NOT_SET",
        databaseUrl: process.env.DATABASE_URL ? "SET" : "NOT_SET",
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
      nextauthSecret: process.env.NEXTAUTH_SECRET ? "SET" : "NOT_SET",
      authSecret: process.env.AUTH_SECRET ? "SET" : "NOT_SET",
    })
  } catch (error: any) {
    return NextResponse.json({
      step: "error",
      message: error.message,
      stack: error.stack?.split("\n").slice(0, 3),
    }, { status: 500 })
  }
}
