"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { getKpiStatus } from "@/lib/kpi-calculator";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

interface KpiData { kpiCode: string; kpiValue: number; }
const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];
const statusMap = (s: string) => s === "good" ? "positive" as const : s === "warning" ? "warning" as const : s === "danger" ? "critical" as const : "neutral" as const;

export default function FinanceAnalysisPage() {
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

  const revenueData = [
    { name: "保険", value: getKpi("insuranceRevenue") },
    { name: "自費", value: getKpi("selfPayRevenue") },
    { name: "メンテ", value: getKpi("maintenanceRevenue") },
    { name: "訪問", value: getKpi("homeVisitRevenue") },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">財務分析</h1>
        <input type="month" className="border border-gray-300 rounded-md px-3 py-1.5 text-sm" value={yearMonth} onChange={e => setYearMonth(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="総売上" value={formatCurrency(getKpi("totalRevenue"))} status="neutral" />
        <KpiCard label="粗利益率" value={formatPercent(getKpi("grossProfitRate"))} status={statusMap(getKpiStatus("grossProfitRate", getKpi("grossProfitRate")))} />
        <KpiCard label="営業利益率" value={formatPercent(getKpi("operatingProfitRate"))} status={statusMap(getKpiStatus("operatingProfitRate", getKpi("operatingProfitRate")))} />
        <KpiCard label="人件費率" value={formatPercent(getKpi("laborCostRatio"))} status={statusMap(getKpiStatus("laborCostRatio", getKpi("laborCostRatio")))} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>売上構成</CardTitle></CardHeader>
          <CardContent>
            {revenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={revenueData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(1)}%`}>
                    {revenueData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-gray-500 text-center py-8">データがありません</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>損益サマリー</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                ["総売上", "totalRevenue"], ["直接費合計", "totalCosts"], ["粗利益", "grossProfit"],
                ["人件費", "laborCost"], ["営業利益", "operatingProfit"],
              ].map(([label, code]) => (
                <div key={code} className="flex justify-between py-2 border-b">
                  <span className="text-sm text-gray-600">{label}</span>
                  <span className={`font-medium ${code === "operatingProfit" && getKpi(code) < 0 ? "text-red-600" : ""}`}>
                    {formatCurrency(getKpi(code))}
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
