"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { formatNumber, formatPercent, formatCurrency } from "@/lib/utils";
import { getKpiStatus } from "@/lib/kpi-calculator";
import { PeriodSelector } from "@/components/ui/period-selector";
import { Period, DEFAULT_PERIOD } from "@/lib/period";
import { useTrend } from "@/lib/use-trend";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";

interface KpiData { kpiCode: string; kpiValue: number; }
const statusMap = (s: string) => s === "good" ? "positive" as const : s === "warning" ? "warning" as const : s === "danger" ? "critical" as const : "neutral" as const;

export default function PatientAnalysisPage() {
  const [selectedClinicId, setSelectedClinicId] = useState("");
  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date(); now.setMonth(now.getMonth() - 1);
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [kpis, setKpis] = useState<KpiData[]>([]);
  const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD);
  const { rows: trendData } = useTrend(selectedClinicId, period, yearMonth);

  useEffect(() => {
    fetch("/api/clinics").then(r => r.json()).then(d => {
      if (Array.isArray(d) && d.length > 0) {
        setSelectedClinicId(d[0].id);
        if (d[0].latestYearMonth) setYearMonth(d[0].latestYearMonth);
      }
    });
  }, []);

  const loadData = useCallback(async () => {
    if (!selectedClinicId || !yearMonth) return;
    const res = await fetch(`/api/kpi?clinicId=${selectedClinicId}&yearMonth=${yearMonth}`);
    if (res.ok) { const d = await res.json(); setKpis(Array.isArray(d) ? d : []); }
  }, [selectedClinicId, yearMonth]);

  useEffect(() => { loadData(); }, [loadData]);
  const getKpi = (code: string) => kpis.find(k => k.kpiCode === code)?.kpiValue || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">患者分析</h1>
        <input type="month" className="border border-gray-300 rounded-md px-3 py-1.5 text-sm" value={yearMonth} onChange={e => setYearMonth(e.target.value)} />
      </div>

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
            </div>
          ) : <p className="text-gray-500 text-center py-8">データがありません</p>}
        </CardContent>
      </Card>
    </div>
  );
}
