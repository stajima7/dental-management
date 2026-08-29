"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CapacityView, type CapacityData } from "@/components/capacity/capacity-view";

/**
 * 増員・増設の検討
 *
 * 「収入が限界に近づいてきたとき、ユニット・歯科医師・歯科衛生士のどれを増やすか」
 * 「メンテナンス患者が増えてきたとき、体制をどう広げるか」を判断するための画面。
 */

interface ClinicInfo { id: string; clinicName: string; latestYearMonth?: string; }

const ROLE_LABELS: [string, string][] = [
  ["DENTIST", "歯科医師（勤務医）"],
  ["HYGIENIST", "歯科衛生士"],
  ["ASSISTANT", "歯科助手"],
  ["RECEPTION", "受付"],
  ["TECHNICIAN", "技工士"],
];

export default function CapacityPage() {
  const [clinics, setClinics] = useState<ClinicInfo[]>([]);
  const [selectedClinicId, setSelectedClinicId] = useState("");
  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date(); now.setMonth(now.getMonth() - 1);
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [data, setData] = useState<CapacityData | null>(null);
  const [loading, setLoading] = useState(false);

  const [showSettings, setShowSettings] = useState(false);
  const [rates, setRates] = useState<Record<string, string>>({});
  const [expSetting, setExpSetting] = useState({
    baseUnitCount: "3", revenuePerUnitBase: "", revenuePerUnitMarginal: "",
    unitInvestmentCost: "3000000", insuranceRevenueCap: "50000000",
    totalRevenueCap: "70000000", useSpecialExpense: true,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/clinics").then(r => r.json()).then(d => {
      if (Array.isArray(d) && d.length > 0) {
        setClinics(d);
        setSelectedClinicId(d[0].id);
        if (d[0].latestYearMonth) setYearMonth(d[0].latestYearMonth);
      }
    });
  }, []);

  const load = useCallback(async () => {
    if (!selectedClinicId || !yearMonth) return;
    setLoading(true);
    try {
      const [capRes, setRes] = await Promise.all([
        fetch(`/api/capacity?clinicId=${selectedClinicId}&yearMonth=${yearMonth}`),
        fetch(`/api/capacity/settings?clinicId=${selectedClinicId}`),
      ]);
      if (capRes.ok) setData(await capRes.json());
      if (setRes.ok) {
        const s = await setRes.json();
        setRates(Object.fromEntries(Object.entries(s.staffCostRates ?? {})
          .map(([k, v]) => [k, v == null ? "" : String(v)])));
        if (s.expansion) {
          setExpSetting({
            baseUnitCount: String(s.expansion.baseUnitCount ?? 3),
            revenuePerUnitBase: s.expansion.revenuePerUnitBase ? String(s.expansion.revenuePerUnitBase) : "",
            revenuePerUnitMarginal: s.expansion.revenuePerUnitMarginal ? String(s.expansion.revenuePerUnitMarginal) : "",
            unitInvestmentCost: String(s.expansion.unitInvestmentCost ?? 3000000),
            insuranceRevenueCap: String(s.expansion.insuranceRevenueCap ?? 50000000),
            totalRevenueCap: String(s.expansion.totalRevenueCap ?? 70000000),
            useSpecialExpense: s.expansion.useSpecialExpense !== false,
          });
        }
      }
    } catch { setData(null); }
    setLoading(false);
  }, [selectedClinicId, yearMonth]);

  useEffect(() => { load(); }, [load]);

  const saveSettings = async () => {
    setSaving(true); setMessage("");
    try {
      const res = await fetch("/api/capacity/settings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicId: selectedClinicId, staffCostRates: rates, expansion: expSetting }),
      });
      setMessage(res.ok ? "保存しました。試算に反映されます。" : "保存に失敗しました");
      if (res.ok) load();
    } catch { setMessage("保存に失敗しました"); }
    setSaving(false);
  };

  const exp = data?.expansion;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">増員・増設の検討</h1>
          <p className="text-sm text-gray-500 mt-1">
            いま何が足りないのか、増やしたら手元にいくら残るのかを試算します。
          </p>
        </div>
        <div className="flex items-center gap-3">
          {clinics.length > 1 && (
            <select className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
              value={selectedClinicId} onChange={e => setSelectedClinicId(e.target.value)}>
              {clinics.map(c => <option key={c.id} value={c.id}>{c.clinicName}</option>)}
            </select>
          )}
          <input type="month" className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
            value={yearMonth} onChange={e => setYearMonth(e.target.value)} />
        </div>
      </div>

      {loading && !data && (
        <Card><CardContent className="py-12 text-center text-gray-500">試算しています...</CardContent></Card>
      )}

      {data && !data.hasData && (
        <Card><CardContent className="py-12 text-center text-gray-500">
          <p>{data.reason ?? "判定に必要なデータがありません。"}</p>
          <p className="text-sm mt-2">医院設定の人員・設備と、月次の患者数を登録してください。</p>
        </CardContent></Card>
      )}

      {data?.hasData && <CapacityView data={data} />}

      {data?.expansionNote && !exp && (
        <Card><CardContent className="py-8 text-center text-gray-500 text-sm">{data.expansionNote}</CardContent></Card>
      )}

      {/* 前提の設定 */}
      {data?.hasData && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>試算の前提</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setShowSettings(v => !v)}>
                {showSettings ? "閉じる" : "設定を開く"}
              </Button>
            </div>
          </CardHeader>
          {showSettings && (
            <CardContent>
              {message && (
                <div className={`text-sm rounded-md px-3 py-2 mb-4 ${
                  message.includes("失敗") ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                  {message}
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-sm font-bold text-gray-800 mb-1">職種別の人件費（1名あたり月額）</h3>
                <p className="text-xs text-gray-500 mb-3">
                  社会保険料の事業主負担を含めた金額を入力してください。「1名増やすと月いくら増えるか」の試算に使います。
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {ROLE_LABELS.map(([role, label]) => (
                    <div key={role}>
                      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
                      <Input type="number" min={0} placeholder="例: 380000"
                        value={rates[role] ?? ""}
                        onChange={e => setRates({ ...rates, [role]: e.target.value })} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-sm font-bold text-gray-800 mb-1">売上の伸び方</h3>
                <p className="text-xs text-gray-500 mb-3">
                  空欄なら実績から自動で推計します。台数が増えると1台あたりの売上は伸びにくくなります。
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">基準となる台数</label>
                    <Input type="number" min={1} max={20} value={expSetting.baseUnitCount}
                      onChange={e => setExpSetting({ ...expSetting, baseUnitCount: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">基準台数までの1台あたり年商（円）</label>
                    <Input type="number" min={0} placeholder="自動推計" value={expSetting.revenuePerUnitBase}
                      onChange={e => setExpSetting({ ...expSetting, revenuePerUnitBase: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">それ以降の1台あたり年商（円）</label>
                    <Input type="number" min={0} placeholder="自動推計" value={expSetting.revenuePerUnitMarginal}
                      onChange={e => setExpSetting({ ...expSetting, revenuePerUnitMarginal: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">ユニット1台の増設費用（円）</label>
                    <Input type="number" min={0} value={expSetting.unitInvestmentCost}
                      onChange={e => setExpSetting({ ...expSetting, unitInvestmentCost: e.target.value })} />
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <h3 className="text-sm font-bold text-gray-800 mb-1">概算経費の特例（租税特別措置法26条）</h3>
                <p className="text-xs text-gray-500 mb-3">
                  この要件を超えると特例が使えなくなり、税額が大きく増えます。
                  金額や要件は改正されることがあるため、設定で変更できるようにしています。
                  <span className="font-medium">適用の可否は税理士にご確認ください。</span>
                </p>
                <label className="flex items-center gap-2 mb-3">
                  <input type="checkbox" className="rounded" checked={expSetting.useSpecialExpense}
                    onChange={e => setExpSetting({ ...expSetting, useSpecialExpense: e.target.checked })} />
                  <span className="text-sm">特例を試算に含める</span>
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">社会保険診療報酬の上限（円）</label>
                    <Input type="number" min={0} value={expSetting.insuranceRevenueCap}
                      onChange={e => setExpSetting({ ...expSetting, insuranceRevenueCap: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">医業収入合計の上限（円）</label>
                    <Input type="number" min={0} value={expSetting.totalRevenueCap}
                      onChange={e => setExpSetting({ ...expSetting, totalRevenueCap: e.target.value })} />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={saveSettings} disabled={saving}>{saving ? "保存中..." : "保存する"}</Button>
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
