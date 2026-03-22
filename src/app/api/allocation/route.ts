import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/allocation?clinicId=xxx - 配賦ルール取得
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const clinicId = searchParams.get("clinicId");

    if (!clinicId) {
      return NextResponse.json({ error: "clinicIdが必要です" }, { status: 400 });
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

    const rules = await prisma.allocationRule.findMany({
      where: { clinicId },
      orderBy: [{ costItemCode: "asc" }, { allocationTargetType: "asc" }],
    });

    return NextResponse.json(rules);
  } catch (error) {
    console.error("Allocation rules fetch error:", error);
    return NextResponse.json({ error: "配賦ルールの取得に失敗しました" }, { status: 500 });
  }
}

// POST /api/allocation - 配賦ルール保存
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const body = await req.json();
    const { clinicId, rules } = body;

    if (!clinicId || !Array.isArray(rules)) {
      return NextResponse.json({ error: "clinicId, rulesが必要です" }, { status: 400 });
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

    const results = await Promise.all(
      rules.map((rule: {
        costItemCode: string;
        allocationTargetType: string;
        driverType: string;
        driverRatio?: number;
        manualOverride?: boolean;
      }) =>
        prisma.allocationRule.upsert({
          where: {
            clinicId_costItemCode_allocationTargetType: {
              clinicId,
              costItemCode: rule.costItemCode,
              allocationTargetType: rule.allocationTargetType as any,
            },
          },
          update: {
            driverType: rule.driverType,
            driverRatio: rule.driverRatio || 0,
            manualOverride: rule.manualOverride || false,
          },
          create: {
            clinicId,
            costItemCode: rule.costItemCode,
            allocationTargetType: rule.allocationTargetType as any,
            driverType: rule.driverType,
            driverRatio: rule.driverRatio || 0,
            manualOverride: rule.manualOverride || false,
          },
        })
      )
    );

    return NextResponse.json({ success: true, count: results.length });
  } catch (error) {
    console.error("Allocation rules save error:", error);
    return NextResponse.json({ error: "配賦ルールの保存に失敗しました" }, { status: 500 });
  }
}
