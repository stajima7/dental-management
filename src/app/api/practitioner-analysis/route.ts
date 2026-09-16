import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getClinicAccess, userIdOf } from "@/lib/access";
import { buildPractitionerReport } from "@/lib/practitioner-report";

const YEAR_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

// GET /api/practitioner-analysis?clinicId=xxx&yearMonth=2026-07&months=12
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

    // 推移は最大24か月まで（取得量を抑える）
    const months = Math.min(24, Math.max(1, Number(sp.get("months")) || 12));
    return NextResponse.json(await buildPractitionerReport(clinicId, yearMonth, months));
  } catch (error) {
    console.error("practitioner-analysis GET error:", error);
    return NextResponse.json({ error: "分析に失敗しました" }, { status: 500 });
  }
}
