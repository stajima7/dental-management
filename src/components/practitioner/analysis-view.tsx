"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, ReferenceArea,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { formatCurrency, formatNumber } from "@/lib/utils";
import {
  EMPLOYMENT_LABELS, HOURLY_REVENUE_GUIDE, LABOR_MULTIPLE_LOW, LABOR_MULTIPLE_TARGET,
  PRACTITIONER_ROLES, ROLE_LABELS,
  type PractitionerMetrics, type PractitionerRole, type Verdict,
} from "@/lib/practitioner-analysis";
import type { PractitionerReport } from "@/lib/practitioner-report";

/**
 * 担当者別分析の表示
 *
 * 取得は呼び出し側で行い、ここは受け取った結果を描くだけにする。
 */

// 色覚の違いがあっても隣り合う線を見分けられることを検証済みの8色（この順で固定）。
// 色は人に結び付け、順位で塗り替えない（月を変えても同じ人は同じ色になるように）。
const SERIES_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
const MAX_SERIES = SERIES_COLORS.length;

const VERDICT_BADGE: Record<Verdict, { label: string; className: string }> = {
  high: { label: "▲ 高い", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  average: { label: "― 平均的", className: "bg-gray-50 text-gray-600 border-gray-200" },
  low: { label: "▼ 低い", className: "bg-amber-50 text-amber-800 border-amber-200" },
  nodata: { label: "未入力", className: "bg-white text-gray-400 border-gray-200" },
};

const dash = "－";
const money = (v: number | null) => (v == null ? dash : formatCurrency(v));
const pct = (v: number | null) => (v == null ? dash : `${v.toFixed(1)}%`);
const shortMonth = (ym: string) => `${ym.slice(2, 4)}/${Number(ym.slice(5))}`;
const longMonth = (ym: string) => `${ym.slice(0, 4)}年${Number(ym.slice(5))}月`;

/**
 * 軸の目盛りを切りのよい値にそろえる。
 * 最大値に10%の余白を足しただけだと「7,500円・2.9万円」のような半端な目盛りになり読みにくいため。
 */
function niceTicks(maxValue: number): number[] {
  const target = Math.max(maxValue, 1) * 1.05;
  const steps = [500, 1000, 2000, 2500, 5000, 10000, 20000, 25000, 50000, 100000];
  const step = steps.find((s) => target / s <= 6) ?? 100000;
  const top = Math.ceil(target / step) * step;
  return Array.from({ length: top / step + 1 }, (_, i) => i * step);
}

function guideVerdict(role: PractitionerRole, hourly: number | null) {
  if (hourly == null) return { text: null, status: "neutral" as const };
  const g = HOURLY_REVENUE_GUIDE[role];
  if (hourly < g.min) return { text: "目安を下回っています", status: "warning" as const };
  if (hourly > g.max) return { text: "目安を上回っています", status: "positive" as const };
  return { text: "目安の範囲内です", status: "positive" as const };
}

export function PractitionerAnalysisView({ report }: { report: PractitionerReport }) {
  const firstRoleWithData = PRACTITIONER_ROLES.find((r) => report.summaries[r].count > 0) ?? "DENTIST";
  const [role, setRole] = useState<PractitionerRole>(firstRoleWithData);

  const label = ROLE_LABELS[role];
  const summary = report.summaries[role];
  const guide = HOURLY_REVENUE_GUIDE[role];
  const gv = guideVerdict(role, summary.hourlyRevenue);
  const showLabor = report.hasLaborCost[role];

  // 色は名簿の並び順で決める（順位で決めない）
  const roster = report.practitioners.filter((p) => p.role === role);
  const colorOf = (id: string) => {
    const i = roster.findIndex((p) => p.id === id);
    return i >= 0 && i < MAX_SERIES ? SERIES_COLORS[i] : null;
  };

  // 表と棒グラフは時間単価の高い順。未入力の人は最後に回す
  const people = report.people
    .filter((p) => p.role === role)
    .sort((a, b) => (b.hourlyRevenue ?? -1) - (a.hourlyRevenue ?? -1));
  const ranked = people.filter((p) => p.hourlyRevenue != null);

  const barData = ranked.map((p) => ({ name: p.name, hourly: Math.round(p.hourlyRevenue!) }));
  const barTicks = niceTicks(Math.max(guide.max, ...barData.map((d) => d.hourly)));

  // 推移は、期間中に一度でも実績がある人だけ線を引く
  const trendPeople = roster.filter((p) => report.trend.some((t) => t.personHourly[p.id] != null)).slice(0, MAX_SERIES);
  const trendData = report.trend.map((t) => {
    const row: Record<string, string | number | null> = {
      month: shortMonth(t.yearMonth),
      yearMonth: t.yearMonth,
      overall: t.roleHourly[role] == null ? null : Math.round(t.roleHourly[role]!),
    };
    for (const p of trendPeople) {
      const v = t.personHourly[p.id];
      row[p.id] = v == null ? null : Math.round(v);
    }
    return row;
  });
  const trendMonthsWithData = report.trend.filter((t) => t.roleHourly[role] != null).length;
  const trendMax = Math.max(
    0,
    ...trendData.flatMap((row) => [row.overall, ...trendPeople.map((p) => row[p.id])]).filter((v): v is number => typeof v === "number")
  );
  const trendTicks = niceTicks(trendMax);
  // 凡例は「全体」を先頭に、あとは名簿の順（表の色の印と同じ順）に固定する
  const legendOrder = (item: { dataKey?: unknown }) =>
    item.dataKey === "overall" ? -1 : roster.findIndex((p) => p.id === item.dataKey);

  const coverageText = {
    ok: "おおむね一致しています。担当者別の数字は医院全体の売上を正しく分けたものと見てよい状態です。",
    low: "担当者の売上合計が月商より大きく少なくなっています。登録していない担当者や、入力漏れがないか確認してください。",
    over: "担当者の売上合計が月商を上回っています。同じ診療の売上を歯科医師と衛生士の双方に計上していないか確認してください。",
    nodata: report.clinicRevenue > 0
      ? "担当者の売上が入力されていないため、突き合わせできません。"
      : "この月の医院全体の月商データが無いため、突き合わせできません。",
  }[report.coverage.status];

  return (
    <div className="space-y-6">
      {/* その月のポイント。数字を並べるだけでは何を見ればよいか分からないため、文章で示す */}
      {report.highlights.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/40">
          <CardHeader><CardTitle>📌 {longMonth(report.yearMonth)}のポイント</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-gray-800 leading-relaxed">
              {report.highlights.map((h) => (
                <li key={h} className="flex gap-2"><span className="text-blue-500 shrink-0">●</span><span>{h}</span></li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* 職種の切り替え */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="職種">
        {PRACTITIONER_ROLES.map((r) => (
          <button
            key={r}
            role="tab"
            aria-selected={role === r}
            onClick={() => setRole(r)}
            className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
              role === r ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
          >
            {ROLE_LABELS[r]}（{report.summaries[r].count}名）
          </button>
        ))}
      </div>

      {people.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-gray-500 text-sm">
            {label}が名簿に登録されていません。
            <Link href="/practitioner-data" className="text-blue-600 hover:underline ml-1">担当者データ登録</Link>から追加してください。
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label={`時間単価（${label}全体）`}
              value={money(summary.hourlyRevenue)}
              status={gv.status}
              benchmarkLabel={`一般的な目安 ${formatCurrency(guide.min)}〜${formatCurrency(guide.max)}`}
              verdict={gv.text}
            />
            <KpiCard
              label="売上合計"
              value={formatCurrency(summary.totalRevenue)}
              sub={summary.count > 0 ? `${summary.count}名 ／ 1人あたり ${money(summary.revenuePerPerson)}` : "実績の入力なし"}
            />
            <KpiCard
              label="自費率"
              value={pct(summary.selfPayRatio)}
              sub={`自費売上 ${formatCurrency(summary.selfPayRevenue)}`}
            />
            <KpiCard
              label="担当患者1人あたり売上"
              value={money(summary.revenuePerPatient)}
              sub={`延べ${formatNumber(summary.totalPatients)}人 ／ 勤務${formatNumber(summary.totalHours)}時間`}
            />
          </div>

          {/* 担当者ごとの表（グラフの値もここで確認できる） */}
          <Card>
            <CardHeader><CardTitle>{label}ごとの実績</CardTitle></CardHeader>
            <CardContent>
              <p className="text-xs text-gray-500 mb-3">
                判定は、同じ職種の<strong>自分以外の人の平均</strong>と時間単価を比べたものです（±15%を超えると「高い」「低い」）。
              </p>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-gray-600">
                      <th className="px-3 py-2 text-left font-medium">氏名</th>
                      <th className="px-3 py-2 text-right font-medium">時間単価</th>
                      <th className="px-3 py-2 text-center font-medium">判定</th>
                      <th className="px-3 py-2 text-right font-medium">売上合計</th>
                      <th className="px-3 py-2 text-right font-medium">自費率</th>
                      <th className="px-3 py-2 text-right font-medium">勤務時間</th>
                      <th className="px-3 py-2 text-right font-medium">担当患者数</th>
                      <th className="px-3 py-2 text-right font-medium whitespace-nowrap">患者1人あたり</th>
                      <th className="px-3 py-2 text-right font-medium whitespace-nowrap">1時間あたり患者</th>
                      {showLabor && <th className="px-3 py-2 text-right font-medium whitespace-nowrap">人件費倍率</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {people.map((p) => <PersonRows key={p.id} p={p} color={colorOf(p.id)} showLabor={showLabor} />)}
                  </tbody>
                </table>
              </div>
              {!showLabor && (
                <p className="text-xs text-gray-500 mt-3">
                  💡 {label}の月額人件費を<Link href="/capacity" className="text-blue-600 hover:underline">増員・増設の検討</Link>で登録すると、
                  「売上が人件費の何倍か」（人件費倍率・目安{LABOR_MULTIPLE_TARGET}倍）も表示されます。
                </p>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>時間単価の比較</CardTitle></CardHeader>
              <CardContent>
                {barData.length === 0 ? (
                  <p className="text-gray-500 text-center py-8 text-sm">売上と勤務時間が入力されると表示されます</p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={Math.max(160, 60 + barData.length * 44)}>
                      <BarChart data={barData} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                        <CartesianGrid horizontal={false} stroke="#e5e7eb" />
                        <XAxis type="number" domain={[0, barTicks[barTicks.length - 1]]} ticks={barTicks} tickFormatter={(v) => formatCurrency(Number(v))} tick={{ fontSize: 11, fill: "#6b7280" }} />
                        <YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 12, fill: "#374151" }} />
                        {/* 一般的な目安の範囲（参考） */}
                        <ReferenceArea x1={guide.min} x2={guide.max} fill="#9ca3af" fillOpacity={0.12} ifOverflow="extendDomain" />
                        {summary.hourlyRevenue != null && (
                          <ReferenceLine x={summary.hourlyRevenue} stroke="#4b5563" strokeDasharray="4 3" strokeWidth={2} />
                        )}
                        <Tooltip formatter={(v) => [formatCurrency(Number(v)), "時間単価"]} cursor={{ fill: "#f3f4f6" }} />
                        <Bar dataKey="hourly" name="時間単価" fill={SERIES_COLORS[0]} radius={[0, 4, 4, 0]} barSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 mt-2">
                      <span className="flex items-center gap-1.5"><span className="inline-block w-5 border-t-2 border-dashed border-gray-600" />{label}全体 {money(summary.hourlyRevenue)}</span>
                      <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-3 bg-gray-400/20 border border-gray-300" />一般的な目安 {formatCurrency(guide.min)}〜{formatCurrency(guide.max)}</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>時間単価の推移（{report.trend.length}か月）</CardTitle></CardHeader>
              <CardContent>
                {trendMonthsWithData < 2 ? (
                  <p className="text-gray-500 text-center py-8 text-sm">2か月分以上の実績が入力されると表示されます</p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={trendData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                        <CartesianGrid vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6b7280" }} />
                        <YAxis domain={[0, trendTicks[trendTicks.length - 1]]} ticks={trendTicks} tickFormatter={(v) => formatCurrency(Number(v))} tick={{ fontSize: 11, fill: "#6b7280" }} width={64} />
                        <Tooltip
                          labelFormatter={(_, payload) => {
                            const ym = payload?.[0]?.payload?.yearMonth;
                            return typeof ym === "string" ? longMonth(ym) : "";
                          }}
                          formatter={(v, name) => [v == null ? dash : formatCurrency(Number(v)), name]}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} itemSorter={legendOrder} />
                        <Line type="monotone" dataKey="overall" name={`${label}全体`} stroke="#4b5563" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls />
                        {trendPeople.map((p) => (
                          <Line key={p.id} type="monotone" dataKey={p.id} name={p.name} stroke={colorOf(p.id) ?? "#9ca3af"}
                            strokeWidth={2}
                            // 点は線と同じ色で塗り、白い縁で線と区別する（白で塗ると線が途切れて見える）
                            dot={{ r: 4, fill: colorOf(p.id) ?? "#9ca3af", stroke: "#fff", strokeWidth: 2 }}
                            activeDot={{ r: 5, fill: colorOf(p.id) ?? "#9ca3af", stroke: "#fff", strokeWidth: 2 }}
                            connectNulls />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                    {roster.length > MAX_SERIES && (
                      <p className="text-xs text-gray-500 mt-2">線は名簿の上から{MAX_SERIES}名まで表示しています。それ以外の方は表でご確認ください。</p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* 医院全体の売上との突き合わせ。入力漏れや二重計上に気づけるようにする */}
      <Card>
        <CardHeader><CardTitle>医院全体の売上との突き合わせ</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="border rounded-md px-3 py-2">
              <div className="text-xs text-gray-500">担当者の売上合計</div>
              <div className="font-bold text-gray-900">{formatCurrency(report.summaries.DENTIST.totalRevenue + report.summaries.HYGIENIST.totalRevenue)}</div>
              <div className="text-xs text-gray-500">歯科医師 {formatCurrency(report.summaries.DENTIST.totalRevenue)} ＋ 衛生士 {formatCurrency(report.summaries.HYGIENIST.totalRevenue)}</div>
            </div>
            <div className="border rounded-md px-3 py-2">
              <div className="text-xs text-gray-500">医院の月商</div>
              <div className="font-bold text-gray-900">{report.clinicRevenue > 0 ? formatCurrency(report.clinicRevenue) : dash}</div>
            </div>
            <div className="border rounded-md px-3 py-2">
              <div className="text-xs text-gray-500">一致の度合い（担当者合計 ÷ 月商）</div>
              <div className={`font-bold ${report.coverage.status === "ok" ? "text-gray-900" : "text-amber-700"}`}>
                {report.coverage.status !== "ok" && report.coverage.ratio != null && "⚠️ "}{pct(report.coverage.ratio)}
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-600 mt-3 leading-relaxed">{coverageText}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function PersonRows({ p, color, showLabor }: { p: PractitionerMetrics; color: string | null; showLabor: boolean }) {
  const badge = VERDICT_BADGE[p.verdict];
  const laborLow = p.laborMultiple != null && p.laborMultiple < LABOR_MULTIPLE_LOW;
  const hasComments = p.comments.length > 0;
  return (
    <>
      <tr className={hasComments ? "" : "border-b"}>
        <td className="px-3 py-2 whitespace-nowrap">
          <span className="flex items-center gap-2">
            {/* 推移グラフの線と同じ色の印で、表とグラフの人を対応付ける */}
            <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color ?? "#d1d5db" }} aria-hidden />
            <span className="font-medium text-gray-900">{p.name}</span>
            {p.isDirector && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">院長</span>}
            {p.employmentType === "PARTTIME" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-50 text-gray-600 border border-gray-200">{EMPLOYMENT_LABELS.PARTTIME}</span>}
          </span>
        </td>
        <td className="px-3 py-2 text-right font-semibold text-gray-900 whitespace-nowrap">{money(p.hourlyRevenue)}</td>
        <td className="px-3 py-2 text-center whitespace-nowrap">
          <span className={`text-xs px-2 py-0.5 rounded-full border ${badge.className}`}>{badge.label}</span>
          {p.vsOthers != null && <div className="text-[11px] text-gray-500 mt-0.5">他の平均の{p.vsOthers.toFixed(2)}倍</div>}
        </td>
        <td className="px-3 py-2 text-right whitespace-nowrap">{p.totalRevenue > 0 ? formatCurrency(p.totalRevenue) : dash}</td>
        <td className="px-3 py-2 text-right whitespace-nowrap">{pct(p.selfPayRatio)}</td>
        <td className="px-3 py-2 text-right whitespace-nowrap">{p.workHours > 0 ? `${formatNumber(p.workHours)}時間` : dash}</td>
        <td className="px-3 py-2 text-right whitespace-nowrap">{p.patientCount > 0 ? `${formatNumber(p.patientCount)}人` : dash}</td>
        <td className="px-3 py-2 text-right whitespace-nowrap">{money(p.revenuePerPatient)}</td>
        <td className="px-3 py-2 text-right whitespace-nowrap">{p.patientsPerHour == null ? dash : `${p.patientsPerHour.toFixed(1)}人`}</td>
        {showLabor && (
          <td className={`px-3 py-2 text-right whitespace-nowrap ${laborLow ? "text-amber-700 font-medium" : ""}`}>
            {p.isDirector ? <span className="text-xs text-gray-400">対象外</span> : p.laborMultiple == null ? dash : `${laborLow ? "⚠️ " : ""}${p.laborMultiple.toFixed(1)}倍`}
          </td>
        )}
      </tr>
      {hasComments && (
        <tr className="border-b">
          <td colSpan={showLabor ? 10 : 9} className="px-3 pb-2 pt-0">
            <ul className="text-xs text-gray-600 space-y-0.5 pl-5">
              {p.comments.map((c) => <li key={c}>💬 {c}</li>)}
            </ul>
          </td>
        </tr>
      )}
    </>
  );
}
