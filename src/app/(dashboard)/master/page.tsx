"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COST_ITEMS, COST_DRIVERS, BENCHMARKS } from "@/lib/constants";
import { KPI_DEFINITIONS } from "@/lib/kpi-calculator";

type TabType = "costItems" | "drivers" | "benchmarks" | "kpiDisplay";

interface CostItemRow { id?: string; code: string; name: string; isIndirect: boolean; isActive: boolean; sortOrder: number; }
interface DriverRow { id?: string; code: string; name: string; isActive: boolean; sortOrder: number; }
interface BenchmarkRow { id?: string; kpiCode: string; value: number; }
interface KpiDisplayRow { id?: string; kpiCode: string; isVisible: boolean; sortOrder: number; }

export default function MasterPage() {
  const [activeTab, setActiveTab] = useState<TabType>("costItems");
  const [clinicId, setClinicId] = useState("");
  const [costItems, setCostItems] = useState<CostItemRow[]>([]);
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [benchmarks, setBenchmarks] = useState<BenchmarkRow[]>([]);
  const [kpiDisplay, setKpiDisplay] = useState<KpiDisplayRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/clinics").then((r) => r.json()).then((data) => {
      if (Array.isArray(data) && data.length > 0) { setClinicId(data[0].id); initData(data[0].id); }
    });
  }, []);

  const initData = async (cid: string) => {
    // デフォルト費目を初期値として設定
    const defaultCostItems: CostItemRow[] = Object.values(COST_ITEMS).map((item, i) => ({
      code: item.code, name: item.name, isIndirect: item.isIndirect, isActive: true, sortOrder: i,
    }));
    setCostItems(defaultCostItems);

    const defaultDrivers: DriverRow[] = Object.entries(COST_DRIVERS).map(([code, name], i) => ({
      code, name, isActive: true, sortOrder: i,
    }));
    setDrivers(defaultDrivers);

    const defaultBenchmarks: BenchmarkRow[] = Object.entries(KPI_DEFINITIONS)
      .filter(([, def]) => def.benchmark != null)
      .map(([kpiCode, def]) => ({ kpiCode, value: def.benchmark! }));
    setBenchmarks(defaultBenchmarks);

    const defaultKpiDisplay: KpiDisplayRow[] = Object.keys(KPI_DEFINITIONS).map((kpiCode, i) => ({
      kpiCode, isVisible: true, sortOrder: i,
    }));
    setKpiDisplay(defaultKpiDisplay);

    // カスタム設定を上書き読み込み
    for (const type of ["costItems", "drivers", "benchmarks", "kpiDisplay"] as const) {
      try {
        const res = await fetch(`/api/master?clinicId=${cid}&type=${type}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            if (type === "costItems") setCostItems((prev) => mergeItems(prev, data, "code"));
            if (type === "drivers") setDrivers((prev) => mergeItems(prev, data, "code"));
            if (type === "benchmarks") setBenchmarks((prev) => mergeItems(prev, data, "kpiCode"));
            if (type === "kpiDisplay") setKpiDisplay((prev) => mergeItems(prev, data, "kpiCode"));
          }
        }
      } catch { /* ignore */ }
    }
  };

  const mergeItems = <T extends Record<string, any>>(defaults: T[], customs: T[], key: string): T[] => {
    const map = new Map(defaults.map((d) => [d[key], d]));
    for (const c of customs) map.set(c[key], { ...map.get(c[key]), ...c });
    return Array.from(map.values());
  };

  const save = async (type: TabType) => {
    setSaving(true); setMessage("");
    try {
      const items = type === "costItems" ? costItems : type === "drivers" ? drivers : type === "benchmarks" ? benchmarks : kpiDisplay;
      const res = await fetch("/api/master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicId, type, items }),
      });
      setMessage(res.ok ? "保存しました" : "保存に失敗しました");
    } catch { setMessage("保存に失敗しました"); }
    setSaving(false);
  };

  const tabs: { key: TabType; label: string }[] = [
    { key: "costItems", label: "費目マスタ" },
    { key: "drivers", label: "ドライバーマスタ" },
    { key: "benchmarks", label: "ベンチマーク値" },
    { key: "kpiDisplay", label: "KPI表示設定" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">マスタ管理</h1>

      {message && <div className={`px-4 py-3 rounded text-sm ${message.includes("失敗") ? "bg-red-50 text-red-700 border border-red-200" : "bg-green-50 text-green-700 border border-green-200"}`}>{message}</div>}

      <div className="flex border-b border-gray-200 overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.key} className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${activeTab === t.key ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`} onClick={() => setActiveTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {/* 費目マスタ */}
      {activeTab === "costItems" && (
        <Card>
          <CardHeader><CardTitle>費目マスタ</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead><tr className="border-b bg-gray-50">
                  <th className="px-3 py-2 text-left">コード</th><th className="px-3 py-2 text-left">名称</th>
                  <th className="px-3 py-2 text-center">間接費</th><th className="px-3 py-2 text-center">有効</th>
                </tr></thead>
                <tbody>
                  {costItems.map((item, i) => (
                    <tr key={item.code} className="border-b">
                      <td className="px-3 py-2 text-gray-500">{item.code}</td>
                      <td className="px-3 py-2"><Input className="w-40" value={item.name} onChange={(e) => setCostItems((p) => p.map((c, j) => j === i ? { ...c, name: e.target.value } : c))} /></td>
                      <td className="px-3 py-2 text-center"><input type="checkbox" checked={item.isIndirect} onChange={(e) => setCostItems((p) => p.map((c, j) => j === i ? { ...c, isIndirect: e.target.checked } : c))} /></td>
                      <td className="px-3 py-2 text-center"><input type="checkbox" checked={item.isActive} onChange={(e) => setCostItems((p) => p.map((c, j) => j === i ? { ...c, isActive: e.target.checked } : c))} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end"><Button onClick={() => save("costItems")} disabled={saving}>{saving ? "保存中..." : "保存"}</Button></div>
          </CardContent>
        </Card>
      )}

      {/* ドライバーマスタ */}
      {activeTab === "drivers" && (
        <Card>
          <CardHeader><CardTitle>配賦ドライバーマスタ</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead><tr className="border-b bg-gray-50">
                  <th className="px-3 py-2 text-left">コード</th><th className="px-3 py-2 text-left">名称</th><th className="px-3 py-2 text-center">有効</th>
                </tr></thead>
                <tbody>
                  {drivers.map((d, i) => (
                    <tr key={d.code} className="border-b">
                      <td className="px-3 py-2 text-gray-500">{d.code}</td>
                      <td className="px-3 py-2"><Input className="w-40" value={d.name} onChange={(e) => setDrivers((p) => p.map((c, j) => j === i ? { ...c, name: e.target.value } : c))} /></td>
                      <td className="px-3 py-2 text-center"><input type="checkbox" checked={d.isActive} onChange={(e) => setDrivers((p) => p.map((c, j) => j === i ? { ...c, isActive: e.target.checked } : c))} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end"><Button onClick={() => save("drivers")} disabled={saving}>{saving ? "保存中..." : "保存"}</Button></div>
          </CardContent>
        </Card>
      )}

      {/* ベンチマーク値 */}
      {activeTab === "benchmarks" && (
        <Card>
          <CardHeader><CardTitle>ベンチマーク値カスタマイズ</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 mb-4">デフォルトのベンチマーク値を医院に合わせてカスタマイズできます。</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {benchmarks.map((b, i) => {
                const def = KPI_DEFINITIONS[b.kpiCode];
                return (
                  <div key={b.kpiCode} className="flex items-center gap-2">
                    <Label className="w-40 shrink-0 text-sm">{def?.name || b.kpiCode}</Label>
                    <Input type="number" step="0.1" className="w-28" value={b.value} onChange={(e) => setBenchmarks((p) => p.map((c, j) => j === i ? { ...c, value: Number(e.target.value) || 0 } : c))} />
                    <span className="text-xs text-gray-400">{def?.unit}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex justify-end"><Button onClick={() => save("benchmarks")} disabled={saving}>{saving ? "保存中..." : "保存"}</Button></div>
          </CardContent>
        </Card>
      )}

      {/* KPI表示設定 */}
      {activeTab === "kpiDisplay" && (
        <Card>
          <CardHeader><CardTitle>KPI表示設定</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 mb-4">ダッシュボードに表示するKPIを選択・並べ替えできます。</p>
            <div className="space-y-2">
              {kpiDisplay.map((kd, i) => {
                const def = KPI_DEFINITIONS[kd.kpiCode];
                return (
                  <div key={kd.kpiCode} className="flex items-center gap-3 p-2 border rounded">
                    <input type="checkbox" checked={kd.isVisible} onChange={(e) => setKpiDisplay((p) => p.map((c, j) => j === i ? { ...c, isVisible: e.target.checked } : c))} />
                    <span className="text-sm font-medium flex-1">{def?.name || kd.kpiCode}</span>
                    <span className="text-xs text-gray-400">{def?.category}</span>
                    <span className="text-xs text-gray-400">{def?.unit}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex justify-end"><Button onClick={() => save("kpiDisplay")} disabled={saving}>{saving ? "保存中..." : "保存"}</Button></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
