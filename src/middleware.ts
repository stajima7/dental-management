import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isLoggedIn = !!req.auth

  // 公開ページ（認証不要）
  const publicPaths = ["/login", "/register"]
  const isPublicPage = publicPaths.some((path) => pathname.startsWith(path))

  // API認証ルート（NextAuth用）
  const isAuthApi = pathname.startsWith("/api/auth")

  // 静的アセット
  const isStaticAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")

  // 静的アセットとNextAuth APIはそのまま通す
  if (isStaticAsset || isAuthApi) {
    return NextResponse.next()
  }

  // 未認証で保護ページにアクセス → ログインへリダイレクト
  if (!isLoggedIn && !isPublicPage) {
    const loginUrl = new URL("/login", req.nextUrl.origin)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // 認証済みでログイン/登録ページにアクセス → ダッシュボードへ
  if (isLoggedIn && isPublicPage) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
