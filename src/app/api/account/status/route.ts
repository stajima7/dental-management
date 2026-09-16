import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { userIdOf } from "@/lib/access";

/**
 * GET /api/account/status - 自分の医院への所属の状況
 *
 * 見られる医院が無いとき、「まだ医院に登録されていない」のか
 * 「医院で利用を停止された」のかで案内を分けるために使う。
 * 返すのは自分自身の件数だけ（どの医院かは返さない）。
 */
export async function GET() {
  try {
    const session = await auth();
    const userId = userIdOf(session);
    if (!userId) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

    const [activeClinics, suspendedClinics] = await Promise.all([
      prisma.clinicUser.count({ where: { userId, isActive: true } }),
      prisma.clinicUser.count({ where: { userId, isActive: false } }),
    ]);

    return NextResponse.json({ activeClinics, suspendedClinics });
  } catch (error) {
    console.error("account status error:", error);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}
