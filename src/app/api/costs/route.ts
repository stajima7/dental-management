import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { CostLayer, DepartmentType } from "@prisma/client";
import { costSaveSchema, formatZodErrors } from "@/lib/validations";

// GET /api/costs?clinicId=xxx&yearMonth=2025-01
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

    const clinicUser = await prisma.clinicUser.findUnique({
      where: { userId_clinicId: { userId: (session.user as any).id, clinicId } },
    });
    if (!clinicUser) {
      return NextResponse.json({ error: "アクセス権がありません" }, { status: 403 });
    }

    const where: Record<string, unknown> = { clinicId };
    if (yearMonth) where.yearMonth = yearMonth;

    const costs = await prisma.monthlyCosts.findMany({
      where,
      orderBy: [{ yearMonth: "desc" }, { costItemCode: "asc" }],
    });

    return NextResponse.json(costs);
  } catch (error) {
    console.error("Costs fetch error:", error);
    return NextResponse.json({ error: "コストデータの取得に失敗しました" }, { status: 500 });
  }
}

// POST /api/costs - コストデータ登録・更新
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const body = await req.json();
    const validation = costSaveSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "入力内容に問題があります", details: formatZodErrors(validation.error) },
        { status: 400 }
      );
    }

    const { clinicId, yearMonth, costs } = validation.data;

    const clinicUser = await prisma.clinicUser.findUnique({
      where: { userId_clinicId: { userId: (session.user as any).id, clinicId } },
    });
    if (!clinicUser) {
      return NextResponse.json({ error: "アクセス権がありません" }, { status: 403 });
    }

    const results = await Promise.all(
      costs.map((cost) =>
        prisma.monthlyCosts.upsert({
          where: {
            clinicId_yearMonth_costItemCode_departmentType: {
              clinicId, yearMonth,
              costItemCode: cost.costItemCode,
              departmentType: (cost.departmentType || "TOTAL") as DepartmentType,
            },
          },
          update: {
            costLayer: (cost.costLayer || "INDIRECT") as CostLayer,
            amount: cost.amount || 0,
            memo: cost.memo || null,
          },
          create: {
            clinicId, yearMonth,
            costItemCode: cost.costItemCode,
            departmentType: (cost.departmentType || "TOTAL") as DepartmentType,
            costLayer: (cost.costLayer || "INDIRECT") as CostLayer,
            amount: cost.amount || 0,
            memo: cost.memo || null,
          },
        })
      )
    );

    return NextResponse.json({ success: true, count: results.length });
  } catch (error) {
    console.error("Costs save error:", error);
    return NextResponse.json({ error: "コストの保存に失敗しました" }, { status: 500 });
  }
}
