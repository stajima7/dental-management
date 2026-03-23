const fs = require('fs');
const path = require('path');

// ============ 医院定義 ============
const clinics = [
  {
    name: 'スリー歯科',
    file: 'three_dental.csv',
    units: 3, activeUnits: 3,
    ftDentist: 1, ptDentist: 0,
    ftHygienist: 2, ptHygienist: 1,
    ftAssistant: 1, ptAssistant: 1,
    ftReception: 1, ptReception: 0,
    // 月商ベース（万円）
    baseRevenue: 450, // 月商450万
    insuranceRatio: 0.82, // 保険率82%
    basePatients: 380, // 延患者数
    baseUnique: 210, // 実患者数
    baseNew: 18, // 新患数
    baseLaborCost: 135, // 人件費（万円）
    baseMaterialCost: 45, // 材料費
    baseLabCost: 32, // 技工費
    baseRent: 35, // 家賃
    baseUtility: 8, // 水道光熱費
    baseOther: 25, // その他経費
  },
  {
    name: 'ファイブ歯科',
    file: 'five_dental.csv',
    units: 5, activeUnits: 5,
    ftDentist: 2, ptDentist: 1,
    ftHygienist: 3, ptHygienist: 2,
    ftAssistant: 2, ptAssistant: 1,
    ftReception: 1, ptReception: 1,
    baseRevenue: 850,
    insuranceRatio: 0.78,
    basePatients: 650,
    baseUnique: 350,
    baseNew: 30,
    baseLaborCost: 250,
    baseMaterialCost: 82,
    baseLabCost: 58,
    baseRent: 55,
    baseUtility: 14,
    baseOther: 45,
  },
  {
    name: 'セブン歯科',
    file: 'seven_dental.csv',
    units: 7, activeUnits: 6,
    ftDentist: 3, ptDentist: 1,
    ftHygienist: 4, ptHygienist: 3,
    ftAssistant: 3, ptAssistant: 2,
    ftReception: 2, ptReception: 1,
    baseRevenue: 1350,
    insuranceRatio: 0.75,
    basePatients: 980,
    baseUnique: 520,
    baseNew: 45,
    baseLaborCost: 400,
    baseMaterialCost: 130,
    baseLabCost: 95,
    baseRent: 80,
    baseUtility: 22,
    baseOther: 72,
  },
  {
    name: 'テン歯科',
    file: 'ten_dental.csv',
    units: 10, activeUnits: 8,
    ftDentist: 4, ptDentist: 2,
    ftHygienist: 6, ptHygienist: 3,
    ftAssistant: 4, ptAssistant: 3,
    ftReception: 2, ptReception: 1,
    baseRevenue: 2100,
    insuranceRatio: 0.72,
    basePatients: 1450,
    baseUnique: 780,
    baseNew: 65,
    baseLaborCost: 620,
    baseMaterialCost: 200,
    baseLabCost: 150,
    baseRent: 120,
    baseUtility: 35,
    baseOther: 115,
  },
  {
    name: 'トゥエルブ歯科',
    file: 'twelve_dental.csv',
    units: 12, activeUnits: 10,
    ftDentist: 5, ptDentist: 3,
    ftHygienist: 8, ptHygienist: 4,
    ftAssistant: 5, ptAssistant: 3,
    ftReception: 3, ptReception: 1,
    baseRevenue: 2800,
    insuranceRatio: 0.68,
    basePatients: 1900,
    baseUnique: 1020,
    baseNew: 85,
    baseLaborCost: 840,
    baseMaterialCost: 270,
    baseLabCost: 200,
    baseRent: 160,
    baseUtility: 48,
    baseOther: 155,
  },
];

// ============ 月次変動パターン ============
// 各月の季節変動係数（4月始まり: 4,5,6,7,8,9,10,11,12,1,2,3）
const seasonalFactors = [
  1.00, 1.02, 1.05, 0.92, 0.88, 1.03, 1.06, 1.08, 0.85, 0.95, 0.98, 1.10
];
const months = [
  '2025-04','2025-05','2025-06','2025-07','2025-08','2025-09',
  '2025-10','2025-11','2025-12','2026-01','2026-02','2026-03'
];
const workDays = [22, 21, 22, 20, 18, 21, 23, 21, 18, 20, 20, 23];

function rand(base, variance = 0.05) {
  return Math.round(base * (1 + (Math.random() - 0.5) * 2 * variance));
}

function generateCSV(clinic) {
  const headers = [
    '年月',
    '医院名',
    // 売上
    '保険診療売上', '自費診療売上', '物販売上', '合計売上',
    // 患者数
    '延患者数', '実患者数', '新患数', '再来患者数', '中断患者数', 'メンテ移行数',
    // 予約
    '予約数', 'キャンセル数', '無断キャンセル数',
    // コスト
    '人件費', '材料費', '技工費', '家賃', '水道光熱費', 'リース料', '広告費',
    '通信費', '消耗品費', '研修費', '雑費', '減価償却費',
    // 設備・人員
    'ユニット数', '稼働ユニット数',
    '常勤歯科医師数', '非常勤歯科医師数',
    '常勤歯科衛生士数', '非常勤歯科衛生士数',
    '常勤助手数', '非常勤助手数',
    '常勤受付数', '非常勤受付数',
    '診療日数', '平均診療時間',
  ];

  const rows = months.map((ym, i) => {
    const sf = seasonalFactors[i];
    const wd = workDays[i];

    // 売上計算
    const totalRev = rand(clinic.baseRevenue * sf, 0.06);
    const insuranceRev = Math.round(totalRev * clinic.insuranceRatio * (1 + (Math.random() - 0.5) * 0.04));
    const selfPayRev = Math.round((totalRev - insuranceRev) * 0.92);
    const retailRev = totalRev - insuranceRev - selfPayRev;

    // 患者数
    const totalPatients = rand(clinic.basePatients * sf * (wd / 22), 0.06);
    const uniquePatients = rand(clinic.baseUnique * sf * (wd / 22), 0.06);
    const newPatients = rand(clinic.baseNew * sf, 0.10);
    const returnPatients = uniquePatients - newPatients;
    const dropoutCount = rand(Math.round(uniquePatients * 0.05), 0.15);
    const maintenanceTransition = rand(Math.round(uniquePatients * 0.12), 0.12);

    // 予約
    const appointments = rand(Math.round(totalPatients * 1.08), 0.04);
    const cancels = rand(Math.round(appointments * 0.10), 0.15);
    const noShows = rand(Math.round(appointments * 0.02), 0.20);

    // コスト（万円）
    const laborCost = rand(clinic.baseLaborCost, 0.03);
    const materialCost = rand(clinic.baseMaterialCost * sf, 0.08);
    const labCost = rand(clinic.baseLabCost * sf, 0.08);
    const rent = clinic.baseRent; // 固定
    const utility = rand(clinic.baseUtility * (i >= 3 && i <= 5 ? 1.2 : i >= 9 && i <= 11 ? 1.15 : 1.0), 0.06);
    const lease = rand(Math.round(clinic.baseRevenue * 0.03), 0.02);
    const adCost = rand(Math.round(clinic.baseRevenue * 0.025), 0.15);
    const telecom = rand(Math.round(clinic.baseRevenue * 0.008), 0.05);
    const supplies = rand(Math.round(clinic.baseRevenue * 0.015), 0.10);
    const training = rand(Math.round(clinic.baseRevenue * 0.01), 0.20);
    const misc = rand(Math.round(clinic.baseRevenue * 0.012), 0.10);
    const depreciation = rand(Math.round(clinic.baseRevenue * 0.035), 0.02);

    return [
      ym,
      clinic.name,
      insuranceRev, selfPayRev, retailRev, totalRev,
      totalPatients, uniquePatients, newPatients, returnPatients, dropoutCount, maintenanceTransition,
      appointments, cancels, noShows,
      laborCost, materialCost, labCost, rent, utility, lease, adCost,
      telecom, supplies, training, misc, depreciation,
      clinic.units, clinic.activeUnits,
      clinic.ftDentist, clinic.ptDentist,
      clinic.ftHygienist, clinic.ptHygienist,
      clinic.ftAssistant, clinic.ptAssistant,
      clinic.ftReception, clinic.ptReception,
      wd, 8.5,
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

// ============ ファイル生成 ============
const outDir = path.join(__dirname);
clinics.forEach(clinic => {
  const csv = generateCSV(clinic);
  const filePath = path.join(outDir, clinic.file);
  fs.writeFileSync(filePath, '\uFEFF' + csv, 'utf8'); // BOM付きUTF-8
  console.log(`✅ ${clinic.file} (${clinic.name}) - ${clinic.units}ユニット`);
});

console.log('\n全5ファイル生成完了！');
