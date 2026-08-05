import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * GET /api/patient-detail?clinicId=xxx&yearMonth=2025-01
 *
 * KPI（比率）だけでは分からない内訳を返す。
 *  - recall        … リコールの歩留まり（通知→予約→来院→再予約の実人数）
 *  - cancelDetails … キャンセルの理由別内訳と取り直せた件数
 *  - discontinued  … 中断患者の状態別実人数
 * いずれも未入力の医院では null / 空配列を返し、画面側で案内を出す。
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const clinicId = searchParams.get("clinicId");
    const yearMonth = searchParams.get("yearMonth");

    if (!clinicId || !yearMonth) {
      return NextResponse.json({ error: "clinicId, yearMonthが必要です" }, { status: 400 });
    }

    const clinicUser = await prisma.clinicUser.findUnique({
      where: { userId_clinicId: { userId: (session.user as { id: string }).id, clinicId } },
    });
    if (!clinicUser) {
      return NextResponse.json({ error: "アクセス権がありません" }, { status: 403 });
    }

    const [recall, cancelDetails, discontinued, clinic, target] = await Promise.all([
      prisma.monthlyRecall.findUnique({ where: { clinicId_yearMonth: { clinicId, yearMonth } } }),
      prisma.monthlyCancelDetail.findMany({
        where: { clinicId, yearMonth },
        orderBy: { count: "desc" },
      }),
      prisma.monthlyDiscontinued.findUnique({ where: { clinicId_yearMonth: { clinicId, yearMonth } } }),
      prisma.clinic.findUnique({
        where: { id: clinicId },
        select: { discontinuedJudgeMonths: true },
      }),
      prisma.clinicTarget.findFirst({
        where: { clinicId },
        orderBy: { createdAt: "desc" },
        select: { pointsPerPatientMin: true, pointsPerPatientMax: true },
      }),
    ]);

    return NextResponse.json({
      recall,
      cancelDetails,
      discontinued,
      discontinuedJudgeMonths: clinic?.discontinuedJudgeMonths ?? 3,
      // 平均保険点数の適正範囲（未設定なら画面側が既定値を使う）
      pointsPerPatientMin: target?.pointsPerPatientMin ?? null,
      pointsPerPatientMax: target?.pointsPerPatientMax ?? null,
    });
  } catch (error) {
    console.error("patient-detail error:", error);
    return NextResponse.json({ error: "内訳の取得に失敗しました" }, { status: 500 });
  }
}
