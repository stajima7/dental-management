import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import prisma from "./prisma"

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) {
            console.log("Missing credentials")
            return null
          }

          // 登録時に小文字で揃えているため、ログインでも同じように揃える。
          // 揃えないと、大文字で入力した本人が「見つからない」扱いになる。
          const user = await prisma.user.findUnique({
            where: { email: (credentials.email as string).trim().toLowerCase() },
          })

          if (!user || !user.password) {
            console.log("User not found:", credentials.email)
            return null
          }

          const isValid = await bcrypt.compare(
            credentials.password as string,
            user.password
          )

          if (!isValid) {
            console.log("Invalid password for:", credentials.email)
            return null
          }

          console.log("Login successful:", user.email)
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            // 仮パスワードのまま使い続けさせないため、画面側で変更を促す
            mustChangePassword: user.mustChangePassword,
          }
        } catch (error) {
          console.error("Auth error:", error)
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role
        token.id = user.id
        token.mustChangePassword = (user as any).mustChangePassword
      }
      return token
    },
    async session({ session, token }: { session: any; token: any }) {
      if (session.user) {
        session.user.role = token.role
        session.user.id = token.id
        session.user.mustChangePassword = token.mustChangePassword
      }
      return session
    },
  },
})
