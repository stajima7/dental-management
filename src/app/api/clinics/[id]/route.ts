import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/clinics/[id] - 医院詳細取得
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

    // ユーザーがこの医院にアクセスできるか確認
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

    const clinic = await prisma.clinic.findUnique({
      where: { id },
      include: {
        profiles: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        targets: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!clinic) {
      return NextResponse.json({ error: "医院が見つかりません" }, { status: 404 });
    }

    return NextResponse.json({
      ...clinic,
      profile: clinic.profiles[0] || null,
      target: clinic.targets[0] || null,
    });
  } catch (error) {
    console.error("Clinic fetch error:", error);
    return NextResponse.json({ error: "医院情報の取得に失敗しました" }, { status: 500 });
  }
}

// PUT /api/clinics/[id] - 医院情報更新
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { id } = await params;

    // ユーザーがこの医院のADMINか確認
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
    const {
      clinicName,
      corporateName,
      prefecture,
      city,
      openingYear,
      corporateType,
      clinicType,
      isHomeVisit,
      isSetupComplete,
    } = body;

    const updateData: Record<string, unknown> = {};
    if (clinicName !== undefined) updateData.clinicName = clinicName;
    if (corporateName !== undefined) updateData.corporateName = corporateName;
    if (prefecture !== undefined) updateData.prefecture = prefecture;
    if (city !== undefined) updateData.city = city;
    if (openingYear !== undefined) updateData.openingYear = openingYear;
    if (corporateType !== undefined) updateData.corporateType = corporateType;
    if (clinicType !== undefined) updateData.clinicType = clinicType;
    if (isHomeVisit !== undefined) updateData.isHomeVisit = isHomeVisit;
    if (isSetupComplete !== undefined) updateData.isSetupComplete = isSetupComplete;

    const clinic = await prisma.clinic.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(clinic);
  } catch (error) {
    console.error("Clinic update error:", error);
    return NextResponse.json({ error: "医院情報の更新に失敗しました" }, { status: 500 });
  }
}
