"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { COST_ITEMS, COST_DRIVERS, DEPARTMENT_TYPES } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";

type DeptKey = Exclude<keyof typeof DEPARTMENT_TYPES, "TOTAL">;
type TabType = "rules" | "drivers" | "results";

interface AllocationRule {
  costItemCode: string;
  allocationTargetType: string;
  driverType: string;
  driverRatio: number;
  manualOverride: boolean;
}

interface DriverValue {
  driverType: string;
  departmentType: string;
  driverValue: number;
}

interface AllocationResultItem {
  costItemCode: string;
  departmentType: string;
  driverType: string;
  driverRate: number;
  allocatedAmount: number;
}

interface ClinicInfo { id: string; clinicName: string; }

const DEPARTMENTS: DeptKey[] = ["INSURANCE", "SELF_PAY", "MAINTENANCE", "HOME_VISIT"];
const TAB_LABELS: Record<TabType, string> = {
  rules: "配賦ルール",
  drivers: "ドライバー値入力",
  results: "配賦結果確認",
};

export default function AllocationPage() {
  const [clinics, setClinics] = useState<ClinicInfo[]>([]);
  const [selectedClinicId, setSelectedClinicId] = useState("");
  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date(); now.setMonth(now.getMonth() - 1);
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [tab, setTab] = useState<TabType>("rules");
  const [rules, setRules] = useState<AllocationRule[]>([]);
  const [drivers, setDrivers] = useState<DriverValue[]>([]);
  const [results, setResults] = useState<AllocationResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/clinics").then(r => r.json()).then(d => {
      if (Array.isArray(d)) { setClinics(d); if (d.length > 0) setSelectedClinicId(d[0].id); }
    });
  }, []);

  const loadRules = useCallback(async () => {
    if (!selectedClinicId) return;
    const res = await fetch(`/api/allocation?clinicId=${selectedClinicId}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) setRules(data);
      else initializeRules();
    }
  }, [selectedClinicId]);

  const loadDrivers = useCallback(async () => {
    if (!selectedClinicId) return;
    const res = await fetch(`/api/allocation/drivers?clinicId=${selectedClinicId}&yearMonth=${yearMonth}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setDrivers(data);
      } else {
        initializeDrivers();
      }
    }
  }, [selectedClinicId, yearMonth]);

  const loadResults = useCallback(async () => {
    if (!selectedClinicId) return;
    // 配賦結果はallocation/calculateの結果として保存済み
    // AllocationResult テーブルから取得（GETはallocationルートに追加が必要）
    // 簡易的にdepartment APIから取得
    try {
      const res = await fetch(`/api/department?clinicId=${selectedClinicId}&yearMonth=${yearMonth}`);
      if (res.ok) {
        const data = await res.json();
        // 配賦結果は部門別採算から確認可能
      }
    } catch { /* ignore */ }
  }, [selectedClinicId, yearMonth]);

  useEffect(() => {
    if (tab === "rules") loadRules();
    else if (tab === "drivers") loadDrivers();
    else if (tab === "results") loadResults();
  }, [tab, selectedClinicId, yearMonth]);

  const initializeRules = () => {
    const indirectItems = Object.values(COST_ITEMS).filter(i => i.isIndirect);
    const initial: AllocationRule[] = [];
    for (const item of indirectItems) {
      for (const dept of DEPARTMENTS) {
        initial.push({
          costItemCode: item.code,
          allocationTargetType: dept,
          driverType: "REVENUE_RATIO",
          driverRatio: 25,
          manualOverride: false,
        });
      }
    }
    setRules(initial);
  };

  const initializeDrivers = () => {
    const driverTypes = Object.keys(COST_DRIVERS);
    const initial: DriverValue[] = [];
    for (const dt of driverTypes) {
      for (const dept of DEPARTMENTS) {
        initial.push({ driverType: dt, departmentType: dept, driverValue: 0 });
      }
    }
    setDrivers(initial);
  };

  const updateRule = (costItemCode: string, dept: string, field: string, value: unknown) => {
    setRules(prev => prev.map(r =>
      r.costItemCode === costItemCode && r.allocationTargetType === dept ? { ...r, [field]: value } : r
    ));
  };

  const setDriverForItem = (costItemCode: string, driverType: string) => {
    setRules(prev => prev.map(r =>
      r.costItemCode === costItemCode ? { ...r, driverType, manualOverride: driverType === "MANUAL" } : r
    ));
  };

  const updateDriverValue = (driverType: string, dept: string, value: number) => {
    setDrivers(prev => {
      const existing = prev.find(d => d.driverType === driverType && d.departmentType === dept);
      if (existing) {
        return prev.map(d => d.driverType === driverType && d.departmentType === dept ? { ...d, driverValue: value } : d);
      }
      return [...prev, { driverType, departmentType: dept, driverValue: value }];
    });
  };

  const handleSaveRules = async () => {
    setLoading(true); setMessage("");
    try {
      const res = await fetch("/api/allocation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicId: selectedClinicId, rules }),
      });
      setMessage(res.ok ? "配賦ルールを保存しました" : "保存に失敗しました");
    } catch { setMessage("保存に失敗しました"); }
    setLoading(false);
  };

  const handleSaveDrivers = async () => {
    setLoading(true); setMessage("");
    try {
      const nonZero = drivers.filter(d => d.driverValue > 0);
      const res = await fetch("/api/allocation/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicId: selectedClinicId, yearMonth, drivers: nonZero }),
      });
      setMessage(res.ok ? "ドライバー値を保存しました" : "保存に失敗しました");
    } catch { setMessage("保存に失敗しました"); }
    setLoading(false);
  };

  const handleCalculate = async () => {
    setLoading(true); setMessage("");
    try {
      const res = await fetch("/api/allocation/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicId: selectedClinicId, yearMonth }),
      });
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
        setMessage(`配賦計算が完了しました（${data.resultCount}件）`);
        setTab("results");
      } else {
        const data = await res.json();
        setMessage(data.error || "配賦計算に失敗しました");
      }
    } catch { setMessage("配賦計算に失敗しました"); }
    setLoading(false);
  };

  const indirectItems = Object.values(COST_ITEMS).filter(i => i.isIndirect);
  // ルールで使われているドライバータイプ一覧
  const usedDriverTypes = [...new Set(rules.map(r => r.driverType))].filter(d => d !== "MANUAL");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">配賦設定</h1>
        <div className="flex items-center gap-3">
          <input type="month" className="border border-gray-300 rounded-md px-3 py-1.5 text-sm" value={yearMonth} onChange={e => setYearMonth(e.target.value)} />
          <Button onClick={handleCalculate} disabled={loading}>
            {loading ? "計算中..." : "配賦計算実行"}
          </Button>
        </div>
      </div>

      {message && (
        <div className={`px-4 py-3 rounded text-sm ${message.includes("失敗") ? "bg-red-50 text-red-700 border border-red-200" : "bg-green-50 text-green-700 border border-green-200"}`}>
          {message}
        </div>
      )}

      {/* タブ */}
      <div className="flex border-b">
        {(Object.entries(TAB_LABELS) as [TabType, string][]).map(([key, label]) => (
          <button
            key={key}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === key ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 配賦ルールタブ */}
      {tab === "rules" && (
        <Card>
          <CardHeader><CardTitle>配賦ルール設定</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 mb-4">
              間接費の各費目について、どのコストドライバーで部門に配賦するかを設定します。
            </p>
            {indirectItems.map(item => {
              const itemRules = rules.filter(r => r.costItemCode === item.code);
              const currentDriver = itemRules[0]?.driverType || "REVENUE_RATIO";
              const isManual = currentDriver === "MANUAL";
              const totalRatio = itemRules.reduce((s, r) => s + r.driverRatio, 0);

              return (
                <div key={item.code} className="mb-4 border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium">{item.name}</h3>
                    <select className="border rounded px-3 py-1.5 text-sm" value={currentDriver} onChange={e => setDriverForItem(item.code, e.target.value)}>
                      {Object.entries(COST_DRIVERS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  {isManual && (
                    <div className="grid grid-cols-4 gap-2">
                      {DEPARTMENTS.map(dept => {
                        const rule = itemRules.find(r => r.allocationTargetType === dept);
                        return (
                          <div key={dept} className="text-center">
                            <div className="text-xs text-gray-500 mb-1">{DEPARTMENT_TYPES[dept]}</div>
                            <Input type="number" className="text-center text-sm" value={rule?.driverRatio || 0} onChange={e => updateRule(item.code, dept, "driverRatio", Number(e.target.value) || 0)} step={0.1} />
                            <div className="text-xs text-gray-400 mt-0.5">%</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {isManual && Math.abs(totalRatio - 100) > 0.1 && (
                    <div className="text-xs text-red-500 mt-1">合計 {totalRatio.toFixed(1)}%（100%にしてください）</div>
                  )}
                  {!isManual && (
                    <div className="text-sm text-gray-500">「{COST_DRIVERS[currentDriver as keyof typeof COST_DRIVERS]}」に基づいて自動配賦されます</div>
                  )}
                </div>
              );
            })}
            <div className="flex justify-end mt-4">
              <Button onClick={handleSaveRules} disabled={loading}>{loading ? "保存中..." : "ルール保存"}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ドライバー値入力タブ */}
      {tab === "drivers" && (
        <Card>
          <CardHeader><CardTitle>ドライバー値入力（{yearMonth}）</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 mb-4">
              配賦計算に使用する各部門のドライバー量を入力してください。配賦ルールで設定されたドライバータイプのみ表示されます。
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="px-3 py-2 text-left font-medium">ドライバー</th>
                    {DEPARTMENTS.map(d => <th key={d} className="px-3 py-2 text-right font-medium">{DEPARTMENT_TYPES[d]}</th>)}
                    <th className="px-3 py-2 text-right font-medium">合計</th>
                  </tr>
                </thead>
                <tbody>
                  {(usedDriverTypes.length > 0 ? usedDriverTypes : Object.keys(COST_DRIVERS)).map(dt => {
                    const total = DEPARTMENTS.reduce((s, dept) => {
                      const v = drivers.find(d => d.driverType === dt && d.departmentType === dept);
                      return s + (v?.driverValue || 0);
                    }, 0);
                    return (
                      <tr key={dt} className="border-b">
                        <td className="px-3 py-2 font-medium">{COST_DRIVERS[dt as keyof typeof COST_DRIVERS] || dt}</td>
                        {DEPARTMENTS.map(dept => (
                          <td key={dept} className="px-3 py-2">
                            <Input
                              type="number"
                              className="w-24 text-right"
                              value={drivers.find(d => d.driverType === dt && d.departmentType === dept)?.driverValue || ""}
                              onChange={e => updateDriverValue(dt, dept, Number(e.target.value) || 0)}
                            />
                          </td>
                        ))}
                        <td className="px-3 py-2 text-right font-medium">{total.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end mt-4">
              <Button onClick={handleSaveDrivers} disabled={loading}>{loading ? "保存中..." : "ドライバー値保存"}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 配賦結果確認タブ */}
      {tab === "results" && (
        <Card>
          <CardHeader><CardTitle>配賦結果（{yearMonth}）</CardTitle></CardHeader>
          <CardContent>
            {results.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                <p>配賦結果がありません</p>
                <p className="text-sm mt-1">「配賦計算実行」ボタンを押してください</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="px-3 py-2 text-left font-medium">費目</th>
                      <th className="px-3 py-2 text-left font-medium">配賦先部門</th>
                      <th className="px-3 py-2 text-left font-medium">ドライバー</th>
                      <th className="px-3 py-2 text-right font-medium">配賦額</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => {
                      const item = Object.values(COST_ITEMS).find(c => c.code === r.costItemCode);
                      return (
                        <tr key={i} className="border-b">
                          <td className="px-3 py-2">{item?.name || r.costItemCode}</td>
                          <td className="px-3 py-2">{DEPARTMENT_TYPES[r.departmentType as keyof typeof DEPARTMENT_TYPES] || r.departmentType}</td>
                          <td className="px-3 py-2">{COST_DRIVERS[r.driverType as keyof typeof COST_DRIVERS] || r.driverType}</td>
                          <td className="px-3 py-2 text-right font-medium">{formatCurrency(r.allocatedAmount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 bg-gray-50">
                      <td colSpan={3} className="px-3 py-2 font-bold">合計</td>
                      <td className="px-3 py-2 text-right font-bold">{formatCurrency(results.reduce((s, r) => s + r.allocatedAmount, 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
