/**
 * 担当者別実績のCSV読み込み
 *
 * レセコンや勤怠システムから出したCSVを、手入力せずに取り込めるようにする。
 * 取り込んだ値はいったん入力欄に反映するだけで、保存は利用者が確認してから行う。
 *
 * ⚠️ 日本語版のExcelで保存したCSVは Shift_JIS になる。UTF-8だけを前提にすると
 *    氏名が文字化けして誰とも一致しなくなるため、両方を読めるようにしている。
 */

export interface CsvPractitionerRow {
  practitionerId: string;
  insuranceRevenue: number;
  selfPayRevenue: number;
  workHours: number;
  patientCount: number;
}

export interface CsvReadResult {
  rows: CsvPractitionerRow[];
  /** 名簿に無い氏名 */
  unmatched: string[];
  /** 読めなかった値など、利用者に確認してほしいこと */
  errors: string[];
}

/** UTF-8として読めなければ Shift_JIS として読む */
export function decodeCsvBuffer(buffer: ArrayBuffer): string {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    text = new TextDecoder("shift_jis").decode(buffer);
  }
  // Excel向けに付けられる先頭の目印（BOM）を外す
  return text.replace(/^﻿/, "");
}

/** ダブルクォートで囲まれたカンマ・改行にも対応したCSVの分解 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      rows.push(row); row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }

  // 空行は捨てる
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

/** 全角の英数字を半角にそろえる */
function toHalfWidth(s: string): string {
  return s.replace(/[０-９Ａ-Ｚａ-ｚ．，－]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
}

/** 氏名の照合用。空白（半角・全角）の有無で別人扱いにしないため取り除く */
export function normalizeName(name: string): string {
  return name.replace(/[\s　]/g, "");
}

/**
 * 金額・時間・人数の読み取り。「1,234,000円」「¥12,000」「１２３」なども読む。
 * 空欄は0。数として読めない場合は null。
 */
export function parseNumber(value: string | undefined): number | null {
  if (value == null) return 0;
  const cleaned = toHalfWidth(value).replace(/[,，円¥￥\s　]/g, "");
  if (cleaned === "" || cleaned === "-") return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** 見出しの照合用。空白と「（円）」のような括弧書きを取り除く */
function normalizeHeader(h: string): string {
  return toHalfWidth(h).replace(/[\s　]/g, "").replace(/[（(][^）)]*[）)]/g, "");
}

const HEADER_ALIASES = {
  name: ["氏名", "名前", "担当者", "担当者名", "担当医", "担当医名", "スタッフ名"],
  insuranceRevenue: ["保険売上", "保険", "保険診療", "保険収入", "保険診療売上"],
  insurancePoints: ["保険点数", "点数"],
  selfPayRevenue: ["自費売上", "自費", "自費診療", "自費収入", "自費診療売上"],
  workHours: ["勤務時間", "労働時間", "時間", "勤務時間数"],
  patientCount: ["担当患者数", "患者数", "延べ患者数", "延患者数", "来院数"],
} as const;

type HeaderKey = keyof typeof HEADER_ALIASES;

/** 保険点数1点あたりの金額 */
const YEN_PER_POINT = 10;

export function readPractitionerCsv(
  text: string,
  practitioners: { id: string; name: string }[]
): CsvReadResult {
  const errors: string[] = [];
  const table = parseCsv(text);
  if (table.length < 2) {
    return { rows: [], unmatched: [], errors: ["データの行が見つかりません（1行目を見出し、2行目以降をデータにしてください）"] };
  }

  const headers = table[0].map(normalizeHeader);
  const col: Partial<Record<HeaderKey, number>> = {};
  for (const key of Object.keys(HEADER_ALIASES) as HeaderKey[]) {
    const idx = headers.findIndex((h) => (HEADER_ALIASES[key] as readonly string[]).includes(h));
    if (idx >= 0) col[key] = idx;
  }

  if (col.name == null) {
    return { rows: [], unmatched: [], errors: ["「氏名」の列が見つかりません。1行目に「氏名」という見出しを入れてください"] };
  }
  const hasAnyValue = ["insuranceRevenue", "insurancePoints", "selfPayRevenue", "workHours", "patientCount"]
    .some((k) => col[k as HeaderKey] != null);
  if (!hasAnyValue) {
    return { rows: [], unmatched: [], errors: ["「保険売上」「自費売上」「勤務時間」「担当患者数」のいずれの列も見つかりません"] };
  }

  const byName = new Map(practitioners.map((p) => [normalizeName(p.name), p.id]));
  const result = new Map<string, CsvPractitionerRow>();
  const unmatched: string[] = [];

  table.slice(1).forEach((cells, i) => {
    const line = i + 2;
    const rawName = (cells[col.name!] ?? "").trim();
    if (!rawName) return;
    // 合計行は取り込まない
    if (/^(合計|計|総計|小計)$/.test(normalizeName(rawName))) return;

    const id = byName.get(normalizeName(rawName));
    if (!id) { unmatched.push(rawName); return; }

    const read = (key: HeaderKey, label: string): number => {
      const idx = col[key];
      if (idx == null) return 0;
      const v = parseNumber(cells[idx]);
      if (v == null) {
        errors.push(`${line}行目（${rawName}）の「${label}」を数として読めませんでした: ${cells[idx]}`);
        return 0;
      }
      return v;
    };

    // 保険売上の列が無く、点数しか無い場合は1点10円で金額にする
    const insuranceRevenue = col.insuranceRevenue != null
      ? read("insuranceRevenue", "保険売上")
      : read("insurancePoints", "保険点数") * YEN_PER_POINT;

    if (result.has(id)) {
      errors.push(`${rawName} が複数行あります。後の行（${line}行目）の値を使います`);
    }
    result.set(id, {
      practitionerId: id,
      insuranceRevenue: Math.round(insuranceRevenue),
      selfPayRevenue: Math.round(read("selfPayRevenue", "自費売上")),
      workHours: Math.round(read("workHours", "勤務時間") * 10) / 10,
      patientCount: Math.round(read("patientCount", "担当患者数")),
    });
  });

  return { rows: [...result.values()], unmatched, errors };
}

/** 入力用のひな形。Excelで文字化けしないよう先頭にBOMを付ける */
export function buildCsvTemplate(names: string[]): string {
  const header = "氏名,保険売上（円）,自費売上（円）,勤務時間,担当患者数";
  const body = names.map((n) => `${n.includes(",") ? `"${n}"` : n},,,,`);
  return "﻿" + [header, ...body].join("\r\n") + "\r\n";
}
