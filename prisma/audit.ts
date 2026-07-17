/**
 * 整合性監査スクリプト（読み取り専用）
 *
 * デモデータとアプリのロジックが全体として矛盾していないかを機械的に検証する。
 * 実行: npx tsx prisma/audit.ts
 */
import { PrismaClient } from "@prisma/client";
import { calculateKpis, KPI_DEFINITIONS } from "../src/lib/kpi-calculator";
import { COST_ITEMS } from "../src/lib/constants";

const prisma = new PrismaClient();

let ng = 0;
const ok = (label: string, detail = "") => console.log(`  [OK] ${label}${detail ? " — " + detail : ""}`);
const fail = (label: string, detail: string) => { ng++; console.log(`  [NG] ${label} — ${detail}`); };
/** 丸め誤差を許容して比較 */
const near = (a: number, b: number, tol = 1) => Math.abs(a - b) <= tol;
const yen = (v: number) => Math.round(v).toLocaleString() + "円";

/** 画面・APIが参照しているKPIコード（grepで抽出したもの） */
const KPI_CODES_USED_BY_UI = [
  "totalPatientCount", "newPatientCount", "returnRate", "cancelRate", "uniquePatientCount",
  "returnPatientCount", "patientsPerDay", "appointmentCount", "cancelCount", "maintenanceTransitionRate",
  "insuranceRevenue", "selfPayRevenue", "maintenanceRevenue", "homeVisitRevenue", "totalRevenue",
  "grossProfitRate", "operatingProfitRate", "laborCostRatio", "dentistFte", "hygienistFte",
  "revenuePerDentist", "revenuePerHygienist", "revenuePerPatient", "revenuePerUnit",
  "selfPayRatio", "discontinuedRate", "materialCostRatio",
  "chairUtilization", "chairMinutesUsed", "chairMinutesAvailable", "revenuePerChairMinute", "idleChairLoss",
  "costPerAcquisition", "revenuePerNewPatient", "ltvToCpaRatio", "avgRetentionMonths",
  "insurancePoints", "revenuePerPoint", "pointDeductionRate",
  "noShowCount", "noShowRate", "noShowLoss",
  "totalStaffFte", "laborHoursTotal", "revenuePerLaborHour", "overtimeRatio",
  "marginalProfitRate", "breakEvenRevenue", "safetyMarginRate", "breakEvenChairUtilization", "breakEvenPatientCount",
];

async function main() {
  const clinic = await prisma.clinic.findFirst({ where: { clinicName: "ファイブ歯科" } });
  const clinicId = clinic!.id;
  const months = (await prisma.monthlyRevenue.findMany({
    where: { clinicId }, select: { yearMonth: true }, distinct: ["yearMonth"], orderBy: { yearMonth: "asc" },
  })).map((m) => m.yearMonth);

  console.log(`監査対象: ${clinic!.clinicName} / ${months.length}ヶ月 (${months[0]} 〜 ${months[months.length - 1]})\n`);

  // ---------- 1. 画面が参照するKPIが全て保存されているか ----------
  console.log("1. 画面が参照するKPIコードがDBに存在するか");
  const storedCodes = new Set((await prisma.monthlyKpis.findMany({
    where: { clinicId, yearMonth: months[months.length - 1] }, select: { kpiCode: true },
  })).map((k) => k.kpiCode));
  const missing = KPI_CODES_USED_BY_UI.filter((c) => !storedCodes.has(c));
  if (missing.length === 0) ok(`画面が使う${KPI_CODES_USED_BY_UI.length}コード全てが保存済み`);
  else fail("未保存のKPIがある", `${missing.join(", ")} → 画面では0表示になる`);

  // 定義漏れチェック
  const undefinedCodes = KPI_CODES_USED_BY_UI.filter((c) => !KPI_DEFINITIONS[c]);
  if (undefinedCodes.length === 0) ok("画面が使うコード全てが KPI_DEFINITIONS に定義済み");
  else fail("KPI_DEFINITIONS に定義が無い", undefinedCodes.join(", "));

  // ---------- 2. コスト費目コードがマスタに存在するか ----------
  console.log("\n2. DBのコスト費目コードが費目マスタに存在するか");
  const masterCodes = new Set<string>(Object.values(COST_ITEMS).map((i) => i.code));
  const dbCodes = (await prisma.monthlyCosts.findMany({
    where: { clinicId }, select: { costItemCode: true }, distinct: ["costItemCode"],
  })).map((c) => c.costItemCode);
  const orphan = dbCodes.filter((c) => !masterCodes.has(c));
  if (orphan.length === 0) ok(`${dbCodes.length}費目すべてマスタに存在`);
  else fail("マスタに無い費目がある", `${orphan.join(", ")} → コスト画面で費目名が出ずコードのまま表示される`);

  // ---------- 3. 売上の内訳合計 == TOTAL ----------
  console.log("\n3. 売上: 部門別の合計とTOTAL行が一致するか");
  let revNg = 0;
  for (const ym of months) {
    const rows = await prisma.monthlyRevenue.findMany({ where: { clinicId, yearMonth: ym } });
    const total = rows.find((r) => r.departmentType === "TOTAL")?.amount ?? 0;
    const sum = rows.filter((r) => r.departmentType !== "TOTAL").reduce((s, r) => s + r.amount, 0);
    if (!near(total, sum)) { fail(`${ym}`, `TOTAL=${yen(total)} だが内訳合計=${yen(sum)}`); revNg++; }
  }
  if (revNg === 0) ok(`全${months.length}ヶ月で一致`);

  // ---------- 4. 保存済みKPI == 生データからの再計算 ----------
  console.log("\n4. 保存済みKPIが生データと一致するか（再計算して突合）");
  const profile = await prisma.clinicProfile.findFirst({ where: { clinicId } });
  let kpiNg = 0;
  for (const ym of months) {
    const [revenue, patients, appointments, costs] = await Promise.all([
      prisma.monthlyRevenue.findMany({ where: { clinicId, yearMonth: ym } }),
      prisma.monthlyPatients.findMany({ where: { clinicId, yearMonth: ym } }),
      prisma.monthlyAppointments.findMany({ where: { clinicId, yearMonth: ym } }),
      prisma.monthlyCosts.findMany({ where: { clinicId, yearMonth: ym } }),
    ]);
    const fresh = calculateKpis({ revenue, patients, appointments, costs } as never, profile as never);
    const stored = await prisma.monthlyKpis.findMany({ where: { clinicId, yearMonth: ym } });
    for (const f of fresh) {
      const s = stored.find((x) => x.kpiCode === f.kpiCode);
      if (!s) { fail(`${ym} ${f.kpiCode}`, "未保存"); kpiNg++; }
      else if (!near(s.kpiValue, f.kpiValue, 0.01)) { fail(`${ym} ${f.kpiCode}`, `保存=${s.kpiValue} 再計算=${f.kpiValue}`); kpiNg++; }
    }
  }
  if (kpiNg === 0) ok(`全${months.length}ヶ月・全KPIが再計算値と一致`);

  // ---------- 5. 配賦: 配賦額の合計 == 元の間接費（配賦漏れ・二重配賦がないか）----------
  console.log("\n5. 配賦: 間接費が過不足なく各部門に配賦されているか");
  let allocNg = 0;
  for (const ym of months) {
    const indirect = await prisma.monthlyCosts.findMany({
      where: { clinicId, yearMonth: ym, departmentType: "TOTAL", costLayer: "INDIRECT" },
    });
    const results = await prisma.allocationResult.findMany({ where: { clinicId, yearMonth: ym } });
    for (const c of indirect) {
      const allocated = results.filter((r) => r.costItemCode === c.costItemCode).reduce((s, r) => s + r.allocatedAmount, 0);
      if (!near(allocated, c.amount, 1)) {
        fail(`${ym} ${c.costItemCode}`, `間接費=${yen(c.amount)} だが配賦額合計=${yen(allocated)}`); allocNg++;
      }
    }
  }
  if (allocNg === 0) ok(`全${months.length}ヶ月で間接費と配賦額が一致（配賦漏れなし）`);

  // ---------- 6. 部門別採算が全社PLと突き合うか ----------
  console.log("\n6. 部門別採算の合計が全社の売上・営業利益と一致するか");
  let deptNg = 0;
  for (const ym of months) {
    const dp = await prisma.departmentProfitability.findMany({ where: { clinicId, yearMonth: ym } });
    const kpis = await prisma.monthlyKpis.findMany({ where: { clinicId, yearMonth: ym } });
    const totalRevenue = kpis.find((k) => k.kpiCode === "totalRevenue")?.kpiValue ?? 0;
    const operatingProfit = kpis.find((k) => k.kpiCode === "operatingProfit")?.kpiValue ?? 0;

    const deptRevSum = dp.reduce((s, d) => s + d.revenue, 0);
    if (!near(deptRevSum, totalRevenue, 1)) { fail(`${ym} 売上`, `全社=${yen(totalRevenue)} 部門合計=${yen(deptRevSum)}`); deptNg++; }

    const deptProfitSum = dp.reduce((s, d) => s + d.postAllocationOperatingProfit, 0);
    if (!near(deptProfitSum, operatingProfit, 2)) { fail(`${ym} 営業利益`, `全社=${yen(operatingProfit)} 部門合計=${yen(deptProfitSum)}`); deptNg++; }
  }
  if (deptNg === 0) ok(`全${months.length}ヶ月で売上・営業利益とも一致`);

  // ---------- 7. 損益分岐点が正しいか（BEP売上なら利益0になるはず）----------
  console.log("\n7. 損益分岐点: BEP売上で営業利益が0になるか（検算）");
  let bepNg = 0;
  for (const ym of months) {
    const k = await prisma.monthlyKpis.findMany({ where: { clinicId, yearMonth: ym } });
    const val = (code: string) => k.find((x) => x.kpiCode === code)?.kpiValue ?? 0;
    const fixedCost = val("directAssignedCost") + val("indirectCost");
    // BEP売上における限界利益が固定費とちょうど釣り合えば利益0
    const profitAtBep = (val("breakEvenRevenue") * val("marginalProfitRate")) / 100 - fixedCost;
    if (!near(profitAtBep, 0, 1)) {
      fail(`${ym}`, `BEP売上での営業利益が${yen(profitAtBep)}（0であるべき）`);
      bepNg++;
    }
  }
  if (bepNg === 0) ok(`全${months.length}ヶ月で検算一致`);

  // ---------- 8. 経営指標が実在の歯科医院として妥当な水準か ----------
  console.log("\n8. 主要指標の水準（最新月）");
  const latest = months[months.length - 1];
  const k = await prisma.monthlyKpis.findMany({ where: { clinicId, yearMonth: latest } });
  const v = (code: string) => k.find((x) => x.kpiCode === code)?.kpiValue ?? 0;
  const rows: [string, string, string][] = [
    ["月商", yen(v("totalRevenue")), "-"],
    ["自費率", v("selfPayRatio").toFixed(1) + "%", "目標25% / BM20%"],
    ["人件費率", v("laborCostRatio").toFixed(1) + "%", "BM25%（役員報酬は含まない）"],
    ["材料費率", v("materialCostRatio").toFixed(1) + "%", "BM8%"],
    ["売上総利益率", v("grossProfitRate").toFixed(1) + "%", "BM70%"],
    ["営業利益率", v("operatingProfitRate").toFixed(1) + "%", "BM20%"],
    ["再来率", v("returnRate").toFixed(1) + "%", "BM80%"],
    ["中断率", v("discontinuedRate").toFixed(1) + "%", "BM5%"],
    ["メンテ移行率", v("maintenanceTransitionRate").toFixed(1) + "%", "BM30%"],
    ["キャンセル率", v("cancelRate").toFixed(1) + "%", "BM10%"],
    ["ユニット1台売上", yen(v("revenuePerUnit")), "BM150万円"],
    ["チェア稼働率", v("chairUtilization").toFixed(1) + "%", "BM75%（上限85%）"],
    ["チェア分単価", yen(v("revenuePerChairMinute")), "歯科の目安200〜400円"],
    ["空き枠損失額", yen(v("idleChairLoss")), "稼働率85%まで埋めた場合の増収余地"],
    ["新患獲得単価", yen(v("costPerAcquisition")), "BM1万円以下"],
    ["新患1人生涯売上", yen(v("revenuePerNewPatient")), "推計値（月商÷新患数）"],
    ["LTV/獲得単価比", v("ltvToCpaRatio").toFixed(1) + "倍", "BM3倍以上"],
    ["平均継続月数", v("avgRetentionMonths").toFixed(1) + "ヶ月", "中断率の逆数"],
    ["1点あたり単価", v("revenuePerPoint").toFixed(2) + "円", "BM10円（1点=10円）"],
    ["返戻・査定減率", v("pointDeductionRate").toFixed(1) + "%", "BM2%以下"],
    ["無断キャンセル率", v("noShowRate").toFixed(1) + "%", "BM2%以下"],
    ["人時生産性", yen(v("revenuePerLaborHour")), "残業込みの実労働時間あたり"],
    ["残業比率", v("overtimeRatio").toFixed(1) + "%", "BM10%以下"],
    ["限界利益率", v("marginalProfitRate").toFixed(1) + "%", "変動費=直接原価"],
    ["損益分岐点売上", yen(v("breakEvenRevenue")), "-"],
    ["安全余裕率", v("safetyMarginRate").toFixed(1) + "%", "BM20%以上"],
    ["BEPチェア稼働率", v("breakEvenChairUtilization").toFixed(1) + "%", `現在${v("chairUtilization").toFixed(1)}%`],
    ["BEP延患者数", Math.round(v("breakEvenPatientCount")) + "人", `現在${Math.round(v("totalPatientCount"))}人`],
  ];
  for (const [name, value, bm] of rows) console.log(`     ${name.padEnd(16)} ${value.padStart(14)}   ${bm}`);

  console.log(`\n${ng === 0 ? "✅ 全ての整合性チェックをパスしました。" : `❌ ${ng}件の不整合が見つかりました。`}`);
}

main().catch((e) => { console.error("ERROR:", e); process.exit(1); }).finally(() => prisma.$disconnect());
