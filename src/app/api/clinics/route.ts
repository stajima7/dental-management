import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { clinicCreateSchema, formatZodErrors } from "@/lib/validations";
import { isSuperAdmin } from "@/lib/access";

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

    const { clinicName, corporateName, prefecture, city, address, openingYear, corporateType, clinicType, isHomeVisit } = result.data;

    const clinic = await prisma.clinic.create({
      data: {
        clinicName,
        corporateName: corporateName || null,
        prefecture: prefecture || null,
        city: city || null,
        // スキーマは受け付けていたのに保存していなかったため、番地・建物名が失われていた
        address: address?.trim() || null,
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

    // 管理者（SUPER_ADMIN）は所属の有無にかかわらず全医院を扱える。
    // 画面側は所属している医院の一覧として受け取るため、同じ形に揃えて返す。
    const clinicUsers = (await isSuperAdmin(userId))
      ? (
          await prisma.clinic.findMany({
            include: { profiles: { orderBy: { createdAt: "desc" }, take: 1 } },
            orderBy: { clinicName: "asc" },
          })
        ).map((clinic) => ({ clinicId: clinic.id, role: "ADMIN", clinic }))
      : await prisma.clinicUser.findMany({
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

    // 各医院で実績データが存在する最新月（画面の初期表示月に使う）
    const latestMonths = await Promise.all(
      clinicUsers.map((cu: any) =>
        prisma.monthlyRevenue.findFirst({
          where: { clinicId: cu.clinicId },
          orderBy: { yearMonth: "desc" },
          select: { yearMonth: true },
        })
      )
    );

    const clinics = clinicUsers.map((cu: any, i: number) => ({
      ...cu.clinic,
      role: cu.role,
      profile: cu.clinic.profiles[0] || null,
      latestYearMonth: latestMonths[i]?.yearMonth || null,
    }));

    return NextResponse.json(clinics);
  } catch (error) {
    console.error("Clinics fetch error:", error);
    return NextResponse.json({ error: "医院一覧の取得に失敗しました" }, { status: 500 });
  }
}
