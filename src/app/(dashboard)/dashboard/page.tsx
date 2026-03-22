"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/utils";
import { getKpiStatus, KPI_DEFINITIONS } from "@/lib/kpi-calculator";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

interface ClinicInfo {
  id: string;
  clinicName: string;
}

interface KpiData {
  kpiCode: string;
  kpiValue: number;
  comparisonPrevMonth?: number | null;
  comparisonPrevYear?: number | null;
  targetValue?: number | null;
  achievementRate?: number | null;
}

// KPI_DEFINITIONSから自動生成
const KPI_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(KPI_DEFINITIONS).map(([k, v]) => [k, v.name])
);

const CHART_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];

const statusMap = (s: string): "positive" | "warning" | "critical" | "neutral" => {
  if (s === "good") return "positive";
  if (s === "warning") return "warning";
  if (s === "danger") return "critical";
  return "neutral";
};

export default function DashboardPage() {
  const [clinics, setClinics] = useState<ClinicInfo[]>([]);
  const [selectedClinicId, setSelectedClinicId] = useState("");
  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date();
    now.setMonth(now.getMonth() - 1);
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [kpis, setKpis] = useState<KpiData[]>([]);
  const [trendData, setTrendData] = useState<Record<string, number>[]>([]);
  const [loading, setLoading] = useState(false);

  const [noClinic, setNoClinic] = useState(false);

  useEffect(() => {
    fetch("/api/clinics")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          if (data.length === 0) {
            setNoClinic(true);
          } else {
            setClinics(data);
            if (data.length > 0 && !selectedClinicId) {
              setSelectedClinicId(data[0].id);
            }
          }
        }
      })
      .catch(() => {});
  }, []);

  const fetchKpis = useCallback(async () => {
    if (!selectedClinicId || !yearMonth) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/kpi?clinicId=${selectedClinicId}&yearMonth=${yearMonth}`);
      if (res.ok) {
        const data = await res.json();
        setKpis(Array.isArray(data) ? data : []);
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }, [selectedClinicId, yearMonth]);

  // トレンドデータ取得（過去6ヶ月分）
  const fetchTrend = useCallback(async () => {
    if (!selectedClinicId) return;
    const months = getLast6Months(yearMonth);
    const results: Record<string, number>[] = [];

    for (const m of months) {
      try {
        const res = await fetch(`/api/kpi?clinicId=${selectedClinicId}&yearMonth=${m}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const row: Record<string, number> = { month: parseInt(m.split("-")[1]) };
            for (const kpi of data) {
              row[kpi.kpiCode] = kpi.kpiValue;
            }
            results.push(row);
          }
        }
      } catch {
        // skip
      }
    }
    setTrendData(results);
  }, [selectedClinicId, yearMonth]);

  useEffect(() => {
    fetchKpis();
  }, [fetchKpis]);

  useEffect(() => {
    if (kpis.length > 0) {
      fetchTrend();
    }
  }, [kpis.length > 0, selectedClinicId]);

  const getKpi = (code: string): KpiData | undefined =>
    kpis.find((k) => k.kpiCode === code);

  const getKpiValue = (code: string): number =>
    getKpi(code)?.kpiValue || 0;

  // 売上構成比データ
  const revenueComposition = [
    { name: "保険", value: getKpiValue("insuranceRevenue") },
    { name: "自費", value: getKpiValue("selfPayRevenue") },
    { name: "メンテ", value: getKpiValue("maintenanceRevenue") },
    { name: "訪問", value: getKpiValue("homeVisitRevenue") },
  ].filter((d) => d.value > 0);

  // 主要KPIカード
  const mainKpis = [
    "totalRevenue", "selfPayRatio", "newPatientCount", "returnRate",
    "revenuePerUnit", "laborCostRatio", "grossProfitRate", "operatingProfitRate",
  ];

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">経営ダッシュボード</h1>
        <div className="flex items-center gap-3">
          {clinics.length > 1 && (
            <select
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
              value={selectedClinicId}
              onChange={(e) => setSelectedClinicId(e.target.value)}
            >
              {clinics.map((c) => (
                <option key={c.id} value={c.id}>{c.clinicName}</option>
              ))}
            </select>
          )}
          <input
            type="month"
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
          />
          <Button size="sm" onClick={fetchKpis} disabled={loading} data-testid="refresh-btn">
            {loading ? "読込中..." : "更新"}
          </Button>
        </div>
      </div>

      {noClinic && (
        <Card>
          <CardContent>
            <div className="py-12 text-center text-gray-500">
              <p className="text-lg font-medium">医院が登録されていません</p>
              <p className="text-sm mt-2">
                まず初期設定で医院情報を登録してください
              </p>
              <Button
                className="mt-4"
                onClick={() => window.location.href = "/setup"}
              >
                初期設定へ
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!noClinic && kpis.length === 0 && !loading && (
        <Card>
          <CardContent>
            <div className="py-12 text-center text-gray-500">
              <p className="text-lg font-medium">データがありません</p>
              <p className="text-sm mt-2">
                「データ取込」からCSVファイルをインポートしてください
              </p>
              <Button
                className="mt-4"
                variant="secondary"
                onClick={() => window.location.href = "/import"}
              >
                データ取込へ
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {kpis.length > 0 && (
        <>
          {/* 主要KPIカード */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {mainKpis.map((code) => {
              const kpi = getKpi(code);
              if (!kpi) return null;
              const def = KPI_DEFINITIONS[code];
              const isPercent = def?.format === "percent";
              const isCurrency = def?.format === "currency";

              return (
                <KpiCard
                  key={code}
                  label={KPI_LABELS[code] || code}
                  value={
                    isCurrency
                      ? formatCurrency(kpi.kpiValue)
                      : isPercent
                      ? formatPercent(kpi.kpiValue)
                      : formatNumber(kpi.kpiValue)
                  }
                  status={statusMap(getKpiStatus(code, kpi.kpiValue))}
                  target={kpi.targetValue != null
                    ? (isCurrency ? formatCurrency(kpi.targetValue) : isPercent ? formatPercent(kpi.targetValue) : String(kpi.targetValue))
                    : undefined}
                  change={kpi.comparisonPrevMonth != null
                    ? {
                        value: kpi.kpiValue !== 0
                          ? (kpi.comparisonPrevMonth / (kpi.kpiValue - kpi.comparisonPrevMonth)) * 100
                          : 0,
                        label: "前月比",
                      }
                    : undefined}
                />
              );
            })}
          </div>

          {/* チャートエリア */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 売上推移 */}
            {trendData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>売上推移</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tickFormatter={(v) => `${v}月`} />
                      <YAxis tickFormatter={(v) => `${(v / 10000).toFixed(0)}万`} />
                      <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                      <Legend />
                      <Bar dataKey="insuranceRevenue" name="保険" fill={CHART_COLORS[0]} stackId="a" />
                      <Bar dataKey="selfPayRevenue" name="自費" fill={CHART_COLORS[1]} stackId="a" />
                      <Bar dataKey="maintenanceRevenue" name="メンテ" fill={CHART_COLORS[2]} stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* 売上構成比 */}
            {revenueComposition.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>売上構成比</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={revenueComposition}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(1)}%`}
                      >
                        {revenueComposition.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* 患者数推移 */}
            {trendData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>患者数推移</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tickFormatter={(v) => `${v}月`} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="totalPatientCount" name="延患者数" stroke={CHART_COLORS[0]} strokeWidth={2} />
                      <Line type="monotone" dataKey="newPatientCount" name="新患数" stroke={CHART_COLORS[1]} strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* 収益性指標推移 */}
            {trendData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>収益性指標推移</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tickFormatter={(v) => `${v}月`} />
                      <YAxis tickFormatter={(v) => `${v}%`} />
                      <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />
                      <Legend />
                      <Line type="monotone" dataKey="grossProfitRate" name="粗利益率" stroke={CHART_COLORS[0]} strokeWidth={2} />
                      <Line type="monotone" dataKey="operatingProfitRate" name="営業利益率" stroke={CHART_COLORS[1]} strokeWidth={2} />
                      <Line type="monotone" dataKey="laborCostRatio" name="人件費率" stroke={CHART_COLORS[3]} strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>

          {/* 詳細KPI一覧 */}
          <Card>
            <CardHeader>
              <CardTitle>KPI一覧</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="px-4 py-2 text-left font-medium">指標</th>
                      <th className="px-4 py-2 text-right font-medium">値</th>
                      <th className="px-4 py-2 text-right font-medium">前月比</th>
                      <th className="px-4 py-2 text-right font-medium">目標</th>
                      <th className="px-4 py-2 text-right font-medium">達成率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kpis
                      .filter((k) => KPI_LABELS[k.kpiCode])
                      .map((kpi) => {
                        const def = KPI_DEFINITIONS[kpi.kpiCode];
                        const isPercent = def?.format === "percent";
                        const isCurrency = def?.format === "currency";
                        const fmt = (v: number) =>
                          isCurrency ? formatCurrency(v) : isPercent ? formatPercent(v) : formatNumber(v);

                        return (
                          <tr key={kpi.kpiCode} className="border-b">
                            <td className="px-4 py-2">{KPI_LABELS[kpi.kpiCode]}</td>
                            <td className="px-4 py-2 text-right font-medium">{fmt(kpi.kpiValue)}</td>
                            <td className="px-4 py-2 text-right">
                              {kpi.comparisonPrevMonth != null ? (
                                <span className={kpi.comparisonPrevMonth >= 0 ? "text-green-600" : "text-red-600"}>
                                  {kpi.comparisonPrevMonth >= 0 ? "+" : ""}{fmt(kpi.comparisonPrevMonth)}
                                </span>
                              ) : "-"}
                            </td>
                            <td className="px-4 py-2 text-right">
                              {kpi.targetValue != null ? fmt(kpi.targetValue) : "-"}
                            </td>
                            <td className="px-4 py-2 text-right">
                              {kpi.achievementRate != null ? `${kpi.achievementRate.toFixed(1)}%` : "-"}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function getLast6Months(current: string): string[] {
  const [y, m] = current.split("-").map(Number);
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}
