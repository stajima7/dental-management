import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * GET /api/department?clinicId=xxx&yearMonth=2025-01
 * 部門別採算データ取得（なければ自動計算）
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

    // 既存データがあればそれを返す
    const existing = await prisma.departmentProfitability.findMany({
      where: { clinicId, yearMonth },
      orderBy: { departmentType: "asc" },
    });

    if (existing.length > 0) {
      return NextResponse.json(existing);
    }

    // なければ計算して返す
    const result = await calculateDepartmentProfitability(clinicId, yearMonth);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Department profitability error:", error);
    return NextResponse.json({ error: "部門別採算の取得に失敗しました" }, { status: 500 });
  }
}

/**
 * POST /api/department - 部門別採算を再計算
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const body = await req.json();
    const { clinicId, yearMonth } = body;

    if (!clinicId || !yearMonth) {
      return NextResponse.json({ error: "clinicId, yearMonthが必要です" }, { status: 400 });
    }

    // 既存データ削除
    await prisma.departmentProfitability.deleteMany({
      where: { clinicId, yearMonth },
    });

    const result = await calculateDepartmentProfitability(clinicId, yearMonth);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Department recalculation error:", error);
    return NextResponse.json({ error: "部門別採算の再計算に失敗しました" }, { status: 500 });
  }
}

async function calculateDepartmentProfitability(clinicId: string, yearMonth: string) {
  const departments = ["INSURANCE", "SELF_PAY", "MAINTENANCE", "HOME_VISIT", "RETAIL", "OTHER"] as const;

  // 各部門の売上取得
  const revenue: { departmentType: string; amount: number }[] = await prisma.monthlyRevenue.findMany({
    where: { clinicId, yearMonth },
  });

  // 各部門のコスト取得
  const costs: { departmentType: string; costLayer: string; amount: number }[] = await prisma.monthlyCosts.findMany({
    where: { clinicId, yearMonth },
  });

  // 配賦結果取得
  const allocations: { departmentType: string; allocatedAmount: number }[] = await prisma.allocationResult.findMany({
    where: { clinicId, yearMonth },
  });

  const results = [];

  for (const dept of departments) {
    // 売上
    const deptRevenue = revenue
      .filter((r) => r.departmentType === dept)
      .reduce((sum, r) => sum + r.amount, 0);

    // 直接原価
    const directCost = costs
      .filter((c) => c.departmentType === dept && c.costLayer === "DIRECT")
      .reduce((sum, c) => sum + c.amount, 0);

    // 直接計上費
    const directAssignedCost = costs
      .filter((c) => c.departmentType === dept && c.costLayer === "DIRECT_ASSIGNED")
      .reduce((sum, c) => sum + c.amount, 0);

    // 配賦された間接費
    const allocatedIndirectCost = allocations
      .filter((a) => a.departmentType === dept)
      .reduce((sum, a) => sum + a.allocatedAmount, 0);

    // 粗利益 = 売上 - 直接費
    const grossProfit = deptRevenue - directCost;

    // 配賦前営業利益 = 粗利益 - 直接計上費
    const preAllocationProfit = grossProfit - directAssignedCost;

    // 配賦後営業利益 = 配賦前営業利益 - 配賦間接費
    const postAllocationOperatingProfit = preAllocationProfit - allocatedIndirectCost;

    // 利益率
    const grossMargin = deptRevenue > 0 ? (grossProfit / deptRevenue) * 100 : 0;
    const preAllocationMargin = deptRevenue > 0 ? (preAllocationProfit / deptRevenue) * 100 : 0;
    const operatingMargin = deptRevenue > 0 ? (postAllocationOperatingProfit / deptRevenue) * 100 : 0;

    if (deptRevenue > 0 || directCost > 0 || allocatedIndirectCost > 0) {
      const saved = await prisma.departmentProfitability.create({
        data: {
          clinicId,
          yearMonth,
          departmentType: dept,
          revenue: deptRevenue,
          directCost,
          grossProfit,
          grossMargin,
          directAssignedCost,
          preAllocationProfit,
          preAllocationMargin,
          allocatedIndirectCost,
          postAllocationOperatingProfit,
          operatingMargin,
        },
      });
      results.push(saved);
    }
  }

  return results;
}
