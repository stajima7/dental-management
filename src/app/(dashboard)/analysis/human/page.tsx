"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { getKpiStatus } from "@/lib/kpi-calculator";
import { PeriodSelector } from "@/components/ui/period-selector";
import { Period, DEFAULT_PERIOD } from "@/lib/period";
import { useTrend } from "@/lib/use-trend";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

interface ClinicInfo { id: string; clinicName: string; }
interface KpiData { kpiCode: string; kpiValue: number; }

const statusMap = (s: string) => s === "good" ? "positive" as const : s === "warning" ? "warning" as const : s === "danger" ? "critical" as const : "neutral" as const;

export default function HumanAnalysisPage() {
  const [clinics, setClinics] = useState<ClinicInfo[]>([]);
  const [selectedClinicId, setSelectedClinicId] = useState("");
  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date(); now.setMonth(now.getMonth() - 1);
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [kpis, setKpis] = useState<KpiData[]>([]);
  const [profile, setProfile] = useState<Record<string, number>>({});
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

  const staffData = [
    { name: "歯科医師(常勤)", value: profile.fulltimeDentistCount || 0 },
    { name: "歯科医師(非常勤)", value: profile.parttimeDentistCount || 0 },
    { name: "歯科衛生士(常勤)", value: profile.fulltimeHygienistCount || 0 },
    { name: "歯科衛生士(非常勤)", value: profile.parttimeHygienistCount || 0 },
    { name: "助手(常勤)", value: profile.fulltimeAssistantCount || 0 },
    { name: "助手(非常勤)", value: profile.parttimeAssistantCount || 0 },
    { name: "受付(常勤)", value: profile.fulltimeReceptionCount || 0 },
    { name: "受付(非常勤)", value: profile.parttimeReceptionCount || 0 },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">人員分析</h1>
        <div className="flex items-center gap-3">
          <input type="month" className="border border-gray-300 rounded-md px-3 py-1.5 text-sm" value={yearMonth} onChange={e => setYearMonth(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="歯科医師FTE" value={formatNumber(getKpi("dentistFte"))} status={statusMap(getKpiStatus("dentistFte", getKpi("dentistFte")))} />
        <KpiCard label="衛生士FTE" value={formatNumber(getKpi("hygienistFte"))} status={statusMap(getKpiStatus("hygienistFte", getKpi("hygienistFte")))} />
        <KpiCard label="Dr1人当たり売上" value={formatCurrency(getKpi("revenuePerDentist"))} status="neutral" />
        <KpiCard label="DH1人当たり売上" value={formatCurrency(getKpi("revenuePerHygienist"))} status="neutral" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>スタッフ構成</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={staffData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={120} />
                <Tooltip />
                <Bar dataKey="value" fill="#3B82F6" name="人数" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>生産性指標</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between py-2 border-b">
                <span className="text-sm text-gray-600">人件費率</span>
                <span className="font-medium">{getKpi("laborCostRatio").toFixed(1)}%</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-sm text-gray-600">1日平均来院数</span>
                <span className="font-medium">{getKpi("patientsPerDay").toFixed(1)}人</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-sm text-gray-600">患者単価</span>
                <span className="font-medium">{formatCurrency(getKpi("revenuePerPatient"))}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-sm text-gray-600">ユニット当たり売上</span>
                <span className="font-medium">{formatCurrency(getKpi("revenuePerUnit"))}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>生産性の推移</CardTitle>
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
                <YAxis yAxisId="right" orientation="right" unit="%" />
                <Tooltip formatter={(v, name) => name === "人件費率" ? `${Number(v).toFixed(1)}%` : formatCurrency(Number(v))} />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="revenuePerDentist" name="Dr1人当たり売上" stroke="#3B82F6" strokeWidth={2} />
                <Line yAxisId="left" type="monotone" dataKey="revenuePerHygienist" name="DH1人当たり売上" stroke="#10B981" strokeWidth={2} />
                <Line yAxisId="right" type="monotone" dataKey="laborCostRatio" name="人件費率" stroke="#EF4444" strokeWidth={2} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-500 text-center py-8">データがありません</p>}
        </CardContent>
      </Card>
    </div>
  );
}
