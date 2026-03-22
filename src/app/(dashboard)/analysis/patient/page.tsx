"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { formatNumber, formatPercent } from "@/lib/utils";
import { getKpiStatus } from "@/lib/kpi-calculator";

interface KpiData { kpiCode: string; kpiValue: number; }
const statusMap = (s: string) => s === "good" ? "positive" as const : s === "warning" ? "warning" as const : s === "danger" ? "critical" as const : "neutral" as const;

export default function PatientAnalysisPage() {
  const [selectedClinicId, setSelectedClinicId] = useState("");
  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date(); now.setMonth(now.getMonth() - 1);
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [kpis, setKpis] = useState<KpiData[]>([]);

  useEffect(() => {
    fetch("/api/clinics").then(r => r.json()).then(d => {
      if (Array.isArray(d) && d.length > 0) setSelectedClinicId(d[0].id);
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
    </div>
  );
}
