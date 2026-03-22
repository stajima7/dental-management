import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * POST /api/allocation/calculate - 配賦計算実行
 * 間接費をコストドライバーに基づき各部門に配賦する
 *
 * 配賦レート = 間接費項目の総額 / 全部門のドライバー量合計
 * 部門配賦額 = 部門のドライバー量 × 配賦レート
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

    // 配賦ルール取得
    const rules: {
      costItemCode: string;
      allocationTargetType: string;
      driverType: string;
      driverRatio: number;
      manualOverride: boolean;
    }[] = await prisma.allocationRule.findMany({
      where: { clinicId },
    });

    if (rules.length === 0) {
      return NextResponse.json({ error: "配賦ルールが設定されていません" }, { status: 400 });
    }

    // 間接費（TOTAL部門のもの）取得
    const indirectCosts: {
      costItemCode: string;
      amount: number;
    }[] = await prisma.monthlyCosts.findMany({
      where: {
        clinicId,
        yearMonth,
        departmentType: "TOTAL",
        costLayer: "INDIRECT",
      },
    });

    // ドライバー量取得
    const driverValues: {
      driverType: string;
      departmentType: string;
      driverValue: number;
    }[] = await prisma.allocationDriverValue.findMany({
      where: { clinicId, yearMonth },
    });

    // 既存結果をクリア
    await prisma.allocationResult.deleteMany({
      where: { clinicId, yearMonth },
    });

    const results: {
      costItemCode: string;
      departmentType: string;
      driverType: string;
      driverRate: number;
      allocatedAmount: number;
    }[] = [];

    // コスト項目ごとに配賦計算
    for (const cost of indirectCosts) {
      const itemRules = rules.filter((r) => r.costItemCode === cost.costItemCode);
      if (itemRules.length === 0) continue;

      // このコスト項目のドライバータイプを取得（最初のルールから）
      const driverType = itemRules[0].driverType;

      if (itemRules[0].manualOverride) {
        // 手動配分率の場合
        for (const rule of itemRules) {
          const allocatedAmount = cost.amount * (rule.driverRatio / 100);
          results.push({
            costItemCode: cost.costItemCode,
            departmentType: rule.allocationTargetType,
            driverType: rule.driverType,
            driverRate: rule.driverRatio / 100,
            allocatedAmount,
          });
        }
      } else {
        // ドライバーベース配賦
        const relevantDrivers = driverValues.filter(
          (d) => d.driverType === driverType && d.departmentType !== "TOTAL"
        );
        const totalDriverValue = relevantDrivers.reduce(
          (sum, d) => sum + d.driverValue,
          0
        );

        if (totalDriverValue === 0) continue;

        const driverRate = cost.amount / totalDriverValue;

        for (const driver of relevantDrivers) {
          const allocatedAmount = driver.driverValue * driverRate;
          results.push({
            costItemCode: cost.costItemCode,
            departmentType: driver.departmentType,
            driverType,
            driverRate,
            allocatedAmount,
          });
        }
      }
    }

    // 結果を保存
    await Promise.all(
      results.map((r) =>
        prisma.allocationResult.create({
          data: {
            clinicId,
            yearMonth,
            costItemCode: r.costItemCode,
            departmentType: r.departmentType as any,
            driverType: r.driverType,
            driverRate: r.driverRate,
            allocatedAmount: r.allocatedAmount,
          },
        })
      )
    );

    return NextResponse.json({
      success: true,
      resultCount: results.length,
      results,
    });
  } catch (error) {
    console.error("Allocation calculation error:", error);
    return NextResponse.json({ error: "配賦計算に失敗しました" }, { status: 500 });
  }
}
