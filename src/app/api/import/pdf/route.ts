import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"

// POST /api/import/pdf - PDFファイルアップロード＆OCR処理（基盤）
// 実際のOCR処理は外部サービス連携が必要
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get("file") as File
    const clinicId = formData.get("clinicId") as string

    if (!file || !clinicId) {
      return NextResponse.json({ error: "ファイルとclinicIdが必要です" }, { status: 400 })
    }

    const cu = await prisma.clinicUser.findUnique({
      where: { userId_clinicId: { userId: (session.user as any).id, clinicId } },
    })
    if (!cu) return NextResponse.json({ error: "アクセス権がありません" }, { status: 403 })

    // ファイルサイズチェック（10MB上限）
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "ファイルサイズは10MB以下にしてください" }, { status: 400 })
    }

    // UploadFileレコード作成
    const uploadFile = await prisma.uploadFile.create({
      data: {
        clinicId,
        fileName: file.name,
        fileType: "PDF",
        fileSize: file.size,
        status: "PENDING",
      },
    })

    // ImportJobレコード作成
    const importJob = await prisma.importJob.create({
      data: {
        clinicId,
        uploadFileId: uploadFile.id,
        sourceType: "PDF",
        status: "PENDING",
      },
    })

    // TODO: ここで実際のOCR処理を行う
    // - Google Cloud Vision API
    // - AWS Textract
    // - Azure Form Recognizer
    // のいずれかと連携
    // 現在はプレースホルダー

    return NextResponse.json({
      success: true,
      uploadFileId: uploadFile.id,
      importJobId: importJob.id,
      message: "PDFをアップロードしました。OCR処理は今後の対応予定です。",
      status: "PENDING",
    })
  } catch (error) {
    console.error("PDF import error:", error)
    return NextResponse.json({ error: "PDFインポートに失敗しました" }, { status: 500 })
  }
}
