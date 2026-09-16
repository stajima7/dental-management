"use client";

import { Input } from "@/components/ui/input";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { EMPLOYMENT_LABELS, PRACTITIONER_ROLES, ROLE_LABELS, revenueCoverage, safeDiv } from "@/lib/practitioner-analysis";

/**
 * 担当者別の月次実績の入力表
 *
 * 入力中の値は文字列で持つ（空欄と0を区別し、小数の途中入力を妨げないため）。
 */

export interface GridPractitioner {
  id: string;
  name: string;
  role: string;
  employmentType: string;
  isDirector: boolean;
  isActive: boolean;
}

export interface GridValues {
  insuranceRevenue: string;
  selfPayRevenue: string;
  workHours: string;
  patientCount: string;
}

export type GridField = keyof GridValues;

export const EMPTY_VALUES: GridValues = { insuranceRevenue: "", selfPayRevenue: "", workHours: "", patientCount: "" };

/** 1か月の時間数の上限（APIと同じ） */
export const MAX_MONTH_HOURS = 744;

export const toNumber = (s: string | undefined) => {
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const FIELDS: { key: GridField; label: string; hint: string; step: string }[] = [
  { key: "insuranceRevenue", label: "保険売上（円）", hint: "保険点数×10円", step: "1" },
  { key: "selfPayRevenue", label: "自費売上（円）", hint: "", step: "1" },
  { key: "workHours", label: "勤務時間", hint: "残業を含む", step: "0.5" },
  { key: "patientCount", label: "担当患者数", hint: "延べ人数", step: "1" },
];

export function StatsGrid({
  practitioners,
  values,
  onChange,
  clinicRevenue,
}: {
  practitioners: GridPractitioner[];
  values: Record<string, GridValues>;
  onChange: (id: string, field: GridField, value: string) => void;
  clinicRevenue: number | null;
}) {
  const v = (id: string) => values[id] ?? EMPTY_VALUES;
  const revenueOf = (id: string) => toNumber(v(id).insuranceRevenue) + toNumber(v(id).selfPayRevenue);

  const grandTotal = practitioners.reduce((s, p) => s + revenueOf(p.id), 0);
  const coverage = clinicRevenue != null ? revenueCoverage(grandTotal, clinicRevenue) : null;

  return (
    <div className="space-y-6">
      {PRACTITIONER_ROLES.map((role) => {
        const rows = practitioners.filter((p) => p.role === role);
        if (rows.length === 0) return null;
        const roleRevenue = rows.reduce((s, p) => s + revenueOf(p.id), 0);
        const roleHours = rows.reduce((s, p) => s + toNumber(v(p.id).workHours), 0);
        const roleHourly = safeDiv(roleRevenue, roleHours);

        return (
          <div key={role}>
            <h3 className="text-sm font-bold text-gray-800 mb-2">{ROLE_LABELS[role]}</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-gray-600">
                    <th className="px-2 py-2 text-left font-medium min-w-[9rem]">氏名</th>
                    {FIELDS.map((f) => (
                      <th key={f.key} className="px-2 py-2 text-right font-medium min-w-[8rem]">
                        {f.label}
                        {f.hint && <div className="text-[10px] font-normal text-gray-400">{f.hint}</div>}
                      </th>
                    ))}
                    <th className="px-2 py-2 text-right font-medium whitespace-nowrap">売上合計</th>
                    <th className="px-2 py-2 text-right font-medium whitespace-nowrap">時間単価</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    const val = v(p.id);
                    const revenue = revenueOf(p.id);
                    const hours = toNumber(val.workHours);
                    const hourly = safeDiv(revenue, hours);
                    const hoursOver = hours > MAX_MONTH_HOURS;
                    const needsHours = revenue > 0 && hours === 0;
                    return (
                      <tr key={p.id} className="border-b align-top">
                        <td className="px-2 py-2">
                          <div className="font-medium text-gray-900">{p.name}</div>
                          <div className="text-[11px] text-gray-500">
                            {EMPLOYMENT_LABELS[p.employmentType] ?? p.employmentType}
                            {p.isDirector && "・院長"}
                            {!p.isActive && <span className="text-amber-700">・入力対象外</span>}
                          </div>
                        </td>
                        {FIELDS.map((f) => (
                          <td key={f.key} className="px-2 py-1.5">
                            <Input
                              type="number"
                              inputMode="decimal"
                              min={0}
                              step={f.step}
                              aria-label={`${p.name} ${f.label}`}
                              className={`text-right ${f.key === "workHours" && hoursOver ? "border-red-400" : ""}`}
                              value={val[f.key]}
                              onChange={(e) => onChange(p.id, f.key, e.target.value)}
                            />
                            {/* 大きな金額は桁を読み違えやすいため、万円表記を添える */}
                            {(f.key === "insuranceRevenue" || f.key === "selfPayRevenue") && toNumber(val[f.key]) >= 10000 && (
                              <div className="text-[11px] text-gray-400 text-right mt-0.5">{formatCurrency(toNumber(val[f.key]))}</div>
                            )}
                            {f.key === "workHours" && hoursOver && (
                              <div className="text-[11px] text-red-600 text-right mt-0.5">1か月の時間数を超えています</div>
                            )}
                            {f.key === "workHours" && needsHours && (
                              <div className="text-[11px] text-amber-700 text-right mt-0.5">入力すると時間単価が出ます</div>
                            )}
                          </td>
                        ))}
                        <td className="px-2 py-2 text-right whitespace-nowrap text-gray-900">{revenue > 0 ? formatCurrency(revenue) : "－"}</td>
                        <td className="px-2 py-2 text-right whitespace-nowrap font-semibold text-gray-900">{hourly == null ? "－" : formatCurrency(hourly)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 text-gray-700">
                    <td className="px-2 py-2 font-medium">{ROLE_LABELS[role]}の合計</td>
                    <td className="px-2 py-2" colSpan={2} />
                    <td className="px-2 py-2 text-right">{roleHours > 0 ? `${formatNumber(roleHours)}時間` : ""}</td>
                    <td className="px-2 py-2" />
                    <td className="px-2 py-2 text-right font-medium whitespace-nowrap">{roleRevenue > 0 ? formatCurrency(roleRevenue) : "－"}</td>
                    <td className="px-2 py-2 text-right font-medium whitespace-nowrap">{roleHourly == null ? "－" : formatCurrency(roleHourly)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        );
      })}

      {/* 医院全体の月商との突き合わせ。保存前に入力漏れや二重計上に気づけるようにする */}
      <div className={`text-sm rounded-md px-4 py-3 border ${
        coverage == null || coverage.status === "nodata" || coverage.status === "ok"
          ? "bg-gray-50 border-gray-200 text-gray-700"
          : "bg-amber-50 border-amber-200 text-amber-800"
      }`}>
        担当者の売上合計 <strong>{formatCurrency(grandTotal)}</strong>
        {clinicRevenue != null && clinicRevenue > 0 ? (
          <>
            {" ／ "}この月の医院の月商 <strong>{formatCurrency(clinicRevenue)}</strong>
            {coverage?.ratio != null && <>（{coverage.ratio.toFixed(0)}%）</>}
            {coverage?.status === "low" && <div className="mt-1">⚠️ 月商より大きく少なくなっています。入力していない担当者がいないか確認してください。</div>}
            {coverage?.status === "over" && <div className="mt-1">⚠️ 月商を上回っています。同じ売上を歯科医師と衛生士の双方に入れていないか確認してください。</div>}
          </>
        ) : (
          <span className="text-gray-500">（この月の月商データが無いため、突き合わせはできません）</span>
        )}
      </div>
    </div>
  );
}
