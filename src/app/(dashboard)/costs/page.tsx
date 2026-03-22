"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { COST_ITEMS, DEPARTMENT_TYPES } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";

type CostLayerType = "DIRECT" | "DIRECT_ASSIGNED" | "INDIRECT";

interface CostEntry {
  costItemCode: string;
  departmentType: string;
  costLayer: CostLayerType;
  amount: number;
  memo: string;
}

interface ClinicInfo {
  id: string;
  clinicName: string;
}

const COST_LAYER_LABELS: Record<CostLayerType, string> = {
  DIRECT: "直接原価",
  DIRECT_ASSIGNED: "直接計上費",
  INDIRECT: "間接費",
};

const COST_LAYER_COLORS: Record<CostLayerType, string> = {
  DIRECT: "bg-blue-100 text-blue-700",
  DIRECT_ASSIGNED: "bg-purple-100 text-purple-700",
  INDIRECT: "bg-orange-100 text-orange-700",
};

export default function CostsPage() {
  const [clinics, setClinics] = useState<ClinicInfo[]>([]);
  const [selectedClinicId, setSelectedClinicId] = useState("");
  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date();
    now.setMonth(now.getMonth() - 1);
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [costs, setCosts] = useState<CostEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/clinics")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setClinics(data);
          if (data.length > 0) setSelectedClinicId(data[0].id);
        }
      });
  }, []);

  useEffect(() => {
    if (!selectedClinicId) return;
    loadCosts();
  }, [selectedClinicId, yearMonth]);

  const loadCosts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/costs?clinicId=${selectedClinicId}&yearMonth=${yearMonth}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setCosts(data.map((d: CostEntry) => ({
            costItemCode: d.costItemCode,
            departmentType: d.departmentType,
            costLayer: d.costLayer || "INDIRECT",
            amount: d.amount,
            memo: d.memo || "",
          })));
        } else {
          initializeCosts();
        }
      }
    } catch {
      initializeCosts();
    }
    setLoading(false);
  };

  const initializeCosts = () => {
    const initial: CostEntry[] = Object.values(COST_ITEMS).map((item) => ({
      costItemCode: item.code,
      departmentType: "TOTAL",
      costLayer: item.isIndirect ? "INDIRECT" : "DIRECT",
      amount: 0,
      memo: "",
    }));
    setCosts(initial);
  };

  const updateCost = (index: number, field: keyof CostEntry, value: unknown) => {
    setCosts((prev) => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinicId: selectedClinicId,
          yearMonth,
          costs: costs.filter((c) => c.amount > 0),
        }),
      });
      if (res.ok) {
        setMessage("保存しました");
      } else {
        setMessage("保存に失敗しました");
      }
    } catch {
      setMessage("保存に失敗しました");
    }
    setSaving(false);
  };

  const totalAmount = costs.reduce((sum, c) => sum + c.amount, 0);
  const directTotal = costs.filter((c) => c.costLayer === "DIRECT").reduce((sum, c) => sum + c.amount, 0);
  const directAssignedTotal = costs.filter((c) => c.costLayer === "DIRECT_ASSIGNED").reduce((sum, c) => sum + c.amount, 0);
  const indirectTotal = costs.filter((c) => c.costLayer === "INDIRECT").reduce((sum, c) => sum + c.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">コスト登録</h1>
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
        </div>
      </div>

      {message && (
        <div className={`px-4 py-3 rounded text-sm ${message.includes("失敗") ? "bg-red-50 text-red-700 border border-red-200" : "bg-green-50 text-green-700 border border-green-200"}`}>
          {message}
        </div>
      )}

      {/* サマリー - 3層コスト構造 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-gray-500">コスト合計</div>
            <div className="text-xl font-bold">{formatCurrency(totalAmount)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-gray-500">直接原価</div>
            <div className="text-xl font-bold text-blue-600">{formatCurrency(directTotal)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-gray-500">直接計上費</div>
            <div className="text-xl font-bold text-purple-600">{formatCurrency(directAssignedTotal)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-gray-500">間接費</div>
            <div className="text-xl font-bold text-orange-600">{formatCurrency(indirectTotal)}</div>
          </CardContent>
        </Card>
      </div>

      {/* コスト入力テーブル */}
      <Card>
        <CardHeader>
          <CardTitle>費目別コスト入力</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-gray-500 py-4">読み込み中...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="px-3 py-2 text-left font-medium">費目</th>
                    <th className="px-3 py-2 text-left font-medium">コスト区分</th>
                    <th className="px-3 py-2 text-right font-medium">金額（円）</th>
                    <th className="px-3 py-2 text-left font-medium">部門</th>
                    <th className="px-3 py-2 text-left font-medium">メモ</th>
                  </tr>
                </thead>
                <tbody>
                  {costs.map((cost, index) => {
                    const item = Object.values(COST_ITEMS).find((i) => i.code === cost.costItemCode);
                    return (
                      <tr key={index} className="border-b">
                        <td className="px-3 py-2 font-medium">{item?.name || cost.costItemCode}</td>
                        <td className="px-3 py-2">
                          <select
                            className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${COST_LAYER_COLORS[cost.costLayer]}`}
                            value={cost.costLayer}
                            onChange={(e) => updateCost(index, "costLayer", e.target.value)}
                          >
                            {Object.entries(COST_LAYER_LABELS).map(([key, label]) => (
                              <option key={key} value={key}>{label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            className="w-32 text-right"
                            value={cost.amount || ""}
                            onChange={(e) => updateCost(index, "amount", Number(e.target.value) || 0)}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            className="border border-gray-300 rounded px-2 py-1 text-sm"
                            value={cost.departmentType}
                            onChange={(e) => updateCost(index, "departmentType", e.target.value)}
                          >
                            {Object.entries(DEPARTMENT_TYPES).map(([key, label]) => (
                              <option key={key} value={key}>{label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            className="w-40"
                            value={cost.memo}
                            onChange={(e) => updateCost(index, "memo", e.target.value)}
                            placeholder="メモ"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "保存中..." : "保存"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
