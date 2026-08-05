import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * 患者データ（リコール／キャンセル理由／中断患者）の取得・保存。
 *
 * これらは月次集計テーブルとは別に持つため、専用の入力経路が要る。
 * 保存後は該当月のKPIを削除し、次に画面を開いたとき再計算されるようにする
 * （/api/kpi は保存済みKPIが無ければ生データから計算し直すため）。
 */

async function assertAccess(userId: string, clinicId: string) {
  const clinicUser = await prisma.clinicUser.findUnique({
    where: { userId_clinicId: { userId, clinicId } },
  });
  return !!clinicUser;
}

// GET /api/patient-data?clinicId=xxx&yearMonth=2025-01
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const clinicId = searchParams.get("clinicId");
    const yearMonth = searchParams.get("yearMonth");
    if (!clinicId || !yearMonth) {
      return NextResponse.json({ error: "clinicId, yearMonthが必要です" }, { status: 400 });
    }
    if (!(await assertAccess((session.user as { id: string }).id, clinicId))) {
      return NextResponse.json({ error: "アクセス権がありません" }, { status: 403 });
    }

    const [recall, cancelDetails, discontinued, appointments] = await Promise.all([
      prisma.monthlyRecall.findUnique({ where: { clinicId_yearMonth: { clinicId, yearMonth } } }),
      prisma.monthlyCancelDetail.findMany({ where: { clinicId, yearMonth } }),
      prisma.monthlyDiscontinued.findUnique({ where: { clinicId_yearMonth: { clinicId, yearMonth } } }),
      // 入力したキャンセル内訳の合計と突き合わせるため、登録済みのキャンセル総数を返す
      prisma.monthlyAppointments.findFirst({ where: { clinicId, yearMonth, departmentType: "TOTAL" } }),
    ]);

    return NextResponse.json({
      recall,
      cancelDetails,
      discontinued,
      registeredCancelCount: appointments?.cancelCount ?? null,
    });
  } catch (error) {
    console.error("patient-data GET error:", error);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}

// POST /api/patient-data - 保存（送られたセクションのみ更新する）
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

    const body = await req.json();
    const { clinicId, yearMonth, recall, cancelDetails, discontinued } = body;
    if (!clinicId || !yearMonth) {
      return NextResponse.json({ error: "clinicId, yearMonthが必要です" }, { status: 400 });
    }
    if (!(await assertAccess((session.user as { id: string }).id, clinicId))) {
      return NextResponse.json({ error: "アクセス権がありません" }, { status: 403 });
    }

    const n = (v: unknown) => Math.max(0, Math.round(Number(v) || 0));

    // --- リコール ---
    if (recall) {
      const notified = n(recall.notifiedCount);
      // 各段階は前の段階を超えられない（通知していない人が予約に至ることはない）
      const booked = Math.min(n(recall.bookedCount), notified);
      const visited = Math.min(n(recall.visitedCount), booked);
      const rebooked = Math.min(n(recall.rebookedCount), visited);
      const data = { notifiedCount: notified, bookedCount: booked, visitedCount: visited, rebookedCount: rebooked };
      await prisma.monthlyRecall.upsert({
        where: { clinicId_yearMonth: { clinicId, yearMonth } },
        update: data,
        create: { clinicId, yearMonth, ...data },
      });
    }

    // --- キャンセル理由内訳 ---
    if (Array.isArray(cancelDetails)) {
      // 入力から消された理由を残さないよう、その月の内訳を入れ替える
      await prisma.monthlyCancelDetail.deleteMany({ where: { clinicId, yearMonth } });
      const rows = cancelDetails
        .map((c: { category: string; reasonCode: string; count: unknown; recoveredCount: unknown }) => {
          const count = n(c.count);
          return {
            clinicId, yearMonth,
            category: c.category === "CLINIC" ? "CLINIC" as const : "PATIENT" as const,
            reasonCode: String(c.reasonCode),
            count,
            // 取り直せた件数がキャンセル件数を超えることはない
            recoveredCount: Math.min(n(c.recoveredCount), count),
          };
        })
        .filter((c) => c.count > 0);
      if (rows.length > 0) {
        await prisma.monthlyCancelDetail.createMany({ data: rows });
      }
    }

    // --- 中断患者 ---
    if (discontinued) {
      const data = {
        noNextAppointment: n(discontinued.noNextAppointment),
        afterCancel: n(discontinued.afterCancel),
        afterNoShow: n(discontinued.afterNoShow),
        maintenanceOverdue: n(discontinued.maintenanceOverdue),
      };
      await prisma.monthlyDiscontinued.upsert({
        where: { clinicId_yearMonth: { clinicId, yearMonth } },
        update: data,
        create: { clinicId, yearMonth, ...data },
      });
    }

    // 保存した内容をKPIに反映させる（次回表示時に再計算される）
    await prisma.monthlyKpis.deleteMany({ where: { clinicId, yearMonth } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("patient-data POST error:", error);
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
  }
}
