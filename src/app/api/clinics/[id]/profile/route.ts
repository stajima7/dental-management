import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// POST /api/clinics/[id]/profile - プロファイル作成
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

    // ユーザーのアクセス権確認
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

    const profile = await prisma.clinicProfile.create({
      data: {
        clinicId: id,
        targetYearMonth: body.targetYearMonth || null,
        unitCount: body.unitCount || 0,
        activeUnitCount: body.activeUnitCount || 0,
        fulltimeDentistCount: body.fulltimeDentistCount || 0,
        parttimeDentistCount: body.parttimeDentistCount || 0,
        fulltimeHygienistCount: body.fulltimeHygienistCount || 0,
        parttimeHygienistCount: body.parttimeHygienistCount || 0,
        fulltimeAssistantCount: body.fulltimeAssistantCount || 0,
        parttimeAssistantCount: body.parttimeAssistantCount || 0,
        fulltimeReceptionCount: body.fulltimeReceptionCount || 0,
        parttimeReceptionCount: body.parttimeReceptionCount || 0,
        fulltimeTechnicianCount: body.fulltimeTechnicianCount || 0,
        parttimeTechnicianCount: body.parttimeTechnicianCount || 0,
        hasOfficeManager: body.hasOfficeManager || false,
        hasCt: body.hasCt || false,
        hasMicroscope: body.hasMicroscope || false,
        hasCadcam: body.hasCadcam || false,
        hasOperationRoom: body.hasOperationRoom || false,
        clinicDaysPerMonth: body.clinicDaysPerMonth || 22,
        avgHoursPerDay: body.avgHoursPerDay || 8,
        avgOvertimeHours: body.avgOvertimeHours || 0,
        workHours: body.workHours || null,
      },
    });

    return NextResponse.json(profile, { status: 201 });
  } catch (error) {
    console.error("Profile creation error:", error);
    return NextResponse.json({ error: "プロファイルの作成に失敗しました" }, { status: 500 });
  }
}

// GET /api/clinics/[id]/profile - 最新プロファイル取得
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

    const profile = await prisma.clinicProfile.findFirst({
      where: { clinicId: id },
      orderBy: { createdAt: "desc" },
    });

    if (!profile) {
      return NextResponse.json({ error: "プロファイルが見つかりません" }, { status: 404 });
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error("Profile fetch error:", error);
    return NextResponse.json({ error: "プロファイルの取得に失敗しました" }, { status: 500 });
  }
}
