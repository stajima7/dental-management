import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * 増設シミュレーションの前提（職種別の人件費単価・売上の伸び方・税の要件）の取得と保存。
 *
 * 税制の要件は改正されるため、プログラムに直接書かず医院ごとの設定として持つ。
 */

const ROLES = ["DENTIST", "HYGIENIST", "ASSISTANT", "RECEPTION", "TECHNICIAN"] as const;
type Role = (typeof ROLES)[number];

async function assertAccess(userId: string, clinicId: string) {
  return !!(await prisma.clinicUser.findUnique({ where: { userId_clinicId: { userId, clinicId } } }));
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    const userId = (session.user as { id?: string }).id;
    const clinicId = new URL(req.url).searchParams.get("clinicId");
    if (!userId || !clinicId) return NextResponse.json({ error: "clinicIdが必要です" }, { status: 400 });
    if (!(await assertAccess(userId, clinicId))) {
      return NextResponse.json({ error: "アクセス権がありません" }, { status: 403 });
    }

    const [rates, setting] = await Promise.all([
      prisma.staffCostRate.findMany({ where: { clinicId } }),
      prisma.expansionSetting.findUnique({ where: { clinicId } }),
    ]);

    return NextResponse.json({
      staffCostRates: Object.fromEntries(ROLES.map((r) => [
        r, rates.find((x) => x.role === r)?.monthlyCost ?? null,
      ])),
      expansion: setting,
    });
  } catch (error) {
    console.error("capacity settings GET error:", error);
    return NextResponse.json({ error: "設定の取得に失敗しました" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    const userId = (session.user as { id?: string }).id;

    const body = await req.json();
    const { clinicId, staffCostRates, expansion } = body;
    if (!userId || !clinicId) return NextResponse.json({ error: "clinicIdが必要です" }, { status: 400 });
    if (!(await assertAccess(userId, clinicId))) {
      return NextResponse.json({ error: "アクセス権がありません" }, { status: 403 });
    }

    const num = (v: unknown) => {
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? n : null;
    };

    // --- 職種別の人件費単価 ---
    if (staffCostRates && typeof staffCostRates === "object") {
      for (const role of ROLES) {
        const value = num((staffCostRates as Record<string, unknown>)[role]);
        if (value == null) {
          // 空欄にされたら設定を削除する（未設定として扱う）
          await prisma.staffCostRate.deleteMany({ where: { clinicId, role: role as Role } });
          continue;
        }
        await prisma.staffCostRate.upsert({
          where: { clinicId_role: { clinicId, role: role as Role } },
          update: { monthlyCost: value },
          create: { clinicId, role: role as Role, monthlyCost: value },
        });
      }
    }

    // --- 増設の前提 ---
    if (expansion && typeof expansion === "object") {
      const e = expansion as Record<string, unknown>;
      const baseUnits = Number(e.baseUnitCount);
      const data = {
        baseUnitCount: Number.isFinite(baseUnits) ? Math.min(20, Math.max(1, Math.round(baseUnits))) : 3,
        revenuePerUnitBase: num(e.revenuePerUnitBase),
        revenuePerUnitMarginal: num(e.revenuePerUnitMarginal),
        useSpecialExpense: e.useSpecialExpense !== false,
        insuranceRevenueCap: num(e.insuranceRevenueCap) ?? 50_000_000,
        totalRevenueCap: num(e.totalRevenueCap) ?? 70_000_000,
        unitInvestmentCost: num(e.unitInvestmentCost) ?? 3_000_000,
      };
      await prisma.expansionSetting.upsert({
        where: { clinicId },
        update: data,
        create: { clinicId, ...data },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("capacity settings POST error:", error);
    return NextResponse.json({ error: "設定の保存に失敗しました" }, { status: 500 });
  }
}
