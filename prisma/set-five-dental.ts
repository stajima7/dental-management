/**
 * ファイブ歯科の医院設定を反映する（ユーザー指定値, 2026-07-17）
 * 実行: npx tsx prisma/set-five-dental.ts
 *
 * 注意: ローカル .env のDBは本番と同一。実行すると本番に即反映される。
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const clinic = await prisma.clinic.findFirst({ where: { clinicName: "ファイブ歯科" } });
  if (!clinic) throw new Error("医院「ファイブ歯科」が見つかりません");
  const clinicId = clinic.id;

  // ---------- 医院基本情報 ----------
  await prisma.clinic.update({
    where: { id: clinicId },
    data: {
      clinicName: "ファイブ歯科",
      corporateName: null,        // 医療法人化していない
      prefecture: "東京都",
      city: "葛飾区",
      openingYear: 2018,
      corporateType: "INDIVIDUAL", // 医療法人化していない = 個人
      isHomeVisit: true,           // 訪問診療を行っている
      isSetupComplete: true,
    },
  });

  // ---------- 設備・規模 / 人員 / 稼働条件 ----------
  // 注: IOS を保存するフィールドは無い（設備は CT/マイクロ/CAD-CAM/オペ室 のみ）
  // 注: 事務長は count でなく hasOfficeManager(bool)。0名 → false
  // 注: その他の職種の count フィールドは無い（0名なので影響なし）
  const profileData = {
    unitCount: 5,
    activeUnitCount: 4,
    hasCt: true,
    hasMicroscope: true,
    hasCadcam: false,
    hasOperationRoom: false,
    fulltimeDentistCount: 1,
    parttimeDentistCount: 2,
    fulltimeHygienistCount: 2,
    parttimeHygienistCount: 1,
    fulltimeAssistantCount: 2,
    parttimeAssistantCount: 5,
    fulltimeReceptionCount: 1,
    parttimeReceptionCount: 2,
    fulltimeTechnicianCount: 0,
    parttimeTechnicianCount: 0,
    hasOfficeManager: false,
    clinicDaysPerMonth: 24,
    avgHoursPerDay: 9,
    avgOvertimeHours: 1.5,      // 1〜2時間の中間
    avgTreatmentMinutes: 30,
    workHours: "9:00-18:00",
  };
  const existingProfile = await prisma.clinicProfile.findFirst({ where: { clinicId } });
  if (existingProfile) {
    await prisma.clinicProfile.update({ where: { id: existingProfile.id }, data: profileData });
  } else {
    await prisma.clinicProfile.create({ data: { clinicId, ...profileData } });
  }

  // ---------- 目標値 ----------
  // ユーザーが指定した項目のみ更新し、空欄の項目（再来率・メンテ移行率・営業利益率など）は既存値を維持する
  const target = await prisma.clinicTarget.findFirst({ where: { clinicId }, orderBy: { createdAt: "desc" } });
  const targetData = {
    monthlyRevenue: 12_000_000,   // 月間目標売上 1200万円
    selfPayRatio: 20,             // 自費率目標 20%
    newPatients: 50,              // 月間新患目標 50名
    laborCostRatio: 20,           // 人件費率目標 20%
    revenuePerUnit: 30_000_000,   // ユニット当たり売上目標 3000万円（ユーザー指定値）
  };
  if (target) {
    await prisma.clinicTarget.update({ where: { id: target.id }, data: targetData });
  } else {
    await prisma.clinicTarget.create({ data: { clinicId, ...targetData } });
  }

  // ---------- 確認出力 ----------
  const c = await prisma.clinic.findUnique({ where: { id: clinicId } });
  const p = await prisma.clinicProfile.findFirst({ where: { clinicId }, orderBy: { createdAt: "desc" } });
  const t = await prisma.clinicTarget.findFirst({ where: { clinicId }, orderBy: { createdAt: "desc" } });
  const drFte = p!.fulltimeDentistCount + p!.parttimeDentistCount * 0.5;
  const dhFte = p!.fulltimeHygienistCount + p!.parttimeHygienistCount * 0.5;

  console.log("■ 医院基本情報");
  console.log(`   ${c!.clinicName} / 法人名=${c!.corporateName ?? "（無し）"} / ${c!.prefecture}${c!.city} / 開業${c!.openingYear}年 / ${c!.corporateType} / 訪問=${c!.isHomeVisit}`);
  console.log("■ 設備・規模");
  console.log(`   ユニット${p!.unitCount}台(稼働${p!.activeUnitCount}台) / CT=${p!.hasCt} マイクロ=${p!.hasMicroscope} CADCAM=${p!.hasCadcam} オペ室=${p!.hasOperationRoom}`);
  console.log("■ 人員（常勤/非常勤）");
  console.log(`   Dr ${p!.fulltimeDentistCount}/${p!.parttimeDentistCount}(FTE${drFte}) / DH ${p!.fulltimeHygienistCount}/${p!.parttimeHygienistCount}(FTE${dhFte}) / 助手 ${p!.fulltimeAssistantCount}/${p!.parttimeAssistantCount} / 受付 ${p!.fulltimeReceptionCount}/${p!.parttimeReceptionCount} / 技工士 ${p!.fulltimeTechnicianCount}/${p!.parttimeTechnicianCount} / 事務長=${p!.hasOfficeManager}`);
  console.log("■ 稼働条件");
  console.log(`   診療${p!.clinicDaysPerMonth}日/月 / 1日${p!.avgHoursPerDay}時間 / チェア占有${p!.avgTreatmentMinutes}分 / 残業${p!.avgOvertimeHours}時間`);
  console.log("■ 目標値");
  console.log(`   月商${(t!.monthlyRevenue! / 10000).toLocaleString()}万 / 自費率${t!.selfPayRatio}% / 新患${t!.newPatients}名 / 人件費率${t!.laborCostRatio}% / ユニット売上${(t!.revenuePerUnit! / 10000).toLocaleString()}万`);
  console.log(`   （空欄で据え置き）再来率=${t!.returnRate ?? "－"} メンテ移行率=${t!.maintenanceTransitionRate ?? "－"} 営業利益率=${t!.operatingProfitRate ?? "－"}`);

  console.log("\n設定を反映しました。");
}

main().catch((e) => { console.error("ERROR:", e); process.exit(1); }).finally(() => prisma.$disconnect());
