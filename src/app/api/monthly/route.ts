import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/monthly?clinicId=xxx&yearMonth=2025-01
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const clinicId = searchParams.get("clinicId");
    const yearMonth = searchParams.get("yearMonth");

    if (!clinicId) {
      return NextResponse.json({ error: "clinicIdが必要です" }, { status: 400 });
    }

    // アクセス権確認
    const clinicUser = await prisma.clinicUser.findUnique({
      where: {
        userId_clinicId: {
          userId: (session.user as any).id,
          clinicId,
        },
      },
    });
    if (!clinicUser) {
      return NextResponse.json({ error: "アクセス権がありません" }, { status: 403 });
    }

    const where: Record<string, unknown> = { clinicId };
    if (yearMonth) where.yearMonth = yearMonth;

    const [revenue, patients, appointments, costs] = await Promise.all([
      prisma.monthlyRevenue.findMany({ where, orderBy: { yearMonth: "desc" } }),
      prisma.monthlyPatients.findMany({ where, orderBy: { yearMonth: "desc" } }),
      prisma.monthlyAppointments.findMany({ where, orderBy: { yearMonth: "desc" } }),
      prisma.monthlyCosts.findMany({ where, orderBy: { yearMonth: "desc" } }),
    ]);

    return NextResponse.json({ revenue, patients, appointments, costs });
  } catch (error) {
    console.error("Monthly data fetch error:", error);
    return NextResponse.json({ error: "月次データの取得に失敗しました" }, { status: 500 });
  }
}
