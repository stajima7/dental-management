import { NextRequest, NextResponse } from "next/server";
import { findValidInvitation } from "@/lib/invitation";

/**
 * GET /api/invitations/[token] - 招待の内容を確認する（認証不要）
 *
 * 新規登録画面が「どの医院へのどのアドレス宛の招待か」を表示するために使う。
 * 合言葉を持っている人にしか答えないため、認証は不要としている。
 * 返すのは画面に出す最小限（医院名とメールアドレス）だけにする。
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const invitation = await findValidInvitation(token);

    if (!invitation) {
      return NextResponse.json(
        { error: "この招待は使えません。期限切れか、既に使用済みの可能性があります。" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      email: invitation.email,
      clinicName: invitation.clinicName,
    });
  } catch (error) {
    console.error("Invitation check error:", error);
    return NextResponse.json({ error: "招待の確認に失敗しました" }, { status: 500 });
  }
}
