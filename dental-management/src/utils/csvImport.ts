import Papa from 'papaparse';
import type { MonthlyData } from '../types';

export interface CSVParseResult {
  data: Record<string, string>[];
  headers: string[];
  errors: string[];
}

export const parseCSV = (file: File): Promise<CSVParseResult> => {
  return new Promise((resolve) => {
    // まずUTF-8で試す
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || [];
        // 文字化けチェック: ヘッダーに制御文字や文字化けパターンがあればShift_JISでリトライ
        const hasMojibake = headers.some(h => /[\ufffd]|[\u0080-\u009f]/.test(h) || h.length === 0);
        if (hasMojibake) {
          Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            encoding: 'Shift_JIS',
            complete: (r2) => {
              const h2 = r2.meta.fields || [];
              const e2 = r2.errors.map(e => `行${e.row}: ${e.message}`);
              resolve({ data: r2.data as Record<string, string>[], headers: h2, errors: e2 });
            },
            error: (err: Error) => {
              resolve({ data: [], headers: [], errors: [err.message] });
            },
          });
        } else {
          const errors = results.errors.map(e => `行${e.row}: ${e.message}`);
          resolve({ data: results.data as Record<string, string>[], headers, errors });
        }
      },
      error: (err: Error) => {
        resolve({ data: [], headers: [], errors: [err.message] });
      },
    });
  });
};

export interface ColumnMapping {
  yearMonth: string;
  totalRevenue: string;
  insuranceRevenue: string;
  selfPayRevenue: string;
  totalPatients: string;
  newPatients: string;
  returnPatients: string;
  cancelCount: string;
  appointmentCount: string;
  maintenancePatients: string;
  insurancePoints: string;
}

export const MAPPING_LABELS: Record<keyof ColumnMapping, string> = {
  yearMonth: '年月',
  totalRevenue: '総売上',
  insuranceRevenue: '保険売上',
  selfPayRevenue: '自費売上',
  totalPatients: '延患者数',
  newPatients: '新患数',
  returnPatients: '再来患者数',
  cancelCount: 'キャンセル数',
  appointmentCount: '予約件数',
  maintenancePatients: 'メンテ患者数',
  insurancePoints: '保険点数',
};

const parseNumber = (value: string | undefined): number => {
  if (!value) return 0;
  return Number(value.replace(/[,、]/g, '')) || 0;
};

export const applyMapping = (
  data: Record<string, string>[],
  mapping: ColumnMapping,
): MonthlyData[] => {
  return data
    .filter(row => row[mapping.yearMonth])
    .map(row => ({
      yearMonth: row[mapping.yearMonth] || '',
      totalRevenue: parseNumber(row[mapping.totalRevenue]),
      insuranceRevenue: parseNumber(row[mapping.insuranceRevenue]),
      selfPayRevenue: parseNumber(row[mapping.selfPayRevenue]),
      totalPatients: parseNumber(row[mapping.totalPatients]),
      newPatients: parseNumber(row[mapping.newPatients]),
      returnPatients: parseNumber(row[mapping.returnPatients]),
      cancelCount: parseNumber(row[mapping.cancelCount]),
      appointmentCount: parseNumber(row[mapping.appointmentCount]),
      maintenancePatients: parseNumber(row[mapping.maintenancePatients]),
      insurancePoints: parseNumber(row[mapping.insurancePoints]),
    }));
};

export const autoDetectMapping = (headers: string[]): Partial<ColumnMapping> => {
  const mapping: Partial<ColumnMapping> = {};

  const patterns: [keyof ColumnMapping, RegExp[]][] = [
    ['yearMonth', [/年月/, /month/, /期間/, /日付/]],
    ['totalRevenue', [/総売上/, /売上合計/, /total.*revenue/, /月商/]],
    ['insuranceRevenue', [/保険.*売上/, /保険.*収入/, /insurance/]],
    ['selfPayRevenue', [/自費.*売上/, /自費.*収入/, /self.*pay/]],
    ['totalPatients', [/延.*患者/, /総.*患者/, /患者.*数/, /total.*patient/]],
    ['newPatients', [/新患/, /new.*patient/, /初診/]],
    ['returnPatients', [/再来/, /再診/, /return/]],
    ['cancelCount', [/キャンセル/, /cancel/]],
    ['appointmentCount', [/予約/, /appointment/, /アポ/]],
    ['maintenancePatients', [/メンテ/, /maintenance/, /定期/, /リコール/]],
    ['insurancePoints', [/点数/, /保険点数/, /point/]],
  ];

  for (const [field, regexes] of patterns) {
    for (const header of headers) {
      if (regexes.some(r => r.test(header))) {
        mapping[field] = header;
        break;
      }
    }
  }

  return mapping;
};

// サンプルCSVデータ生成
export const generateSampleCSV = (): string => {
  const headers = '年月,総売上,保険売上,自費売上,延患者数,新患数,再来患者数,キャンセル数,予約件数,メンテ患者数,保険点数';
  const rows = [
    '2024-01,6500000,4800000,1700000,450,25,380,35,520,85,480000',
    '2024-02,7000000,5100000,1900000,470,28,390,32,530,90,510000',
    '2024-03,7200000,5200000,2000000,490,30,400,38,550,95,520000',
    '2024-04,6800000,4900000,1900000,460,22,388,40,540,88,490000',
    '2024-05,7100000,5000000,2100000,480,27,395,30,535,92,500000',
    '2024-06,7500000,5300000,2200000,500,32,410,28,560,100,530000',
    '2024-07,7300000,5100000,2200000,485,29,400,35,545,96,510000',
    '2024-08,6600000,4700000,1900000,440,20,370,42,510,82,470000',
    '2024-09,7100000,5000000,2100000,475,26,395,33,540,90,500000',
    '2024-10,7400000,5200000,2200000,495,31,405,30,555,98,520000',
    '2024-11,7600000,5300000,2300000,510,33,415,29,565,102,530000',
    '2024-12,7000000,4900000,2100000,465,24,390,38,530,88,490000',
  ];
  return [headers, ...rows].join('\n');
};
