import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * POST /api/account/password - 自分のパスワードを変更する
 *
 * 管理者が仮パスワードで利用者を作成する運用のため、変更手段が必須になる。
 * 変更しない限り、管理者が相手のパスワードを知ったままになってしまう。
 *
 * 変更できるのは自分のパスワードだけ。他人のパスワードは変更できない
 * （管理者であっても、他人になりすませる状態を作らないため）。
 */

const MIN_LENGTH = 8;

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    const userId = (session.user as { id?: string }).id;
    if (!userId) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

    const body = await req.json();
    const currentPassword = String(body.currentPassword ?? "");
    const newPassword = String(body.newPassword ?? "");

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "現在のパスワードと新しいパスワードを入力してください" }, { status: 400 });
    }
    if (newPassword.length < MIN_LENGTH) {
      return NextResponse.json({ error: `新しいパスワードは${MIN_LENGTH}文字以上にしてください` }, { status: 400 });
    }
    if (newPassword === currentPassword) {
      return NextResponse.json({ error: "現在のパスワードと同じものは使えません" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });
    if (!user?.password) {
      return NextResponse.json({ error: "パスワードが設定されていません" }, { status: 400 });
    }

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      return NextResponse.json({ error: "現在のパスワードが違います" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        password: await bcrypt.hash(newPassword, 12),
        // 仮パスワードからの変更が済んだので、以後は求めない
        mustChangePassword: false,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("password change error:", error);
    return NextResponse.json({ error: "パスワードの変更に失敗しました" }, { status: 500 });
  }
}
