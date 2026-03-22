"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DEPARTMENT_TYPES } from "@/lib/constants";
import { formatCurrency, formatPercent } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

interface DeptData {
  departmentType: string;
  revenue: number;
  directCost: number;
  directAssignedCost: number;
  grossProfit: number;
  preAllocationProfit: number;
  allocatedIndirectCost: number;
  postAllocationOperatingProfit: number;
  grossMargin: number;
  operatingMargin: number;
}

interface ClinicInfo {
  id: string;
  clinicName: string;
}

const CHART_COLORS = {
  revenue: "#3B82F6",
  directCost: "#EF4444",
  grossProfit: "#10B981",
  operatingProfit: "#8B5CF6",
};

export default function DepartmentPage() {
  const [clinics, setClinics] = useState<ClinicInfo[]>([]);
  const [selectedClinicId, setSelectedClinicId] = useState("");
  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date();
    now.setMonth(now.getMonth() - 1);
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [data, setData] = useState<DeptData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/clinics")
      .then((res) => res.json())
      .then((d) => {
        if (Array.isArray(d)) {
          setClinics(d);
          if (d.length > 0) setSelectedClinicId(d[0].id);
        }
      });
  }, []);

  useEffect(() => {
    if (selectedClinicId && yearMonth) loadData();
  }, [selectedClinicId, yearMonth]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/department?clinicId=${selectedClinicId}&yearMonth=${yearMonth}`);
      if (res.ok) {
        const d = await res.json();
        setData(Array.isArray(d) ? d : []);
      }
    } catch {
      // ignore
    }
    setLoading(false);
  };

  const recalculate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/department", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicId: selectedClinicId, yearMonth }),
      });
      if (res.ok) {
        const d = await res.json();
        setData(Array.isArray(d) ? d : []);
      }
    } catch {
      // ignore
    }
    setLoading(false);
  };

  const chartData = data.map((d) => ({
    name: DEPARTMENT_TYPES[d.departmentType as keyof typeof DEPARTMENT_TYPES] || d.departmentType,
    売上: d.revenue,
    直接費: d.directCost,
    粗利益: d.grossProfit,
    営業利益: d.postAllocationOperatingProfit,
  }));

  // 合計行
  const totals = data.reduce(
    (acc, d) => ({
      revenue: acc.revenue + d.revenue,
      directCost: acc.directCost + d.directCost,
      directAssignedCost: acc.directAssignedCost + d.directAssignedCost,
      grossProfit: acc.grossProfit + d.grossProfit,
      preAllocationProfit: acc.preAllocationProfit + d.preAllocationProfit,
      allocatedIndirectCost: acc.allocatedIndirectCost + d.allocatedIndirectCost,
      postAllocationOperatingProfit: acc.postAllocationOperatingProfit + d.postAllocationOperatingProfit,
    }),
    {
      revenue: 0, directCost: 0, directAssignedCost: 0, grossProfit: 0,
      preAllocationProfit: 0, allocatedIndirectCost: 0, postAllocationOperatingProfit: 0,
    }
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">部門別採算</h1>
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
          <Button size="sm" variant="secondary" onClick={recalculate} disabled={loading}>
            再計算
          </Button>
        </div>
      </div>

      {data.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <p>データがありません。先にコスト登録と配賦計算を実行してください。</p>
          </CardContent>
        </Card>
      )}

      {data.length > 0 && (
        <>
          {/* チャート */}
          <Card>
            <CardHeader>
              <CardTitle>部門別収益比較</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(v) => `${(v / 10000).toFixed(0)}万`} />
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                  <Legend />
                  <Bar dataKey="売上" fill={CHART_COLORS.revenue} />
                  <Bar dataKey="粗利益" fill={CHART_COLORS.grossProfit} />
                  <Bar dataKey="営業利益" fill={CHART_COLORS.operatingProfit} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* 詳細テーブル */}
          <Card>
            <CardHeader>
              <CardTitle>部門別損益計算書</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="px-3 py-2 text-left font-medium sticky left-0 bg-gray-50">項目</th>
                      {data.map((d) => (
                        <th key={d.departmentType} className="px-3 py-2 text-right font-medium">
                          {DEPARTMENT_TYPES[d.departmentType as keyof typeof DEPARTMENT_TYPES]}
                        </th>
                      ))}
                      <th className="px-3 py-2 text-right font-medium bg-blue-50">合計</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="px-3 py-2 font-medium sticky left-0 bg-white">売上高</td>
                      {data.map((d) => (
                        <td key={d.departmentType} className="px-3 py-2 text-right">{formatCurrency(d.revenue)}</td>
                      ))}
                      <td className="px-3 py-2 text-right font-bold bg-blue-50">{formatCurrency(totals.revenue)}</td>
                    </tr>
                    <tr className="border-b bg-gray-25">
                      <td className="px-3 py-2 font-medium sticky left-0 bg-white">直接原価</td>
                      {data.map((d) => (
                        <td key={d.departmentType} className="px-3 py-2 text-right text-red-600">{formatCurrency(d.directCost)}</td>
                      ))}
                      <td className="px-3 py-2 text-right font-bold text-red-600 bg-blue-50">{formatCurrency(totals.directCost)}</td>
                    </tr>
                    <tr className="border-b font-semibold bg-green-50">
                      <td className="px-3 py-2 sticky left-0 bg-green-50">粗利益</td>
                      {data.map((d) => (
                        <td key={d.departmentType} className="px-3 py-2 text-right">{formatCurrency(d.grossProfit)}</td>
                      ))}
                      <td className="px-3 py-2 text-right font-bold bg-green-100">{formatCurrency(totals.grossProfit)}</td>
                    </tr>
                    <tr className="border-b text-gray-500">
                      <td className="px-3 py-2 pl-6 sticky left-0 bg-white">粗利益率</td>
                      {data.map((d) => (
                        <td key={d.departmentType} className="px-3 py-2 text-right">{formatPercent(d.grossMargin)}</td>
                      ))}
                      <td className="px-3 py-2 text-right bg-blue-50">
                        {formatPercent(totals.revenue > 0 ? (totals.grossProfit / totals.revenue) * 100 : 0)}
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-3 py-2 font-medium sticky left-0 bg-white">直接計上費</td>
                      {data.map((d) => (
                        <td key={d.departmentType} className="px-3 py-2 text-right text-red-600">{formatCurrency(d.directAssignedCost)}</td>
                      ))}
                      <td className="px-3 py-2 text-right font-bold text-red-600 bg-blue-50">{formatCurrency(totals.directAssignedCost)}</td>
                    </tr>
                    <tr className="border-b bg-yellow-50">
                      <td className="px-3 py-2 font-semibold sticky left-0 bg-yellow-50">配賦前利益</td>
                      {data.map((d) => (
                        <td key={d.departmentType} className="px-3 py-2 text-right font-medium">{formatCurrency(d.preAllocationProfit)}</td>
                      ))}
                      <td className="px-3 py-2 text-right font-bold bg-yellow-100">{formatCurrency(totals.preAllocationProfit)}</td>
                    </tr>
                    <tr className="border-b text-gray-500">
                      <td className="px-3 py-2 pl-6 sticky left-0 bg-white">配賦前利益率</td>
                      {data.map((d) => (
                        <td key={d.departmentType} className="px-3 py-2 text-right">
                          {formatPercent(d.revenue > 0 ? (d.preAllocationProfit / d.revenue) * 100 : 0)}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right bg-blue-50">
                        {formatPercent(totals.revenue > 0 ? (totals.preAllocationProfit / totals.revenue) * 100 : 0)}
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-3 py-2 font-medium sticky left-0 bg-white">配賦間接費</td>
                      {data.map((d) => (
                        <td key={d.departmentType} className="px-3 py-2 text-right text-red-600">{formatCurrency(d.allocatedIndirectCost)}</td>
                      ))}
                      <td className="px-3 py-2 text-right font-bold text-red-600 bg-blue-50">{formatCurrency(totals.allocatedIndirectCost)}</td>
                    </tr>
                    <tr className="border-b bg-purple-50 font-bold">
                      <td className="px-3 py-2 sticky left-0 bg-purple-50">配賦後営業利益</td>
                      {data.map((d) => (
                        <td key={d.departmentType} className={`px-3 py-2 text-right ${d.postAllocationOperatingProfit < 0 ? "text-red-600" : "text-green-700"}`}>
                          {formatCurrency(d.postAllocationOperatingProfit)}
                        </td>
                      ))}
                      <td className={`px-3 py-2 text-right bg-purple-100 ${totals.postAllocationOperatingProfit < 0 ? "text-red-600" : "text-green-700"}`}>
                        {formatCurrency(totals.postAllocationOperatingProfit)}
                      </td>
                    </tr>
                    <tr className="text-gray-500">
                      <td className="px-3 py-2 pl-6 sticky left-0 bg-white">営業利益率</td>
                      {data.map((d) => (
                        <td key={d.departmentType} className={`px-3 py-2 text-right ${d.operatingMargin < 0 ? "text-red-500" : ""}`}>
                          {formatPercent(d.operatingMargin)}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right bg-blue-50">
                        {formatPercent(totals.revenue > 0 ? (totals.postAllocationOperatingProfit / totals.revenue) * 100 : 0)}
                      </td>
                    </tr>
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
