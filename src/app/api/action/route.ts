import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { actionPlanCreateSchema, formatZodErrors } from "@/lib/validations"

// GET /api/action?clinicId=xxx
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const clinicId = searchParams.get("clinicId")
    if (!clinicId) {
      return NextResponse.json({ error: "clinicIdが必要です" }, { status: 400 })
    }

    const clinicUser = await prisma.clinicUser.findUnique({
      where: { userId_clinicId: { userId: (session.user as any).id, clinicId } },
    })
    if (!clinicUser) {
      return NextResponse.json({ error: "アクセス権がありません" }, { status: 403 })
    }

    const plans = await prisma.actionPlan.findMany({
      where: { clinicId },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    })

    return NextResponse.json(plans)
  } catch (error) {
    console.error("ActionPlan fetch error:", error)
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 })
  }
}

// POST /api/action - アクションプラン作成
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const body = await req.json()
    const validation = actionPlanCreateSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: "入力内容に問題があります", details: formatZodErrors(validation.error) },
        { status: 400 }
      )
    }

    const { clinicId, insightId, title, description, status, dueDate, assignee,
      kpiCode, baselineValue, targetValue, resultValue, expectedImpact } = validation.data

    const clinicUser = await prisma.clinicUser.findUnique({
      where: { userId_clinicId: { userId: (session.user as any).id, clinicId } },
    })
    if (!clinicUser) {
      return NextResponse.json({ error: "アクセス権がありません" }, { status: 403 })
    }

    const initialStatus = status || "TODO"

    const plan = await prisma.actionPlan.create({
      data: {
        clinicId,
        insightId: insightId || null,
        title,
        description,
        status: initialStatus,
        dueDate: dueDate ? new Date(dueDate) : null,
        assignee: assignee || null,
        kpiCode: kpiCode || null,
        baselineValue: baselineValue ?? null,
        targetValue: targetValue ?? null,
        resultValue: resultValue ?? null,
        expectedImpact: expectedImpact ?? null,
        // 着手・完了の日付は担当者に入力させず、ステータス変更から自動で記録する
        startedAt: initialStatus === "IN_PROGRESS" || initialStatus === "DONE" ? new Date() : null,
        completedAt: initialStatus === "DONE" ? new Date() : null,
      },
    })

    return NextResponse.json(plan, { status: 201 })
  } catch (error) {
    console.error("ActionPlan create error:", error)
    return NextResponse.json({ error: "作成に失敗しました" }, { status: 500 })
  }
}

// PUT /api/action - アクションプラン更新
export async function PUT(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const body = await req.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: "IDが必要です" }, { status: 400 })
    }

    const existing = await prisma.actionPlan.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "プランが見つかりません" }, { status: 404 })
    }

    const clinicUser = await prisma.clinicUser.findUnique({
      where: { userId_clinicId: { userId: (session.user as any).id, clinicId: existing.clinicId } },
    })
    if (!clinicUser) {
      return NextResponse.json({ error: "アクセス権がありません" }, { status: 403 })
    }

    // 着手・完了の日時はステータス変更から自動で記録する。
    // 一度記録した日時は、後でステータスを戻しても上書きしない（実績を消さないため）。
    const statusChanged = updateData.status !== undefined && updateData.status !== existing.status
    const timestamps: { startedAt?: Date; completedAt?: Date } = {}
    if (statusChanged) {
      if ((updateData.status === "IN_PROGRESS" || updateData.status === "DONE") && !existing.startedAt) {
        timestamps.startedAt = new Date()
      }
      if (updateData.status === "DONE" && !existing.completedAt) {
        timestamps.completedAt = new Date()
      }
    }

    const plan = await prisma.actionPlan.update({
      where: { id },
      data: {
        ...(updateData.title !== undefined && { title: updateData.title }),
        ...(updateData.description !== undefined && { description: updateData.description }),
        ...(updateData.status !== undefined && { status: updateData.status }),
        ...(updateData.dueDate !== undefined && { dueDate: updateData.dueDate ? new Date(updateData.dueDate) : null }),
        ...(updateData.assignee !== undefined && { assignee: updateData.assignee }),
        ...(updateData.kpiCode !== undefined && { kpiCode: updateData.kpiCode || null }),
        ...(updateData.baselineValue !== undefined && { baselineValue: updateData.baselineValue }),
        ...(updateData.targetValue !== undefined && { targetValue: updateData.targetValue }),
        ...(updateData.resultValue !== undefined && { resultValue: updateData.resultValue }),
        ...(updateData.expectedImpact !== undefined && { expectedImpact: updateData.expectedImpact }),
        ...timestamps,
      },
    })

    return NextResponse.json(plan)
  } catch (error) {
    console.error("ActionPlan update error:", error)
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 })
  }
}

// DELETE /api/action?id=xxx
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")
    if (!id) {
      return NextResponse.json({ error: "IDが必要です" }, { status: 400 })
    }

    const existing = await prisma.actionPlan.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "プランが見つかりません" }, { status: 404 })
    }

    const clinicUser = await prisma.clinicUser.findUnique({
      where: { userId_clinicId: { userId: (session.user as any).id, clinicId: existing.clinicId } },
    })
    if (!clinicUser) {
      return NextResponse.json({ error: "アクセス権がありません" }, { status: 403 })
    }

    await prisma.actionPlan.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("ActionPlan delete error:", error)
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 })
  }
}
