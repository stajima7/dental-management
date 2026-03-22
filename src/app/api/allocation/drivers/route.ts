import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { DepartmentType } from "@prisma/client";

// GET /api/allocation/drivers?clinicId=xxx&yearMonth=2025-01
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

    const drivers = await prisma.allocationDriverValue.findMany({
      where: { clinicId, yearMonth },
      orderBy: [{ driverType: "asc" }, { departmentType: "asc" }],
    });

    return NextResponse.json(drivers);
  } catch (error) {
    console.error("Driver values fetch error:", error);
    return NextResponse.json({ error: "ドライバー値の取得に失敗しました" }, { status: 500 });
  }
}

// POST /api/allocation/drivers - ドライバー値一括登録
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const body = await req.json();
    const { clinicId, yearMonth, drivers } = body;

    if (!clinicId || !yearMonth || !Array.isArray(drivers)) {
      return NextResponse.json({ error: "clinicId, yearMonth, driversが必要です" }, { status: 400 });
    }

    const results = await Promise.all(
      drivers.map((d: { driverType: string; departmentType: string; driverValue: number }) =>
        prisma.allocationDriverValue.upsert({
          where: {
            clinicId_yearMonth_driverType_departmentType: {
              clinicId,
              yearMonth,
              driverType: d.driverType,
              departmentType: d.departmentType as DepartmentType,
            },
          },
          update: { driverValue: d.driverValue },
          create: {
            clinicId,
            yearMonth,
            driverType: d.driverType,
            departmentType: d.departmentType as DepartmentType,
            driverValue: d.driverValue,
          },
        })
      )
    );

    return NextResponse.json({ success: true, count: results.length });
  } catch (error) {
    console.error("Driver values save error:", error);
    return NextResponse.json({ error: "ドライバー値の保存に失敗しました" }, { status: 500 });
  }
}
