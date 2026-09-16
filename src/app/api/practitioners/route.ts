import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getClinicAccess, userIdOf } from "@/lib/access";

/**
 * 担当者（歯科医師・歯科衛生士）の名簿
 *
 * 退職した人は削除せず「入力の対象外」にすれば、過去の実績は分析に残る。
 * 削除すると過去の実績も消えるため、画面では確認を求める。
 */

const ROLES = ["DENTIST", "HYGIENIST"];
const EMPLOYMENT = ["FULLTIME", "PARTTIME"];
const MAX_NAME = 50;

// GET /api/practitioners?clinicId=xxx
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

    const clinicId = new URL(req.url).searchParams.get("clinicId");
    if (!clinicId) return NextResponse.json({ error: "clinicIdが必要です" }, { status: 400 });
    if (!(await getClinicAccess(userIdOf(session), clinicId))) {
      return NextResponse.json({ error: "アクセス権がありません" }, { status: 403 });
    }

    const practitioners = await prisma.practitioner.findMany({
      where: { clinicId },
      orderBy: [{ role: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
      include: { _count: { select: { monthlyStats: true } } },
    });

    return NextResponse.json(
      practitioners.map(({ _count, ...p }) => ({ ...p, statsCount: _count.monthlyStats }))
    );
  } catch (error) {
    console.error("practitioners GET error:", error);
    return NextResponse.json({ error: "名簿の取得に失敗しました" }, { status: 500 });
  }
}

// POST /api/practitioners - 担当者を追加
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

    const body = await req.json();
    const { clinicId } = body;
    if (!clinicId) return NextResponse.json({ error: "clinicIdが必要です" }, { status: 400 });
    if (!(await getClinicAccess(userIdOf(session), clinicId))) {
      return NextResponse.json({ error: "アクセス権がありません" }, { status: 403 });
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ error: "氏名を入力してください" }, { status: 400 });
    if (name.length > MAX_NAME) {
      return NextResponse.json({ error: `氏名は${MAX_NAME}文字以内にしてください` }, { status: 400 });
    }
    if (!ROLES.includes(body.role)) {
      return NextResponse.json({ error: "職種は歯科医師か歯科衛生士を選んでください" }, { status: 400 });
    }

    // CSVでは氏名で担当者を特定するため、同じ氏名は登録させない
    const duplicate = await prisma.practitioner.findUnique({
      where: { clinicId_name: { clinicId, name } },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: "同じ氏名の担当者が既にいます。同姓同名の場合は「山田 花子（衛生士）」のように区別してください" },
        { status: 400 }
      );
    }

    const last = await prisma.practitioner.findFirst({
      where: { clinicId, role: body.role },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const created = await prisma.practitioner.create({
      data: {
        clinicId,
        name,
        role: body.role,
        employmentType: EMPLOYMENT.includes(body.employmentType) ? body.employmentType : "FULLTIME",
        // 院長は歯科医師だけ
        isDirector: body.role === "DENTIST" && body.isDirector === true,
        sortOrder: (last?.sortOrder ?? 0) + 1,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("practitioners POST error:", error);
    return NextResponse.json({ error: "担当者の追加に失敗しました" }, { status: 500 });
  }
}

// PUT /api/practitioners - 氏名・雇用形態・院長・入力対象の変更
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

    const body = await req.json();
    const { clinicId, id } = body;
    if (!clinicId || !id) return NextResponse.json({ error: "clinicId, idが必要です" }, { status: 400 });
    if (!(await getClinicAccess(userIdOf(session), clinicId))) {
      return NextResponse.json({ error: "アクセス権がありません" }, { status: 403 });
    }

    // 別の医院の担当者を書き換えられないよう、医院と組で確かめる
    const current = await prisma.practitioner.findFirst({ where: { id, clinicId } });
    if (!current) return NextResponse.json({ error: "担当者が見つかりません" }, { status: 404 });

    const data: { name?: string; employmentType?: "FULLTIME" | "PARTTIME"; isDirector?: boolean; isActive?: boolean } = {};

    if (body.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name || name.length > MAX_NAME) {
        return NextResponse.json({ error: `氏名は1〜${MAX_NAME}文字で入力してください` }, { status: 400 });
      }
      if (name !== current.name) {
        const duplicate = await prisma.practitioner.findUnique({ where: { clinicId_name: { clinicId, name } }, select: { id: true } });
        if (duplicate) return NextResponse.json({ error: "同じ氏名の担当者が既にいます" }, { status: 400 });
      }
      data.name = name;
    }
    if (body.employmentType !== undefined && EMPLOYMENT.includes(body.employmentType)) {
      data.employmentType = body.employmentType;
    }
    if (typeof body.isDirector === "boolean") data.isDirector = current.role === "DENTIST" && body.isDirector;
    if (typeof body.isActive === "boolean") data.isActive = body.isActive;

    const updated = await prisma.practitioner.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("practitioners PUT error:", error);
    return NextResponse.json({ error: "担当者の更新に失敗しました" }, { status: 500 });
  }
}

// DELETE /api/practitioners?clinicId=xxx&id=yyy - 担当者と、その人の実績を削除
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

    const sp = new URL(req.url).searchParams;
    const clinicId = sp.get("clinicId");
    const id = sp.get("id");
    if (!clinicId || !id) return NextResponse.json({ error: "clinicId, idが必要です" }, { status: 400 });
    if (!(await getClinicAccess(userIdOf(session), clinicId))) {
      return NextResponse.json({ error: "アクセス権がありません" }, { status: 403 });
    }

    // 別の医院の担当者を消せないよう、医院と組で削除する
    const result = await prisma.practitioner.deleteMany({ where: { id, clinicId } });
    if (result.count === 0) return NextResponse.json({ error: "担当者が見つかりません" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("practitioners DELETE error:", error);
    return NextResponse.json({ error: "担当者の削除に失敗しました" }, { status: 500 });
  }
}
