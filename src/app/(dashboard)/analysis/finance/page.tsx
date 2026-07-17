"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/utils";
import { getKpiStatus } from "@/lib/kpi-calculator";
import { PeriodSelector } from "@/components/ui/period-selector";
import { Period, DEFAULT_PERIOD } from "@/lib/period";
import { useTrend } from "@/lib/use-trend";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
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
                ["総売上", "totalRevenue"], ["直接原価", "directCost"], ["粗利益", "grossProfit"],
                ["直接計上費", "directAssignedCost"], ["間接費", "indirectCost"],
                ["うち人件費", "laborCost"], ["営業利益", "operatingProfit"],
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

      <Card>
        <CardHeader><CardTitle>保険請求の精度</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <KpiCard label="保険点数" value={`${formatNumber(getKpi("insurancePoints"))}点`} status="neutral" />
            <KpiCard
              label="1点あたり単価"
              value={`${getKpi("revenuePerPoint").toFixed(2)}円`}
              status={statusMap(getKpiStatus("revenuePerPoint", getKpi("revenuePerPoint")))}
            />
            <KpiCard
              label="返戻・査定減率"
              value={formatPercent(getKpi("pointDeductionRate"))}
              status={statusMap(getKpiStatus("pointDeductionRate", getKpi("pointDeductionRate")))}
            />
          </div>
          <p className="text-xs text-gray-500 mt-4 leading-relaxed">
            診療報酬は1点=10円です。返戻・査定減があると実収入が10円を下回るため、1点あたり単価がレセプト請求の精度を表します。
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>売上・利益率の推移</CardTitle>
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
                  <YAxis tickFormatter={(v) => `${(v / 10000).toFixed(0)}万`} />
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                  <Legend />
                  <Bar dataKey="insuranceRevenue" name="保険" fill={COLORS[0]} stackId="a" />
                  <Bar dataKey="selfPayRevenue" name="自費" fill={COLORS[1]} stackId="a" />
                  <Bar dataKey="maintenanceRevenue" name="メンテ" fill={COLORS[2]} stackId="a" />
                  <Bar dataKey="homeVisitRevenue" name="訪問" fill={COLORS[3]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
              {/* 粗利益率は約91%と他の指標(20〜30%)から離れており、同一軸だと
                  営業利益率・自費率・人件費率が25%付近で重なって読めなくなるため軸を分ける */}
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis yAxisId="left" unit="%" domain={[0, 40]} />
                  <YAxis yAxisId="right" orientation="right" unit="%" domain={[80, 100]} />
                  <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="operatingProfitRate" name="営業利益率（左軸）" stroke={COLORS[1]} strokeWidth={2} />
                  <Line yAxisId="left" type="monotone" dataKey="selfPayRatio" name="自費率（左軸）" stroke={COLORS[2]} strokeWidth={2} />
                  <Line yAxisId="left" type="monotone" dataKey="laborCostRatio" name="人件費率（左軸）" stroke={COLORS[3]} strokeWidth={2} strokeDasharray="4 2" />
                  <Line yAxisId="right" type="monotone" dataKey="grossProfitRate" name="粗利益率（右軸）" stroke={COLORS[0]} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="text-gray-500 text-center py-8">データがありません</p>}
        </CardContent>
      </Card>
    </div>
  );
}
