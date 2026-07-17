"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { PeriodSelector } from "@/components/ui/period-selector";
import { Period, DEFAULT_PERIOD } from "@/lib/period";
import { useTrend } from "@/lib/use-trend";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

interface ClinicInfo { id: string; clinicName: string; }
interface KpiData { kpiCode: string; kpiValue: number; }

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
  const unitUtilization = unitCount > 0 ? (activeUnitCount / unitCount) * 100 : 0;

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
        <KpiCard label="ユニット数" value={`${unitCount}台`} status="neutral" />
        <KpiCard label="稼働ユニット数" value={`${activeUnitCount}台`} status="neutral" />
        <KpiCard label="ユニット稼働率" value={`${unitUtilization.toFixed(0)}%`} status={unitUtilization >= 80 ? "positive" : "warning"} />
        <KpiCard label="ユニット当たり売上" value={formatCurrency(getKpi("revenuePerUnit"))} status={getKpi("revenuePerUnit") >= 1500000 ? "positive" : "warning"} />
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
          <CardHeader><CardTitle>稼働効率</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b">
                <span className="text-sm text-gray-600">月間診療日数</span>
                <span className="font-medium">{(profile.clinicDaysPerMonth as number) || 22}日</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-sm text-gray-600">1日平均診療時間</span>
                <span className="font-medium">{(profile.avgHoursPerDay as number) || 8}時間</span>
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
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis yAxisId="left" tickFormatter={(v) => `${(v / 10000).toFixed(0)}万`} />
                <YAxis yAxisId="right" orientation="right" unit="人" />
                <Tooltip formatter={(v, name) => name === "1日平均来院数" ? `${Number(v).toFixed(1)}人` : formatCurrency(Number(v))} />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="revenuePerUnit" name="ユニット1台当たり売上" stroke="#3B82F6" strokeWidth={2} />
                <Line yAxisId="left" type="monotone" dataKey="revenuePerPatient" name="患者単価" stroke="#10B981" strokeWidth={2} />
                <Line yAxisId="right" type="monotone" dataKey="patientsPerDay" name="1日平均来院数" stroke="#F59E0B" strokeWidth={2} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-500 text-center py-8">データがありません</p>}
        </CardContent>
      </Card>
    </div>
  );
}
