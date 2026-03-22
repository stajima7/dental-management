import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // 1. 管理ユーザー作成
  const hashedPassword = await bcrypt.hash("admin123", 12);
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@dental.com" },
    update: {},
    create: {
      name: "管理者",
      email: "admin@dental.com",
      password: hashedPassword,
      role: "ADMIN",
    },
  });

  // 2. サンプル医院作成
  const clinic = await prisma.clinic.create({
    data: {
      clinicName: "あおい歯科クリニック",
      corporateName: "医療法人あおい会",
      prefecture: "東京都",
      city: "渋谷区",
      openingYear: 2015,
      corporateType: "CORPORATION",
      clinicType: JSON.stringify(["保険中心", "メンテ重視"]),
      isHomeVisit: false,
      isSetupComplete: true,
    },
  });

  // ユーザーと医院の紐づけ
  await prisma.clinicUser.create({
    data: {
      userId: adminUser.id,
      clinicId: clinic.id,
      role: "ADMIN",
    },
  });

  // 3. 医院プロファイル
  await prisma.clinicProfile.create({
    data: {
      clinicId: clinic.id,
      unitCount: 5,
      activeUnitCount: 4,
      fulltimeDentistCount: 2,
      parttimeDentistCount: 1,
      fulltimeHygienistCount: 3,
      parttimeHygienistCount: 2,
      fulltimeAssistantCount: 2,
      parttimeAssistantCount: 1,
      fulltimeReceptionCount: 1,
      parttimeReceptionCount: 1,
      hasOfficeManager: true,
      hasCt: true,
      hasMicroscope: true,
      hasCadcam: true,
      hasOperationRoom: false,
      clinicDaysPerMonth: 22,
      avgHoursPerDay: 8,
      avgOvertimeHours: 1,
      workHours: "9:00-18:00",
    },
  });

  // 4. 目標値設定
  await prisma.clinicTarget.create({
    data: {
      clinicId: clinic.id,
      monthlyRevenue: 12000000,
      selfPayRatio: 25,
      newPatients: 50,
      returnRate: 85,
      cancelRate: 8,
      laborCostRatio: 25,
      materialCostRatio: 8,
      maintenanceTransitionRate: 30,
      grossProfitRate: 70,
      operatingProfitRate: 20,
      revenuePerUnit: 2000000,
      discontinuedRate: 5,
    },
  });

  // 5. 6ヶ月分のサンプル月次データ
  const months = [
    { ym: "2025-09", insRev: 6800000, selfRev: 2200000, mntRev: 1500000, hvRev: 300000, totalPat: 820, uniqPat: 480, newPat: 45, retPat: 435, dropout: 15, mntTrans: 38, appt: 900, cancel: 72, labor: 2750000, material: 680000, labFee: 450000, rent: 500000, util: 120000, lease: 180000, deprec: 250000, ad: 80000, comm: 30000, consum: 60000, misc: 40000 },
    { ym: "2025-10", insRev: 7100000, selfRev: 2400000, mntRev: 1600000, hvRev: 320000, totalPat: 850, uniqPat: 495, newPat: 48, retPat: 447, dropout: 12, mntTrans: 42, appt: 930, cancel: 65, labor: 2800000, material: 710000, labFee: 470000, rent: 500000, util: 125000, lease: 180000, deprec: 250000, ad: 100000, comm: 30000, consum: 65000, misc: 42000 },
    { ym: "2025-11", insRev: 6900000, selfRev: 2300000, mntRev: 1550000, hvRev: 310000, totalPat: 830, uniqPat: 485, newPat: 43, retPat: 442, dropout: 14, mntTrans: 40, appt: 910, cancel: 70, labor: 2780000, material: 690000, labFee: 460000, rent: 500000, util: 118000, lease: 180000, deprec: 250000, ad: 85000, comm: 30000, consum: 58000, misc: 38000 },
    { ym: "2025-12", insRev: 7500000, selfRev: 2800000, mntRev: 1400000, hvRev: 280000, totalPat: 870, uniqPat: 510, newPat: 52, retPat: 458, dropout: 10, mntTrans: 35, appt: 950, cancel: 80, labor: 2900000, material: 750000, labFee: 500000, rent: 500000, util: 130000, lease: 180000, deprec: 250000, ad: 120000, comm: 30000, consum: 70000, misc: 45000 },
    { ym: "2026-01", insRev: 7200000, selfRev: 2500000, mntRev: 1650000, hvRev: 330000, totalPat: 860, uniqPat: 500, newPat: 50, retPat: 450, dropout: 11, mntTrans: 44, appt: 940, cancel: 68, labor: 2850000, material: 720000, labFee: 480000, rent: 500000, util: 128000, lease: 180000, deprec: 250000, ad: 90000, comm: 30000, consum: 62000, misc: 40000 },
    { ym: "2026-02", insRev: 6600000, selfRev: 2100000, mntRev: 1450000, hvRev: 290000, totalPat: 790, uniqPat: 465, newPat: 40, retPat: 425, dropout: 16, mntTrans: 36, appt: 860, cancel: 75, labor: 2700000, material: 660000, labFee: 440000, rent: 500000, util: 115000, lease: 180000, deprec: 250000, ad: 75000, comm: 30000, consum: 55000, misc: 38000 },
  ];

  for (const m of months) {
    const total = m.insRev + m.selfRev + m.mntRev + m.hvRev;

    // 売上データ
    const revenues = [
      { dept: "INSURANCE" as const, revType: "TREATMENT" as const, insType: "INSURANCE" as const, amount: m.insRev },
      { dept: "SELF_PAY" as const, revType: "TREATMENT" as const, insType: "PRIVATE" as const, amount: m.selfRev },
      { dept: "MAINTENANCE" as const, revType: "PREVENTION" as const, insType: "MIXED" as const, amount: m.mntRev },
      { dept: "HOME_VISIT" as const, revType: "TREATMENT" as const, insType: "INSURANCE" as const, amount: m.hvRev },
      { dept: "TOTAL" as const, revType: "TREATMENT" as const, insType: "MIXED" as const, amount: total },
    ];

    for (const r of revenues) {
      await prisma.monthlyRevenue.create({
        data: {
          clinicId: clinic.id,
          yearMonth: m.ym,
          departmentType: r.dept,
          revenueType: r.revType,
          insuranceOrPrivate: r.insType,
          amount: r.amount,
        },
      });
    }

    // 患者データ
    await prisma.monthlyPatients.create({
      data: {
        clinicId: clinic.id,
        yearMonth: m.ym,
        departmentType: "TOTAL",
        totalPatientCount: m.totalPat,
        uniquePatientCount: m.uniqPat,
        newPatientCount: m.newPat,
        returnPatientCount: m.retPat,
        dropoutCount: m.dropout,
        maintenanceTransitionCount: m.mntTrans,
      },
    });

    // 予約データ
    await prisma.monthlyAppointments.create({
      data: {
        clinicId: clinic.id,
        yearMonth: m.ym,
        departmentType: "TOTAL",
        appointmentCount: m.appt,
        cancelCount: m.cancel,
        completedCount: m.appt - m.cancel,
      },
    });

    // コストデータ
    const costs: { code: string; amount: number; layer: "DIRECT" | "INDIRECT" }[] = [
      { code: "LABOR", amount: m.labor, layer: "INDIRECT" },
      { code: "DIRECT_MATERIAL", amount: m.material, layer: "DIRECT" },
      { code: "LAB_FEE", amount: m.labFee, layer: "DIRECT" },
      { code: "RENT", amount: m.rent, layer: "INDIRECT" },
      { code: "UTILITIES", amount: m.util, layer: "INDIRECT" },
      { code: "LEASE", amount: m.lease, layer: "INDIRECT" },
      { code: "DEPRECIATION", amount: m.deprec, layer: "INDIRECT" },
      { code: "ADVERTISING", amount: m.ad, layer: "INDIRECT" },
      { code: "COMMUNICATION", amount: m.comm, layer: "INDIRECT" },
      { code: "CONSUMABLES", amount: m.consum, layer: "INDIRECT" },
      { code: "MISCELLANEOUS", amount: m.misc, layer: "INDIRECT" },
    ];

    for (const c of costs) {
      await prisma.monthlyCosts.create({
        data: {
          clinicId: clinic.id,
          yearMonth: m.ym,
          costItemCode: c.code,
          departmentType: "TOTAL",
          costLayer: c.layer,
          amount: c.amount,
        },
      });
    }
  }

  // 6. デフォルト配賦ルール
  const defaultRules = [
    { code: "LABOR", driver: "REVENUE_RATIO" },
    { code: "RENT", driver: "AREA" },
    { code: "UTILITIES", driver: "REVENUE_RATIO" },
    { code: "LEASE", driver: "REVENUE_RATIO" },
    { code: "DEPRECIATION", driver: "REVENUE_RATIO" },
    { code: "ADVERTISING", driver: "REVENUE_RATIO" },
    { code: "COMMUNICATION", driver: "REVENUE_RATIO" },
    { code: "CONSUMABLES", driver: "REVENUE_RATIO" },
    { code: "MISCELLANEOUS", driver: "REVENUE_RATIO" },
  ];

  const deptTypes = ["INSURANCE", "SELF_PAY", "MAINTENANCE", "HOME_VISIT"] as const;
  for (const rule of defaultRules) {
    for (const dept of deptTypes) {
      await prisma.allocationRule.create({
        data: {
          clinicId: clinic.id,
          costItemCode: rule.code,
          allocationTargetType: dept,
          driverType: rule.driver,
          driverRatio: 25,
        },
      });
    }
  }

  console.log("Seed completed!");
  console.log(`  Admin user: admin@dental.com / admin123`);
  console.log(`  Clinic: ${clinic.clinicName} (${clinic.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
