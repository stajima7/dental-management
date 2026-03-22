import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// POST /api/clinics/[id]/targets - 目標値を保存
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { id } = await params;

    const clinicUser = await prisma.clinicUser.findUnique({
      where: {
        userId_clinicId: {
          userId: (session.user as any).id,
          clinicId: id,
        },
      },
    });
    if (!clinicUser) {
      return NextResponse.json({ error: "アクセス権がありません" }, { status: 403 });
    }

    const body = await req.json();

    const target = await prisma.clinicTarget.upsert({
      where: {
        clinicId_yearMonth: {
          clinicId: id,
          yearMonth: body.yearMonth || null,
        },
      },
      update: {
        monthlyRevenue: body.monthlyRevenue ?? null,
        selfPayRatio: body.selfPayRatio ?? null,
        newPatients: body.newPatients ?? null,
        returnRate: body.returnRate ?? null,
        laborCostRatio: body.laborCostRatio ?? null,
        maintenanceTransitionRate: body.maintenanceTransitionRate ?? null,
        operatingProfitRate: body.operatingProfitRate ?? null,
        revenuePerUnit: body.revenuePerUnit ?? null,
      },
      create: {
        clinicId: id,
        yearMonth: body.yearMonth || null,
        monthlyRevenue: body.monthlyRevenue ?? null,
        selfPayRatio: body.selfPayRatio ?? null,
        newPatients: body.newPatients ?? null,
        returnRate: body.returnRate ?? null,
        laborCostRatio: body.laborCostRatio ?? null,
        maintenanceTransitionRate: body.maintenanceTransitionRate ?? null,
        operatingProfitRate: body.operatingProfitRate ?? null,
        revenuePerUnit: body.revenuePerUnit ?? null,
      },
    });

    return NextResponse.json(target, { status: 201 });
  } catch (error) {
    console.error("Target save error:", error);
    return NextResponse.json({ error: "目標値の保存に失敗しました" }, { status: 500 });
  }
}

// GET /api/clinics/[id]/targets - 目標値を取得
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { id } = await params;

    const target = await prisma.clinicTarget.findFirst({
      where: { clinicId: id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(target || {});
  } catch (error) {
    console.error("Target fetch error:", error);
    return NextResponse.json({ error: "目標値の取得に失敗しました" }, { status: 500 });
  }
}
