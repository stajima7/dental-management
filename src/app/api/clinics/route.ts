import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { clinicCreateSchema, formatZodErrors } from "@/lib/validations";

// POST /api/clinics - 医院を新規作成
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const body = await req.json();
    const result = clinicCreateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "入力内容に問題があります", details: formatZodErrors(result.error) },
        { status: 400 }
      );
    }

    const { clinicName, corporateName, prefecture, city, openingYear, corporateType, clinicType, isHomeVisit } = result.data;

    const clinic = await prisma.clinic.create({
      data: {
        clinicName,
        corporateName: corporateName || null,
        prefecture: prefecture || null,
        city: city || null,
        openingYear: openingYear || null,
        corporateType: corporateType || "INDIVIDUAL",
        clinicType: clinicType || "[]",
        isHomeVisit: isHomeVisit || false,
        users: {
          create: {
            userId: (session.user as any).id,
            role: "ADMIN",
          },
        },
      },
    });

    return NextResponse.json(clinic, { status: 201 });
  } catch (error) {
    console.error("Clinic creation error:", error);
    return NextResponse.json({ error: "医院の作成に失敗しました" }, { status: 500 });
  }
}

// GET /api/clinics - ユーザーに紐づく医院一覧
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const userId = (session.user as any).id;

    const clinicUsers = await prisma.clinicUser.findMany({
      where: { userId },
      include: {
        clinic: {
          include: {
            profiles: {
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
      },
    });

    const clinics = clinicUsers.map((cu: any) => ({
      ...cu.clinic,
      role: cu.role,
      profile: cu.clinic.profiles[0] || null,
    }));

    return NextResponse.json(clinics);
  } catch (error) {
    console.error("Clinics fetch error:", error);
    return NextResponse.json({ error: "医院一覧の取得に失敗しました" }, { status: 500 });
  }
}
