"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { formatNumber, formatPercent, formatCurrency } from "@/lib/utils";
import { getKpiStatus } from "@/lib/kpi-calculator";
import { PeriodSelector } from "@/components/ui/period-selector";
import { AnalysisModeSelector } from "@/components/ui/analysis-mode-selector";
import { ModeGate } from "@/components/ui/mode-gate";
import { AnalysisMode, DEFAULT_ANALYSIS_MODE } from "@/lib/analysis-mode";
import { Period, DEFAULT_PERIOD } from "@/lib/period";
import { useTrend } from "@/lib/use-trend";
import { CANCEL_REASONS, CANCEL_CATEGORY_LABELS } from "@/lib/constants";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";

interface KpiData { kpiCode: string; kpiValue: number; }
interface RecallData { notifiedCount: number; bookedCount: number; visitedCount: number; rebookedCount: number; }
interface CancelDetail { category: string; reasonCode: string; count: number; recoveredCount: number; }
interface DiscontinuedData { noNextAppointment: number; afterCancel: number; afterNoShow: number; maintenanceOverdue: number; }
interface PatientDetail {
  recall: RecallData | null;
  cancelDetails: CancelDetail[];
  discontinued: DiscontinuedData | null;
  discontinuedJudgeMonths: number;
}

const statusMap = (s: string) => s === "good" ? "positive" as const : s === "warning" ? "warning" as const : s === "danger" ? "critical" as const : "neutral" as const;

/** 理由コードを表示名に。マスタに無いコード（独自入力）はそのまま出す */
const reasonName = (code: string) =>
  (CANCEL_REASONS as Record<string, { name: string } | undefined>)[code]?.name ?? code;

/** リコールの歩留まりを段階ごとの帯で表す。各段階の間に「何%が次に進んだか」を挟む */
function RecallFunnel({ r }: { r: RecallData }) {
  const steps = [
    { label: "リコール通知", count: r.notifiedCount, color: "bg-slate-400", desc: "呼び戻しの案内を送った人数" },
    { label: "予約に至った", count: r.bookedCount, color: "bg-blue-500", desc: "案内を受けて予約を入れた人数" },
    { label: "実際に来院した", count: r.visitedCount, color: "bg-emerald-500", desc: "予約どおり来院した人数" },
    { label: "次回予約まで進んだ", count: r.rebookedCount, color: "bg-emerald-600", desc: "来院時に次の予約を入れた人数" },
  ];
  const max = steps[0].count || 1;

  return (
    <div className="space-y-1">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].count : null;
        const rate = prev && prev > 0 ? (s.count / prev) * 100 : null;
        const lost = prev != null ? prev - s.count : 0;
        return (
          <div key={s.label}>
            {rate != null && (
              <div className="flex items-center gap-2 pl-2 py-1">
                <span className="text-gray-300 text-xs">↓</span>
                <span className={`text-xs font-semibold ${rate >= 85 ? "text-emerald-600" : rate >= 70 ? "text-amber-600" : "text-red-600"}`}>
                  {rate.toFixed(0)}% が次へ
                </span>
                {lost > 0 && <span className="text-xs text-gray-400">（{formatNumber(lost)}人が離脱）</span>}
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="w-40 shrink-0">
                <div className="text-sm font-medium text-gray-800">{s.label}</div>
                <div className="text-xs text-gray-400">{s.desc}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="h-8 bg-gray-100 rounded overflow-hidden">
                  <div
                    className={`h-full ${s.color} rounded flex items-center justify-end pr-2 transition-all`}
                    style={{ width: `${Math.max((s.count / max) * 100, 8)}%` }}
                  >
                    <span className="text-xs font-bold text-white">{formatNumber(s.count)}人</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function PatientAnalysisPage() {
  const [selectedClinicId, setSelectedClinicId] = useState("");
  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date(); now.setMonth(now.getMonth() - 1);
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [kpis, setKpis] = useState<KpiData[]>([]);
  const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD);
  const { rows: trendData } = useTrend(selectedClinicId, period, yearMonth);
  const [mode, setMode] = useState<AnalysisMode>(DEFAULT_ANALYSIS_MODE);

  useEffect(() => {
    fetch("/api/clinics").then(r => r.json()).then(d => {
      if (Array.isArray(d) && d.length > 0) {
        setSelectedClinicId(d[0].id);
        if (d[0].latestYearMonth) setYearMonth(d[0].latestYearMonth);
        if (d[0].analysisMode) setMode(d[0].analysisMode);
      }
    });
  }, []);

  const [detail, setDetail] = useState<PatientDetail | null>(null);

  const loadData = useCallback(async () => {
    if (!selectedClinicId || !yearMonth) return;
    const [kpiRes, detailRes] = await Promise.all([
      fetch(`/api/kpi?clinicId=${selectedClinicId}&yearMonth=${yearMonth}`),
      fetch(`/api/patient-detail?clinicId=${selectedClinicId}&yearMonth=${yearMonth}`),
    ]);
    if (kpiRes.ok) { const d = await kpiRes.json(); setKpis(Array.isArray(d) ? d : []); }
    if (detailRes.ok) setDetail(await detailRes.json());
  }, [selectedClinicId, yearMonth]);

  useEffect(() => { loadData(); }, [loadData]);
  const getKpi = (code: string) => kpis.find(k => k.kpiCode === code)?.kpiValue || 0;

  // 中断患者の状態別内訳。状態ごとに取るべき行動が違うため、行動もあわせて示す
  const d = detail?.discontinued;
  const discontinuedTotal = d ? d.noNextAppointment + d.afterCancel + d.afterNoShow + d.maintenanceOverdue : 0;
  const discontinuedBreakdown = d ? [
    { label: "次回予約が入っていない", count: d.noNextAppointment, color: "bg-red-500", action: "治療途中の可能性。早めの連絡が最優先" },
    { label: "キャンセル後そのまま", count: d.afterCancel, color: "bg-orange-400", action: "取り直しの連絡が漏れている" },
    { label: "無断キャンセル後そのまま", count: d.afterNoShow, color: "bg-amber-400", action: "連絡手段が届いているか確認" },
    { label: "メンテ予定日を過ぎている", count: d.maintenanceOverdue, color: "bg-sky-400", action: "リコール通知の対象" },
  ].filter(x => x.count > 0) : [];

  // キャンセル内訳の合計（患者都合／医院都合／取り直し）
  const cancelTotals = (() => {
    const rows = detail?.cancelDetails ?? [];
    const total = rows.reduce((s, c) => s + c.count, 0);
    const clinic = rows.filter(c => c.category === "CLINIC").reduce((s, c) => s + c.count, 0);
    const recovered = rows.reduce((s, c) => s + c.recoveredCount, 0);
    return {
      total, clinic, recovered,
      patient: total - clinic,
      patientPct: total > 0 ? ((total - clinic) / total) * 100 : 0,
    };
  })();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">患者分析</h1>
        <div className="flex flex-wrap items-center gap-2">
          <AnalysisModeSelector clinicId={selectedClinicId} mode={mode} onChange={setMode} />
          <input type="month" className="border border-gray-300 rounded-md px-3 py-1.5 text-sm" value={yearMonth} onChange={e => setYearMonth(e.target.value)} />
        </div>
      </div>

      <ModeGate requires={["clinical"]} mode={mode} showPlaceholder title="患者分析">

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="延患者数" value={formatNumber(getKpi("totalPatientCount"))} sub="人/月" status="neutral" />
        <KpiCard label="新患数" value={formatNumber(getKpi("newPatientCount"))} sub="人/月" status={statusMap(getKpiStatus("newPatientCount", getKpi("newPatientCount")))} />
        <KpiCard label="再来率" value={formatPercent(getKpi("returnRate"))} status={statusMap(getKpiStatus("returnRate", getKpi("returnRate")))} />
        <KpiCard label="キャンセル率" value={formatPercent(getKpi("cancelRate"))} status={statusMap(getKpiStatus("cancelRate", getKpi("cancelRate")))} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>患者数詳細</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                ["延患者数", getKpi("totalPatientCount"), "人"],
                ["実患者数", getKpi("uniquePatientCount"), "人"],
                ["新患数", getKpi("newPatientCount"), "人"],
                ["再来患者数", getKpi("returnPatientCount"), "人"],
                ["1日平均来院数", getKpi("patientsPerDay"), "人"],
              ].map(([label, value, unit]) => (
                <div key={label as string} className="flex justify-between py-2 border-b">
                  <span className="text-sm text-gray-600">{label}</span>
                  <span className="font-medium">{typeof value === "number" ? formatNumber(value) : value}{unit}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>予約・メンテナンス</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                ["予約件数", getKpi("appointmentCount"), "件"],
                ["キャンセル数", getKpi("cancelCount"), "件"],
                ["キャンセル率", getKpi("cancelRate"), "%"],
                ["うち無断キャンセル数", getKpi("noShowCount"), "件"],
                ["無断キャンセル率", getKpi("noShowRate"), "%"],
                ["メンテ移行率", getKpi("maintenanceTransitionRate"), "%"],
              ].map(([label, value, unit]) => (
                <div key={label as string} className="flex justify-between py-2 border-b">
                  <span className="text-sm text-gray-600">{label}</span>
                  <span className="font-medium">
                    {unit === "%" ? formatPercent(value as number) : formatNumber(value as number)}{unit === "件" ? "件" : ""}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ① リコール（呼び戻し）の歩留まり */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>リコール分析（呼び戻しの歩留まり）</CardTitle>
            {detail?.recall && (
              <span className="text-xs text-gray-500">
                通知した人が、最後に次回予約まで進んだ割合：
                <span className="font-bold text-gray-800 ml-1">
                  {detail.recall.notifiedCount > 0
                    ? ((detail.recall.rebookedCount / detail.recall.notifiedCount) * 100).toFixed(0)
                    : 0}%
                </span>
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {detail?.recall && detail.recall.notifiedCount > 0 ? (
            <>
              <RecallFunnel r={detail.recall} />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
                <KpiCard label="予約率（通知→予約）" value={formatPercent(getKpi("recallBookingRate"))}
                  status={statusMap(getKpiStatus("recallBookingRate", getKpi("recallBookingRate")))} sub="目標80%" />
                <KpiCard label="来院率（予約→来院）" value={formatPercent(getKpi("recallVisitRate"))}
                  status={statusMap(getKpiStatus("recallVisitRate", getKpi("recallVisitRate")))} sub="目標90%" />
                <KpiCard label="継続率（来院→次回予約）" value={formatPercent(getKpi("recallContinuationRate"))}
                  status={statusMap(getKpiStatus("recallContinuationRate", getKpi("recallContinuationRate")))} sub="目標75%" />
              </div>
              <p className="text-xs text-gray-500 mt-4 leading-relaxed">
                最も落ち込んでいる段階が、いま手を打つべきところです。
                予約率が低ければ通知の方法や文面、来院率が低ければ前日リマインド、
                継続率が低ければ来院時にその場で次回予約を取る運用が効きます。
              </p>
            </>
          ) : (
            <p className="text-gray-500 text-sm py-8 text-center">
              リコールのデータが未登録です。「データ取込」で通知者数・予約者数・来院者数・再予約者数を登録すると、どの段階で患者が抜けているかが分かります。
            </p>
          )}
        </CardContent>
      </Card>

      {/* ② キャンセルの理由別内訳とリカバリー（取り直し） */}
      <Card>
        <CardHeader><CardTitle>キャンセル分析（理由別・取り直し）</CardTitle></CardHeader>
        <CardContent>
          {detail && detail.cancelDetails.length > 0 ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                <KpiCard label="キャンセル数" value={`${formatNumber(cancelTotals.total)}件`} status="neutral" />
                <KpiCard label="うち医院都合" value={`${formatNumber(cancelTotals.clinic)}件`}
                  sub={`${formatPercent(getKpi("clinicSideCancelRate"))}`}
                  status={statusMap(getKpiStatus("clinicSideCancelRate", getKpi("clinicSideCancelRate")))} />
                <KpiCard label="取り直せた件数" value={`${formatNumber(cancelTotals.recovered)}件`} status="neutral" />
                <KpiCard label="リカバリー率" value={formatPercent(getKpi("cancelRecoveryRate"))}
                  sub="目標50%"
                  status={statusMap(getKpiStatus("cancelRecoveryRate", getKpi("cancelRecoveryRate")))} />
              </div>

              {/* 患者都合／医院都合の比率 */}
              <div className="mb-5">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-blue-700">患者都合 {formatNumber(cancelTotals.patient)}件</span>
                  <span className="font-medium text-amber-700">医院都合 {formatNumber(cancelTotals.clinic)}件</span>
                </div>
                <div className="flex h-6 rounded overflow-hidden bg-gray-100">
                  <div className="bg-blue-500 flex items-center justify-center" style={{ width: `${cancelTotals.patientPct}%` }}>
                    <span className="text-xs font-bold text-white">{cancelTotals.patientPct.toFixed(0)}%</span>
                  </div>
                  <div className="bg-amber-500 flex items-center justify-center" style={{ width: `${100 - cancelTotals.patientPct}%` }}>
                    <span className="text-xs font-bold text-white">{(100 - cancelTotals.patientPct).toFixed(0)}%</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1.5">
                  医院都合は自院の段取りで減らせるキャンセルです。ここが大きいときは技工物の納期管理やシフトの組み方を見直します。
                </p>
              </div>

              {/* 理由別の一覧 */}
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="px-3 py-2 text-left font-medium">区分</th>
                      <th className="px-3 py-2 text-left font-medium">キャンセル理由</th>
                      <th className="px-3 py-2 text-right font-medium">件数</th>
                      <th className="px-3 py-2 text-right font-medium">全体に占める割合</th>
                      <th className="px-3 py-2 text-right font-medium">取り直せた</th>
                      <th className="px-3 py-2 text-right font-medium">リカバリー率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.cancelDetails.map((c) => {
                      const rec = c.count > 0 ? (c.recoveredCount / c.count) * 100 : 0;
                      return (
                        <tr key={`${c.category}-${c.reasonCode}`} className="border-b">
                          <td className="px-3 py-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              c.category === "CLINIC" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"
                            }`}>
                              {CANCEL_CATEGORY_LABELS[c.category] || c.category}
                            </span>
                          </td>
                          <td className="px-3 py-2">{reasonName(c.reasonCode)}</td>
                          <td className="px-3 py-2 text-right font-medium">{formatNumber(c.count)}件</td>
                          <td className="px-3 py-2 text-right text-gray-500">
                            {cancelTotals.total > 0 ? ((c.count / cancelTotals.total) * 100).toFixed(0) : 0}%
                          </td>
                          <td className="px-3 py-2 text-right">{formatNumber(c.recoveredCount)}件</td>
                          <td className={`px-3 py-2 text-right font-medium ${
                            rec >= 60 ? "text-emerald-600" : rec >= 35 ? "text-amber-600" : "text-red-600"
                          }`}>{rec.toFixed(0)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-500 mt-3 leading-relaxed">
                リカバリー率が低い理由ほど、そのまま失注につながっています。
                「忘れていた」が多ければ前日リマインド、「理由不明・連絡なし」が多ければ連絡手段の見直しが有効です。
              </p>
            </>
          ) : (
            <p className="text-gray-500 text-sm py-8 text-center">
              キャンセルの理由別データが未登録です。理由と取り直しの結果を登録すると、減らせるキャンセルが特定できます。
            </p>
          )}
        </CardContent>
      </Card>

      {/* ③ 中断患者の実数（次回予約が入っていない人） */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>中断患者の実数</CardTitle>
            {detail && (
              <span className="text-xs text-gray-500">
                判定期間：最終来院から
                <span className="font-bold text-gray-800 mx-1">{detail.discontinuedJudgeMonths}ヶ月</span>
                次回予約なし（医院設定で変更できます）
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {detail?.discontinued && discontinuedTotal > 0 ? (
            <>
              <div className="flex flex-wrap items-end gap-6 mb-5">
                <div>
                  <div className="text-xs text-gray-500 mb-0.5">連絡すべき患者</div>
                  <div className="text-3xl font-bold text-gray-900">
                    {formatNumber(discontinuedTotal)}<span className="text-base font-medium text-gray-500 ml-1">人</span>
                  </div>
                </div>
                <div className="text-sm text-gray-500 pb-1">
                  実患者数の{getKpi("uniquePatientCount") > 0
                    ? ((discontinuedTotal / getKpi("uniquePatientCount")) * 100).toFixed(1)
                    : 0}%にあたります
                </div>
              </div>

              <div className="space-y-2">
                {discontinuedBreakdown.map((d) => (
                  <div key={d.label} className="flex items-center gap-3">
                    <div className="w-52 shrink-0">
                      <div className="text-sm font-medium text-gray-800">{d.label}</div>
                      <div className="text-xs text-gray-400">{d.action}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="h-7 bg-gray-100 rounded overflow-hidden">
                        <div className={`h-full ${d.color} rounded flex items-center justify-end pr-2`}
                          style={{ width: `${Math.max((d.count / discontinuedTotal) * 100, 6)}%` }}>
                          <span className="text-xs font-bold text-white">{formatNumber(d.count)}人</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-gray-500 mt-4 leading-relaxed">
                「中断率」は割合なので誰に連絡すればよいか分かりませんが、実数なら次の行動に移せます。
                治療途中で来なくなった患者は、放置すると再来が難しくなるため、状態別に優先順位をつけて連絡してください。
              </p>
            </>
          ) : (
            <p className="text-gray-500 text-sm py-8 text-center">
              中断患者のデータが未登録です。次回予約が入っていない患者数を状態別に登録すると、連絡すべき人数が把握できます。
            </p>
          )}
        </CardContent>
      </Card>

      {/* CPA・LTVは広告費(財務)も要るため統合モードのみ */}
      <ModeGate requires={["finance", "clinical"]} mode={mode} showPlaceholder title="新患獲得効率">
      <Card>
        <CardHeader><CardTitle>新患獲得効率</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              label="新患獲得単価"
              value={formatCurrency(getKpi("costPerAcquisition"))}
              status={statusMap(getKpiStatus("costPerAcquisition", getKpi("costPerAcquisition")))}
            />
            <KpiCard label="新患1人あたり生涯売上" value={formatCurrency(getKpi("revenuePerNewPatient"))} status="neutral" />
            <KpiCard
              label="LTV/獲得単価比"
              value={`${getKpi("ltvToCpaRatio").toFixed(1)}倍`}
              status={statusMap(getKpiStatus("ltvToCpaRatio", getKpi("ltvToCpaRatio")))}
            />
            <KpiCard label="平均継続月数" value={`${getKpi("avgRetentionMonths").toFixed(1)}ヶ月`} status="neutral" />
            <KpiCard
              label="無断キャンセル損失額"
              value={formatCurrency(getKpi("noShowLoss"))}
              status={statusMap(getKpiStatus("noShowRate", getKpi("noShowRate")))}
            />
          </div>
          <p className="text-xs text-gray-500 mt-4 leading-relaxed">
            新患獲得単価は「広告費 ÷ 新患数」です。紹介・通りがかりの新患も分母に含むため、広告経由のみの獲得単価より低く出ます。<br />
            生涯売上は患者ごとの通院履歴を持たないため、「月商 ÷ 新患数」による推計値です（定常状態では新患1人が生涯にもたらす売上と一致します）。患者数が急増・急減している時期は実態から乖離します。
          </p>
        </CardContent>
      </Card>
      </ModeGate>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>患者動向の推移</CardTitle>
            <PeriodSelector value={period} onChange={setPeriod} baseMonth={yearMonth} />
          </div>
        </CardHeader>
        <CardContent>
          {trendData.length > 0 ? (
            <div className="space-y-6">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip formatter={(v) => `${formatNumber(Number(v))}人`} />
                  <Legend />
                  <Bar dataKey="newPatientCount" name="新患数" fill="#10B981" />
                  <Bar dataKey="uniquePatientCount" name="実患者数" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
              {/* 再来率は約90%と他の指標(3〜32%)から離れており、同一軸だとメンテ移行率・
                  キャンセル率・中断率が下部に密集して読めなくなるため軸を分ける */}
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis yAxisId="left" unit="%" domain={[0, 40]} />
                  <YAxis yAxisId="right" orientation="right" unit="%" domain={[70, 100]} />
                  <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="maintenanceTransitionRate" name="メンテ移行率（左軸）" stroke="#10B981" strokeWidth={2} />
                  <Line yAxisId="left" type="monotone" dataKey="cancelRate" name="キャンセル率（左軸）" stroke="#F59E0B" strokeWidth={2} />
                  <Line yAxisId="left" type="monotone" dataKey="discontinuedRate" name="中断率（左軸）" stroke="#EF4444" strokeWidth={2} />
                  <Line yAxisId="right" type="monotone" dataKey="returnRate" name="再来率（右軸）" stroke="#3B82F6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
              <ModeGate requires={["finance", "clinical"]} mode={mode}>
              <div>
                {/* 生涯売上(約26万円)と獲得単価(約5千円)は桁が2桁違うため、左右で軸を分ける */}
                <p className="text-sm font-medium text-gray-700 mb-2">新患獲得効率の推移</p>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis yAxisId="left" tickFormatter={(v) => `${(v / 10000).toFixed(0)}万`} />
                    <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${(v / 1000).toFixed(0)}千`} />
                    <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="revenuePerNewPatient" name="新患1人あたり生涯売上（左軸）" stroke="#10B981" strokeWidth={2} />
                    <Line yAxisId="right" type="monotone" dataKey="costPerAcquisition" name="新患獲得単価（右軸）" stroke="#EF4444" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              </ModeGate>
            </div>
          ) : <p className="text-gray-500 text-center py-8">データがありません</p>}
        </CardContent>
      </Card>
      </ModeGate>
    </div>
  );
}
