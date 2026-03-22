import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { BENCHMARKS } from "@/lib/constants";

/**
 * GET /api/ai?clinicId=xxx&yearMonth=2025-01 - AI分析結果取得
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const clinicId = searchParams.get("clinicId");
    const yearMonth = searchParams.get("yearMonth");

    if (!clinicId) {
      return NextResponse.json({ error: "clinicIdが必要です" }, { status: 400 });
    }

    const clinicUser = await prisma.clinicUser.findUnique({
      where: {
        userId_clinicId: {
          userId: (session.user as any).id,
          clinicId,
        },
      },
    });
    if (!clinicUser) {
      return NextResponse.json({ error: "アクセス権がありません" }, { status: 403 });
    }

    const where: Record<string, unknown> = { clinicId };
    if (yearMonth) where.yearMonth = yearMonth;

    const insights = await prisma.aiInsight.findMany({
      where,
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json(insights);
  } catch (error) {
    console.error("AI insights fetch error:", error);
    return NextResponse.json({ error: "AI分析結果の取得に失敗しました" }, { status: 500 });
  }
}

/**
 * POST /api/ai - AI分析を実行（ルールベース）
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const body = await req.json();
    const { clinicId, yearMonth } = body;

    if (!clinicId || !yearMonth) {
      return NextResponse.json({ error: "clinicId, yearMonthが必要です" }, { status: 400 });
    }

    const clinicUser = await prisma.clinicUser.findUnique({
      where: {
        userId_clinicId: {
          userId: (session.user as any).id,
          clinicId,
        },
      },
    });
    if (!clinicUser) {
      return NextResponse.json({ error: "アクセス権がありません" }, { status: 403 });
    }

    // 既存のインサイトを削除
    await prisma.aiInsight.deleteMany({
      where: { clinicId, yearMonth },
    });

    // KPIデータ取得
    const kpis = await prisma.monthlyKpis.findMany({
      where: { clinicId, yearMonth },
    });

    if (kpis.length === 0) {
      return NextResponse.json({ error: "KPIデータがありません。先にKPI計算を実行してください。" }, { status: 400 });
    }

    const getKpi = (code: string) => kpis.find((k: { kpiCode: string; kpiValue: number }) => k.kpiCode === code)?.kpiValue || 0;

    const insights: {
      category: string;
      area: string;
      title: string;
      description: string;
      cause: string;
      suggestion: string;
      expectedImpact: string;
      impact: string;
      difficulty: string;
      priority: number;
    }[] = [];

    // === ルールベース分析 ===

    // 自費率チェック
    const selfPayRatio = getKpi("selfPayRatio");
    if (selfPayRatio < BENCHMARKS.selfPayRatio) {
      insights.push({
        category: "revenue",
        area: "自費診療",
        title: "自費率が業界平均を下回っています",
        description: `自費率 ${selfPayRatio.toFixed(1)}% は目標 ${BENCHMARKS.selfPayRatio}% を下回っています。`,
        cause: "自費メニューの提案不足、カウンセリング体制の未整備、患者への説明時間不足が考えられます。",
        suggestion: "自費カウンセリングの導入、TC（トリートメントコーディネーター）の配置、自費メニュー表の作成を検討してください。",
        expectedImpact: `自費率を${BENCHMARKS.selfPayRatio}%まで改善した場合、月間売上が約${Math.round(getKpi("totalRevenue") * (BENCHMARKS.selfPayRatio - selfPayRatio) / 100 / 10000)}万円増加する見込みです。`,
        impact: "HIGH",
        difficulty: "MEDIUM",
        priority: 90,
      });
    }

    // 新患数チェック
    const newPatients = getKpi("newPatientCount");
    if (newPatients < BENCHMARKS.newPatientsMin) {
      insights.push({
        category: "patient",
        area: "新患獲得",
        title: "新患数が目標を下回っています",
        description: `新患数 ${newPatients}人/月 は目標 ${BENCHMARKS.newPatientsMin}人を下回っています。`,
        cause: "Web集患力不足、看板・外観の訴求力不足、口コミ促進施策の未実施が考えられます。",
        suggestion: "Googleビジネスプロフィールの最適化、Web広告の出稿、患者紹介カードの導入を検討してください。",
        expectedImpact: `新患1人当たりLTV（生涯価値）を考慮すると、月${BENCHMARKS.newPatientsMin - newPatients}人の増加で年間約${Math.round((BENCHMARKS.newPatientsMin - newPatients) * 50000 * 12 / 10000)}万円の増収が見込めます。`,
        impact: "HIGH",
        difficulty: "MEDIUM",
        priority: 85,
      });
    }

    // 再来率チェック
    const returnRate = getKpi("returnRate");
    if (returnRate < BENCHMARKS.returnRate) {
      insights.push({
        category: "patient",
        area: "患者維持",
        title: "再来率が低下しています",
        description: `再来率 ${returnRate.toFixed(1)}% は目標 ${BENCHMARKS.returnRate}% を下回っています。`,
        cause: "リコール体制の不備、患者フォローの不足、待ち時間の長さ、治療説明不足が考えられます。",
        suggestion: "リコールシステムの導入、治療完了後のフォローコール、患者満足度アンケートの実施を検討してください。",
        expectedImpact: `再来率を${BENCHMARKS.returnRate}%まで改善すると、月間売上が約${Math.round(getKpi("totalRevenue") * (BENCHMARKS.returnRate - returnRate) / 100 / 10000)}万円増加する見込みです。`,
        impact: "HIGH",
        difficulty: "LOW",
        priority: 88,
      });
    }

    // キャンセル率チェック
    const cancelRate = getKpi("cancelRate");
    if (cancelRate > BENCHMARKS.cancelRate) {
      insights.push({
        category: "operation",
        area: "予約管理",
        title: "キャンセル率が高い状態です",
        description: `キャンセル率 ${cancelRate.toFixed(1)}% は目標 ${BENCHMARKS.cancelRate}% を超えています。`,
        cause: "予約確認の不足、キャンセルポリシーの未整備、予約の取りやすさの問題が考えられます。",
        suggestion: "前日リマインド（SMS/LINE）の導入、キャンセルポリシーの明文化、キャンセル待ちリストの運用を検討してください。",
        expectedImpact: `キャンセル率を${BENCHMARKS.cancelRate}%に改善すると、月間で約${Math.round((cancelRate - BENCHMARKS.cancelRate) / 100 * getKpi("appointmentCount"))}枠の診療機会が確保できます。`,
        impact: "MEDIUM",
        difficulty: "LOW",
        priority: 75,
      });
    }

    // 人件費率チェック
    const laborCostRatio = getKpi("laborCostRatio");
    if (laborCostRatio > BENCHMARKS.laborCostRatio) {
      insights.push({
        category: "cost",
        area: "人件費",
        title: "人件費率が高い水準です",
        description: `人件費率 ${laborCostRatio.toFixed(1)}% は目標 ${BENCHMARKS.laborCostRatio}% を超えています。`,
        cause: "スタッフ過剰配置、残業の常態化、生産性の低下、シフト管理の非効率が考えられます。",
        suggestion: "シフトの最適化、業務分担の見直し、アポイント枠の効率化を検討してください。売上増による改善も有効です。",
        expectedImpact: `人件費率を${BENCHMARKS.laborCostRatio}%まで改善すると、月間利益が約${Math.round(getKpi("totalRevenue") * (laborCostRatio - BENCHMARKS.laborCostRatio) / 100 / 10000)}万円改善します。`,
        impact: "HIGH",
        difficulty: "HIGH",
        priority: 80,
      });
    }

    // ユニット当たり売上チェック
    const revenuePerUnit = getKpi("revenuePerUnit");
    if (revenuePerUnit < BENCHMARKS.revenuePerUnit) {
      insights.push({
        category: "productivity",
        area: "生産性",
        title: "ユニット当たり売上が低い水準です",
        description: `ユニット当たり月間売上 ${Math.round(revenuePerUnit / 10000)}万円 は目標 ${BENCHMARKS.revenuePerUnit / 10000}万円を下回っています。`,
        cause: "アポイント枠の空きが多い、1枠あたりの生産性が低い、ユニット稼働率が低いことが考えられます。",
        suggestion: "アポイント枠の見直し、ユニット稼働率の向上、予約枠の最適化を検討してください。",
        expectedImpact: `目標値まで改善すると、全体で月間約${Math.round((BENCHMARKS.revenuePerUnit - revenuePerUnit) * (getKpi("totalRevenue") / revenuePerUnit) / 10000)}万円の増収が見込めます。`,
        impact: "HIGH",
        difficulty: "MEDIUM",
        priority: 82,
      });
    }

    // 営業利益率チェック
    const opProfitRate = getKpi("operatingProfitRate");
    if (opProfitRate < BENCHMARKS.operatingProfitRate) {
      insights.push({
        category: "profit",
        area: "収益性",
        title: "営業利益率の改善が必要です",
        description: `営業利益率 ${opProfitRate.toFixed(1)}% は目標 ${BENCHMARKS.operatingProfitRate}% を下回っています。`,
        cause: "コスト構造の非効率、固定費の高止まり、売上の伸び悩みが複合的に影響しています。",
        suggestion: "上記の各改善施策を総合的に実施し、売上増とコスト削減の両面から利益率改善を目指してください。",
        expectedImpact: `営業利益率を${BENCHMARKS.operatingProfitRate}%に改善すると、月間利益が約${Math.round(getKpi("totalRevenue") * (BENCHMARKS.operatingProfitRate - opProfitRate) / 100 / 10000)}万円改善します。`,
        impact: "HIGH",
        difficulty: "HIGH",
        priority: 95,
      });
    }

    // 中断率チェック
    const discontinuedRate = getKpi("discontinuedRate");
    if (discontinuedRate > BENCHMARKS.discontinuedRate) {
      insights.push({
        category: "patient",
        area: "患者維持",
        title: "中断率が高い状態です",
        description: `中断率 ${discontinuedRate.toFixed(1)}% は目標 ${BENCHMARKS.discontinuedRate}% を超えています。`,
        cause: "治療中の痛みへの対応不足、治療計画の説明不足、通院負担の高さが考えられます。",
        suggestion: "治療計画の丁寧な説明、中断患者へのフォローコール、予約取りやすさの改善を検討してください。",
        expectedImpact: `中断率を${BENCHMARKS.discontinuedRate}%に改善すると、月間約${Math.round((discontinuedRate - BENCHMARKS.discontinuedRate) / 100 * getKpi("uniquePatientCount"))}人の治療完了患者が増加します。`,
        impact: "MEDIUM",
        difficulty: "MEDIUM",
        priority: 72,
      });
    }

    // 材料費率チェック
    const materialCostRatio = getKpi("materialCostRatio");
    if (materialCostRatio > BENCHMARKS.materialCostRatio) {
      insights.push({
        category: "cost",
        area: "材料費",
        title: "材料費率が高い水準です",
        description: `材料費率 ${materialCostRatio.toFixed(1)}% は目標 ${BENCHMARKS.materialCostRatio}% を超えています。`,
        cause: "仕入先の見直し不足、在庫管理の非効率、技工料の高止まりが考えられます。",
        suggestion: "仕入先の比較検討、共同購入の活用、在庫管理システムの導入を検討してください。",
        expectedImpact: `材料費率を${BENCHMARKS.materialCostRatio}%に改善すると、月間利益が約${Math.round(getKpi("totalRevenue") * (materialCostRatio - BENCHMARKS.materialCostRatio) / 100 / 10000)}万円改善します。`,
        impact: "MEDIUM",
        difficulty: "LOW",
        priority: 65,
      });
    }

    // 粗利益率チェック
    const grossProfitRate = getKpi("grossProfitRate");
    if (grossProfitRate < BENCHMARKS.grossProfitRate) {
      insights.push({
        category: "profit",
        area: "収益性",
        title: "売上総利益率の改善が必要です",
        description: `売上総利益率 ${grossProfitRate.toFixed(1)}% は目標 ${BENCHMARKS.grossProfitRate}% を下回っています。`,
        cause: "直接費（材料費・技工料）の増加、低利益率の治療が多い可能性があります。",
        suggestion: "自費率の向上、直接費の見直し、高付加価値治療メニューの拡充を検討してください。",
        expectedImpact: `粗利益率を${BENCHMARKS.grossProfitRate}%に改善すると、月間粗利益が約${Math.round(getKpi("totalRevenue") * (BENCHMARKS.grossProfitRate - grossProfitRate) / 100 / 10000)}万円改善します。`,
        impact: "HIGH",
        difficulty: "MEDIUM",
        priority: 78,
      });
    }

    // メンテ移行率
    const maintRate = getKpi("maintenanceTransitionRate");
    if (maintRate < BENCHMARKS.maintenanceTransitionRate) {
      insights.push({
        category: "patient",
        area: "メンテナンス",
        title: "メンテナンス移行率を改善できます",
        description: `メンテ移行率 ${maintRate.toFixed(1)}% は目標 ${BENCHMARKS.maintenanceTransitionRate}% を下回っています。`,
        cause: "治療完了時のメンテナンス説明不足、予防意識の啓発不足が考えられます。",
        suggestion: "治療完了時の予防プログラム提案、初診時からの予防カウンセリング導入を検討してください。",
        expectedImpact: `メンテ移行率の改善により安定的な定期収入基盤が構築でき、年間で約${Math.round(getKpi("uniquePatientCount") * (BENCHMARKS.maintenanceTransitionRate - maintRate) / 100 * 5000 * 4 / 10000)}万円の増収が見込めます。`,
        impact: "MEDIUM",
        difficulty: "LOW",
        priority: 70,
      });
    }

    // ポジティブな評価も追加
    if (selfPayRatio >= BENCHMARKS.selfPayRatio) {
      insights.push({
        category: "revenue",
        area: "自費診療",
        title: "自費率が良好な水準を維持しています",
        description: `自費率 ${selfPayRatio.toFixed(1)}% は目標を達成しています。引き続き維持してください。`,
        cause: "",
        suggestion: "さらなる向上を目指す場合、高付加価値メニューの拡充を検討してください。",
        expectedImpact: "",
        impact: "LOW",
        difficulty: "LOW",
        priority: 30,
      });
    }

    // インサイトを保存
    const savedInsights = await Promise.all(
      insights.map((insight) =>
        prisma.aiInsight.create({
          data: {
            clinicId,
            yearMonth,
            ...insight,
          },
        })
      )
    );

    return NextResponse.json(savedInsights);
  } catch (error) {
    console.error("AI analysis error:", error);
    return NextResponse.json({ error: "AI分析に失敗しました" }, { status: 500 });
  }
}
