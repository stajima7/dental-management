import prisma from "./prisma"

/**
 * 監査ログ記録ヘルパー
 */
export async function logAudit(params: {
  userId: string
  clinicId?: string
  action: string
  entity: string
  entityId?: string
  detail?: string
  ipAddress?: string
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        clinicId: params.clinicId || null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId || null,
        detail: params.detail || null,
        ipAddress: params.ipAddress || null,
      },
    })
  } catch (error) {
    console.error("Audit log error:", error)
  }
}
