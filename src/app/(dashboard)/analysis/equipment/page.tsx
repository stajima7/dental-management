"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import { getKpiStatus, CHAIR_UTILIZATION_CEILING } from "@/lib/kpi-calculator";
import { PeriodSelector } from "@/components/ui/period-selector";
import { Period, DEFAULT_PERIOD } from "@/lib/period";
import { useTrend } from "@/lib/use-trend";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

interface ClinicInfo { id: string; clinicName: string; }
interface KpiData { kpiCode: string; kpiValue: number; }

const statusMap = (s: string) => s === "good" ? "positive" as const : s === "warning" ? "warning" as const : s === "danger" ? "critical" as const : "neutral" as const;

export default function EquipmentAnalysisPage() {
  const [clinics, setClinics] = useState<ClinicInfo[]>([]);
  const [selectedClinicId, setSelectedClinicId] = useState("");
  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date(); now.setMonth(now.getMonth() - 1);
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [kpis, setKpis] = useState<KpiData[]>([]);
  const [profile, setProfile] = useState<Record<string, unknown>>({});
  const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD);
  const { rows: trendData } = useTrend(selectedClinicId, period, yearMonth);

  useEffect(() => {
    fetch("/api/clinics").then(r => r.json()).then(d => {
      if (Array.isArray(d) && d.length > 0) {
        setClinics(d);
        setSelectedClinicId(d[0].id);
        if (d[0].latestYearMonth) setYearMonth(d[0].latestYearMonth);
      }
    });
  }, []);

  const loadData = useCallback(async () => {
    if (!selectedClinicId || !yearMonth) return;
    const [kpiRes, clinicRes] = await Promise.all([
      fetch(`/api/kpi?clinicId=${selectedClinicId}&yearMonth=${yearMonth}`),
      fetch(`/api/clinics/${selectedClinicId}`),
    ]);
    if (kpiRes.ok) { const d = await kpiRes.json(); setKpis(Array.isArray(d) ? d : []); }
    if (clinicRes.ok) { const d = await clinicRes.json(); if (d.profile) setProfile(d.profile); }
  }, [selectedClinicId, yearMonth]);

  useEffect(() => { loadData(); }, [loadData]);

  const getKpi = (code: string) => kpis.find(k => k.kpiCode === code)?.kpiValue || 0;

  const unitCount = (profile.unitCount as number) || 0;
  const activeUnitCount = (profile.activeUnitCount as number) || 0;
  const chairUtilization = getKpi("chairUtilization");

  const equipment = [
    { name: "CT", has: profile.hasCt },
    { name: "マイクロスコープ", has: profile.hasMicroscope },
    { name: "CAD/CAM", has: profile.hasCadcam },
    { name: "オペ室", has: profile.hasOperationRoom },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">設備分析</h1>
        <input
          type="month"
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
          value={yearMonth}
          onChange={e => e.target.value && setYearMonth(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="チェア稼働率"
          value={formatPercent(chairUtilization)}
          status={statusMap(getKpiStatus("chairUtilization", chairUtilization))}
        />
        <KpiCard label="チェア分単価" value={formatCurrency(getKpi("revenuePerChairMinute"))} status="neutral" />
        <KpiCard
          label="空き枠損失額"
          value={formatCurrency(getKpi("idleChairLoss"))}
          status={getKpi("idleChairLoss") > 0 ? "warning" : "positive"}
        />
        <KpiCard label="ユニット当たり売上" value={formatCurrency(getKpi("revenuePerUnit"))} status={statusMap(getKpiStatus("revenuePerUnit", getKpi("revenuePerUnit")))} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>設備一覧</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {equipment.map(eq => (
                <div key={eq.name} className="flex items-center justify-between py-2 border-b">
                  <span className="text-sm font-medium">{eq.name}</span>
                  <span className={`inline-block px-2 py-1 rounded text-xs ${eq.has ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {eq.has ? "あり" : "なし"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>チェア稼働の内訳</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b">
                <span className="text-sm text-gray-600">チェア数（稼働／保有）</span>
                <span className="font-medium">{activeUnitCount}台 / {unitCount}台</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-sm text-gray-600">月間診療日数 × 1日診療時間</span>
                <span className="font-medium">{(profile.clinicDaysPerMonth as number) || 22}日 × {(profile.avgHoursPerDay as number) || 8}時間</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-sm text-gray-600">1患者あたり平均チェア占有時間</span>
                <span className="font-medium">{(profile.avgTreatmentMinutes as number) || 45}分</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-sm text-gray-600">稼働可能時間</span>
                <span className="font-medium">{formatNumber(getKpi("chairMinutesAvailable"))}分</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-sm text-gray-600">うち診療で埋まった時間</span>
                <span className="font-medium">{formatNumber(getKpi("chairMinutesUsed"))}分</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-sm text-gray-600">1日平均来院数</span>
                <span className="font-medium">{formatNumber(getKpi("patientsPerDay"))}人</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-sm text-gray-600">患者単価</span>
                <span className="font-medium">{formatCurrency(getKpi("revenuePerPatient"))}</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-4 leading-relaxed">
              空き枠損失額は、チェア稼働率を上限{CHAIR_UTILIZATION_CEILING}%まで埋めた場合に得られたはずの売上です。
              準備・片付け・急患枠を考慮すると100%は達成できないため、上限を{CHAIR_UTILIZATION_CEILING}%としています。
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>ユニット生産性の推移</CardTitle>
            <PeriodSelector value={period} onChange={setPeriod} baseMonth={yearMonth} />
          </div>
        </CardHeader>
        <CardContent>
          {trendData.length > 0 ? (
            <div className="space-y-6">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis yAxisId="left" tickFormatter={(v) => `${(v / 10000).toFixed(0)}万`} />
                  <YAxis yAxisId="right" orientation="right" unit="%" domain={[0, 100]} />
                  <Tooltip formatter={(v, name) => name === "チェア稼働率" ? `${Number(v).toFixed(1)}%` : formatCurrency(Number(v))} />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="revenuePerUnit" name="ユニット1台当たり売上" stroke="#3B82F6" strokeWidth={2} />
                  <Line yAxisId="right" type="monotone" dataKey="chairUtilization" name="チェア稼働率" stroke="#F59E0B" strokeWidth={2} strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
              <div>
                {/* 患者単価・分単価はユニット売上と桁が2〜4桁違うため、万円軸に載せず別グラフにする */}
                <p className="text-sm font-medium text-gray-700 mb-2">患者単価・チェア分単価の推移</p>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis yAxisId="left" tickFormatter={(v) => `${(v / 10000).toFixed(1)}万`} />
                    <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${Math.round(v)}円`} />
                    <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="revenuePerPatient" name="患者単価" stroke="#10B981" strokeWidth={2} />
                    <Line yAxisId="right" type="monotone" dataKey="revenuePerChairMinute" name="チェア分単価" stroke="#8B5CF6" strokeWidth={2} />
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
