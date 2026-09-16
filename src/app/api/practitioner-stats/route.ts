import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getClinicAccess, userIdOf } from "@/lib/access";
import { totalRevenueOf } from "@/lib/kpi-calculator";

/**
 * 担当者別の月次実績（売上・勤務時間・担当患者数）の取得と保存
 */

const YEAR_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
/** 1か月の時間数の上限（31日×24時間）。桁の打ち間違いを保存前に止める */
const MAX_MONTH_HOURS = 744;

interface StatsRow {
  practitionerId: string;
  insuranceRevenue: number;
  selfPayRevenue: number;
  workHours: number;
  patientCount: number;
}

// GET /api/practitioner-stats?clinicId=xxx&yearMonth=2026-07
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

    const sp = new URL(req.url).searchParams;
    const clinicId = sp.get("clinicId");
    const yearMonth = sp.get("yearMonth");
    if (!clinicId || !yearMonth || !YEAR_MONTH.test(yearMonth)) {
      return NextResponse.json({ error: "clinicId, yearMonthが必要です" }, { status: 400 });
    }
    if (!(await getClinicAccess(userIdOf(session), clinicId))) {
      return NextResponse.json({ error: "アクセス権がありません" }, { status: 403 });
    }

    const [practitioners, stats, revenue] = await Promise.all([
      prisma.practitioner.findMany({
        where: { clinicId },
        orderBy: [{ role: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
      }),
      prisma.monthlyPractitionerStats.findMany({ where: { clinicId, yearMonth } }),
      // 入力した売上の合計を、医院全体の月商と突き合わせるため
      prisma.monthlyRevenue.findMany({ where: { clinicId, yearMonth }, select: { departmentType: true, amount: true } }),
    ]);

    return NextResponse.json({
      practitioners,
      stats,
      clinicRevenue: revenue.length > 0 ? totalRevenueOf(revenue) : null,
    });
  } catch (error) {
    console.error("practitioner-stats GET error:", error);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}

// POST /api/practitioner-stats - その月の実績をまとめて保存
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

    const body = await req.json();
    const { clinicId, yearMonth, rows } = body;
    if (!clinicId || typeof yearMonth !== "string" || !YEAR_MONTH.test(yearMonth) || !Array.isArray(rows)) {
      return NextResponse.json({ error: "clinicId, yearMonth, rowsが必要です" }, { status: 400 });
    }
    if (!(await getClinicAccess(userIdOf(session), clinicId))) {
      return NextResponse.json({ error: "アクセス権がありません" }, { status: 403 });
    }

    // 別の医院の担当者の実績を書き込めないよう、この医院の担当者に限る
    const owned = await prisma.practitioner.findMany({ where: { clinicId }, select: { id: true, name: true } });
    const nameOf = new Map(owned.map((p) => [p.id, p.name]));

    const num = (v: unknown) => {
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? n : 0;
    };

    const cleaned: StatsRow[] = [];
    for (const r of rows) {
      if (!r || !nameOf.has(r.practitionerId)) {
        return NextResponse.json({ error: "この医院に登録されていない担当者が含まれています" }, { status: 400 });
      }
      const workHours = Math.round(num(r.workHours) * 10) / 10;
      if (workHours > MAX_MONTH_HOURS) {
        return NextResponse.json(
          { error: `${nameOf.get(r.practitionerId)}の勤務時間（${workHours}時間）が1か月の時間数を超えています。入力を確認してください` },
          { status: 400 }
        );
      }
      cleaned.push({
        practitionerId: r.practitionerId as string,
        insuranceRevenue: Math.round(num(r.insuranceRevenue)),
        selfPayRevenue: Math.round(num(r.selfPayRevenue)),
        workHours,
        patientCount: Math.round(num(r.patientCount)),
      });
    }

    // すべて0の行は「入力を消した」とみなして削除する（0の記録が残ると未入力と区別できない）
    const isEmpty = (c: StatsRow) =>
      c.insuranceRevenue === 0 && c.selfPayRevenue === 0 && c.workHours === 0 && c.patientCount === 0;

    await prisma.$transaction(
      cleaned.map((c) => {
        if (isEmpty(c)) {
          return prisma.monthlyPractitionerStats.deleteMany({ where: { practitionerId: c.practitionerId, yearMonth } });
        }
        const { practitionerId, ...values } = c;
        return prisma.monthlyPractitionerStats.upsert({
          where: { practitionerId_yearMonth: { practitionerId, yearMonth } },
          update: values,
          create: { clinicId, practitionerId, yearMonth, ...values },
        });
      })
    );

    return NextResponse.json({ ok: true, saved: cleaned.filter((c) => !isEmpty(c)).length });
  } catch (error) {
    console.error("practitioner-stats POST error:", error);
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
  }
}
