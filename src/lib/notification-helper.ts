import prisma from "./prisma"
import { KPI_DEFINITIONS, getKpiStatus } from "./kpi-calculator"

/**
 * KPI閾値チェック＆通知生成
 * KPI計算後に呼ぶ
 */
export async function checkKpiThresholds(clinicId: string, yearMonth: string) {
  const kpis = await prisma.monthlyKpis.findMany({
    where: { clinicId, yearMonth },
  })

  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    include: { users: { include: { user: true } } },
  })
  if (!clinic) return

  const alerts: { kpiCode: string; kpiName: string; value: number; status: string }[] = []

  for (const kpi of kpis) {
    const status = getKpiStatus(kpi.kpiCode, kpi.kpiValue)
    if (status === "danger") {
      const def = KPI_DEFINITIONS[kpi.kpiCode]
      if (def) {
        alerts.push({
          kpiCode: kpi.kpiCode,
          kpiName: def.name,
          value: kpi.kpiValue,
          status,
        })
      }
    }
  }

  if (alerts.length === 0) return

  // 医院のADMIN/MEMBERユーザーに通知
  for (const cu of clinic.users) {
    if (cu.role === "VIEWER") continue

    const title = `${yearMonth} KPIアラート: ${alerts.length}件の要注意指標`
    const message = alerts
      .map((a) => `${a.kpiName}: ${a.value.toFixed(1)}`)
      .join("、")

    await prisma.notification.create({
      data: {
        userId: cu.userId,
        clinicId,
        type: "KPI_ALERT",
        title,
        message: `以下のKPIがベンチマークを大幅に下回っています: ${message}`,
        link: `/dashboard?yearMonth=${yearMonth}`,
      },
    })
  }
}
