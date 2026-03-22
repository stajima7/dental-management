"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BENCHMARKS, CLINIC_TYPES } from "@/lib/constants";

type TabType = "basic" | "equipment" | "staff" | "operation" | "targets";

interface ClinicData {
  id: string;
  clinicName: string;
  corporateName: string | null;
  prefecture: string | null;
  city: string | null;
  address: string | null;
  openingYear: number | null;
  corporateType: string;
  clinicType: string;
  isHomeVisit: boolean;
}

interface ProfileData {
  unitCount: number;
  activeUnitCount: number;
  hasCt: boolean;
  hasMicroscope: boolean;
  hasCadcam: boolean;
  hasOperationRoom: boolean;
  fulltimeDentistCount: number;
  parttimeDentistCount: number;
  fulltimeHygienistCount: number;
  parttimeHygienistCount: number;
  fulltimeAssistantCount: number;
  parttimeAssistantCount: number;
  fulltimeReceptionCount: number;
  parttimeReceptionCount: number;
  fulltimeTechnicianCount: number;
  parttimeTechnicianCount: number;
  hasOfficeManager: boolean;
  clinicDaysPerMonth: number;
  avgHoursPerDay: number;
  avgOvertimeHours: number;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("basic");
  const [clinicId, setClinicId] = useState("");
  const [clinic, setClinic] = useState<ClinicData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [targets, setTargets] = useState({
    monthlyRevenue: "", selfPayRatio: String(BENCHMARKS.selfPayRatio),
    newPatients: String(BENCHMARKS.newPatientsMin), returnRate: String(BENCHMARKS.returnRate),
    laborCostRatio: String(BENCHMARKS.laborCostRatio),
    maintenanceTransitionRate: String(BENCHMARKS.maintenanceTransitionRate),
    operatingProfitRate: String(BENCHMARKS.operatingProfitRate),
    revenuePerUnit: String(BENCHMARKS.revenuePerUnit),
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/clinics")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setClinicId(data[0].id);
          loadClinicData(data[0].id);
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, []);

  const loadClinicData = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/clinics/${id}`);
      if (res.ok) {
        const data = await res.json();
        setClinic({
          id: data.id, clinicName: data.clinicName, corporateName: data.corporateName,
          prefecture: data.prefecture, city: data.city, address: data.address,
          openingYear: data.openingYear, corporateType: data.corporateType,
          clinicType: data.clinicType, isHomeVisit: data.isHomeVisit,
        });

        if (data.profile) {
          setProfile({
            unitCount: data.profile.unitCount || 0,
            activeUnitCount: data.profile.activeUnitCount || 0,
            hasCt: data.profile.hasCt || false,
            hasMicroscope: data.profile.hasMicroscope || false,
            hasCadcam: data.profile.hasCadcam || false,
            hasOperationRoom: data.profile.hasOperationRoom || false,
            fulltimeDentistCount: data.profile.fulltimeDentistCount || 0,
            parttimeDentistCount: data.profile.parttimeDentistCount || 0,
            fulltimeHygienistCount: data.profile.fulltimeHygienistCount || 0,
            parttimeHygienistCount: data.profile.parttimeHygienistCount || 0,
            fulltimeAssistantCount: data.profile.fulltimeAssistantCount || 0,
            parttimeAssistantCount: data.profile.parttimeAssistantCount || 0,
            fulltimeReceptionCount: data.profile.fulltimeReceptionCount || 0,
            parttimeReceptionCount: data.profile.parttimeReceptionCount || 0,
            fulltimeTechnicianCount: data.profile.fulltimeTechnicianCount || 0,
            parttimeTechnicianCount: data.profile.parttimeTechnicianCount || 0,
            hasOfficeManager: data.profile.hasOfficeManager || false,
            clinicDaysPerMonth: data.profile.clinicDaysPerMonth || 22,
            avgHoursPerDay: data.profile.avgHoursPerDay || 8,
            avgOvertimeHours: data.profile.avgOvertimeHours || 0,
          });
        }

        if (data.target) {
          setTargets({
            monthlyRevenue: data.target.monthlyRevenue ? String(data.target.monthlyRevenue) : "",
            selfPayRatio: data.target.selfPayRatio ? String(data.target.selfPayRatio) : String(BENCHMARKS.selfPayRatio),
            newPatients: data.target.newPatients ? String(data.target.newPatients) : String(BENCHMARKS.newPatientsMin),
            returnRate: data.target.returnRate ? String(data.target.returnRate) : String(BENCHMARKS.returnRate),
            laborCostRatio: data.target.laborCostRatio ? String(data.target.laborCostRatio) : String(BENCHMARKS.laborCostRatio),
            maintenanceTransitionRate: data.target.maintenanceTransitionRate ? String(data.target.maintenanceTransitionRate) : String(BENCHMARKS.maintenanceTransitionRate),
            operatingProfitRate: data.target.operatingProfitRate ? String(data.target.operatingProfitRate) : String(BENCHMARKS.operatingProfitRate),
            revenuePerUnit: data.target.revenuePerUnit ? String(data.target.revenuePerUnit) : String(BENCHMARKS.revenuePerUnit),
          });
        }
      }
    } catch {
      // ignore
    }
    setLoading(false);
  };

  const saveBasicInfo = async () => {
    if (!clinic) return;
    setSaving(true); setMessage("");
    try {
      const res = await fetch(`/api/clinics/${clinicId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clinic),
      });
      setMessage(res.ok ? "医院情報を保存しました" : "保存に失敗しました");
    } catch { setMessage("保存に失敗しました"); }
    setSaving(false);
  };

  const saveProfile = async () => {
    if (!profile) return;
    setSaving(true); setMessage("");
    try {
      const res = await fetch(`/api/clinics/${clinicId}/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      setMessage(res.ok ? "プロファイルを保存しました" : "保存に失敗しました");
    } catch { setMessage("保存に失敗しました"); }
    setSaving(false);
  };

  const saveTargets = async () => {
    setSaving(true); setMessage("");
    try {
      const res = await fetch(`/api/clinics/${clinicId}/targets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthlyRevenue: targets.monthlyRevenue ? Number(targets.monthlyRevenue) : null,
          selfPayRatio: Number(targets.selfPayRatio) || null,
          newPatients: Number(targets.newPatients) || null,
          returnRate: Number(targets.returnRate) || null,
          laborCostRatio: Number(targets.laborCostRatio) || null,
          maintenanceTransitionRate: Number(targets.maintenanceTransitionRate) || null,
          operatingProfitRate: Number(targets.operatingProfitRate) || null,
          revenuePerUnit: Number(targets.revenuePerUnit) || null,
        }),
      });
      setMessage(res.ok ? "目標値を保存しました" : "保存に失敗しました");
    } catch { setMessage("保存に失敗しました"); }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">設定</h1>
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-gray-200 rounded w-1/3" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (!clinic) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">設定</h1>
        <Card><CardContent className="py-12 text-center text-gray-500">
          <p className="text-lg font-medium">医院が登録されていません</p>
          <Button className="mt-4" onClick={() => window.location.href = "/setup"}>初期設定へ</Button>
        </CardContent></Card>
      </div>
    );
  }

  const tabs: { key: TabType; label: string }[] = [
    { key: "basic", label: "医院情報" },
    { key: "equipment", label: "設備・規模" },
    { key: "staff", label: "人員構成" },
    { key: "operation", label: "稼働条件" },
    { key: "targets", label: "目標値" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">設定</h1>

      {message && (
        <div className={`px-4 py-3 rounded text-sm ${message.includes("失敗") ? "bg-red-50 text-red-700 border border-red-200" : "bg-green-50 text-green-700 border border-green-200"}`}>
          {message}
        </div>
      )}

      {/* タブ */}
      <div className="flex border-b border-gray-200 overflow-x-auto">
        {tabs.map((tab) => (
          <button key={tab.key} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.key ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`} onClick={() => setActiveTab(tab.key)}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* 医院基本情報 */}
      {activeTab === "basic" && (
        <Card>
          <CardHeader><CardTitle>医院基本情報</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label>医院名 *</Label><Input value={clinic.clinicName} onChange={(e) => setClinic({ ...clinic, clinicName: e.target.value })} /></div>
              <div><Label>法人名</Label><Input value={clinic.corporateName || ""} onChange={(e) => setClinic({ ...clinic, corporateName: e.target.value })} /></div>
              <div><Label>都道府県</Label><Input value={clinic.prefecture || ""} onChange={(e) => setClinic({ ...clinic, prefecture: e.target.value })} /></div>
              <div><Label>市区町村</Label><Input value={clinic.city || ""} onChange={(e) => setClinic({ ...clinic, city: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>住所</Label><Input value={clinic.address || ""} onChange={(e) => setClinic({ ...clinic, address: e.target.value })} /></div>
              <div><Label>開業年</Label><Input type="number" value={clinic.openingYear || ""} onChange={(e) => setClinic({ ...clinic, openingYear: Number(e.target.value) || null })} /></div>
              <div>
                <Label>法人形態</Label>
                <select className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" value={clinic.corporateType} onChange={(e) => setClinic({ ...clinic, corporateType: e.target.value })}>
                  <option value="INDIVIDUAL">個人</option>
                  <option value="CORPORATION">医療法人</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <Label>訪問診療</Label>
                <label className="flex items-center gap-2 mt-1">
                  <input type="checkbox" checked={clinic.isHomeVisit} onChange={(e) => setClinic({ ...clinic, isHomeVisit: e.target.checked })} className="rounded" />
                  <span className="text-sm">訪問診療を行っている</span>
                </label>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={saveBasicInfo} disabled={saving}>{saving ? "保存中..." : "保存"}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 設備・規模 */}
      {activeTab === "equipment" && profile && (
        <Card>
          <CardHeader><CardTitle>設備・規模設定</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label>ユニット数</Label><Input type="number" value={profile.unitCount || ""} onChange={(e) => setProfile({ ...profile, unitCount: Number(e.target.value) || 0 })} /></div>
              <div><Label>稼働ユニット数</Label><Input type="number" value={profile.activeUnitCount || ""} onChange={(e) => setProfile({ ...profile, activeUnitCount: Number(e.target.value) || 0 })} /></div>
            </div>
            <div className="mt-4 space-y-2">
              <Label>設備</Label>
              {[
                { key: "hasCt" as const, label: "CT" },
                { key: "hasMicroscope" as const, label: "マイクロスコープ" },
                { key: "hasCadcam" as const, label: "CAD/CAM" },
                { key: "hasOperationRoom" as const, label: "オペ室" },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2">
                  <input type="checkbox" checked={profile[key]} onChange={(e) => setProfile({ ...profile, [key]: e.target.checked })} className="rounded" />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={saveProfile} disabled={saving}>{saving ? "保存中..." : "保存"}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 人員構成 */}
      {activeTab === "staff" && profile && (
        <Card>
          <CardHeader><CardTitle>人員構成設定</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="px-4 py-2 text-left font-medium">職種</th>
                    <th className="px-4 py-2 text-center font-medium">常勤</th>
                    <th className="px-4 py-2 text-center font-medium">非常勤</th>
                    <th className="px-4 py-2 text-center font-medium">FTE</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: "歯科医師（Dr）", ft: "fulltimeDentistCount" as const, pt: "parttimeDentistCount" as const },
                    { label: "歯科衛生士（DH）", ft: "fulltimeHygienistCount" as const, pt: "parttimeHygienistCount" as const },
                    { label: "歯科助手", ft: "fulltimeAssistantCount" as const, pt: "parttimeAssistantCount" as const },
                    { label: "受付", ft: "fulltimeReceptionCount" as const, pt: "parttimeReceptionCount" as const },
                    { label: "歯科技工士", ft: "fulltimeTechnicianCount" as const, pt: "parttimeTechnicianCount" as const },
                  ].map(({ label, ft, pt }) => (
                    <tr key={ft} className="border-b">
                      <td className="px-4 py-2 font-medium">{label}</td>
                      <td className="px-4 py-2 text-center">
                        <Input type="number" className="w-20 mx-auto text-center" value={profile[ft] || ""} onChange={(e) => setProfile({ ...profile, [ft]: Number(e.target.value) || 0 })} />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <Input type="number" className="w-20 mx-auto text-center" value={profile[pt] || ""} onChange={(e) => setProfile({ ...profile, [pt]: Number(e.target.value) || 0 })} />
                      </td>
                      <td className="px-4 py-2 text-center text-gray-600">
                        {(profile[ft] + profile[pt] * 0.5).toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={profile.hasOfficeManager} onChange={(e) => setProfile({ ...profile, hasOfficeManager: e.target.checked })} className="rounded" />
                <span className="text-sm">事務長がいる</span>
              </label>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={saveProfile} disabled={saving}>{saving ? "保存中..." : "保存"}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 稼働条件 */}
      {activeTab === "operation" && profile && (
        <Card>
          <CardHeader><CardTitle>稼働条件設定</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><Label>月間診療日数</Label><Input type="number" value={profile.clinicDaysPerMonth} onChange={(e) => setProfile({ ...profile, clinicDaysPerMonth: Number(e.target.value) || 22 })} /></div>
              <div><Label>1日平均診療時間</Label><Input type="number" step="0.5" value={profile.avgHoursPerDay} onChange={(e) => setProfile({ ...profile, avgHoursPerDay: Number(e.target.value) || 8 })} /></div>
              <div><Label>月間残業時間（平均）</Label><Input type="number" step="0.5" value={profile.avgOvertimeHours} onChange={(e) => setProfile({ ...profile, avgOvertimeHours: Number(e.target.value) || 0 })} /></div>
            </div>
            <div className="mt-4 p-3 bg-blue-50 rounded text-sm">
              <span className="font-medium">月間総診療時間: </span>
              <span className="text-blue-700 font-bold">{(profile.clinicDaysPerMonth * profile.avgHoursPerDay).toFixed(0)}時間</span>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={saveProfile} disabled={saving}>{saving ? "保存中..." : "保存"}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 目標値設定 */}
      {activeTab === "targets" && (
        <Card>
          <CardHeader><CardTitle>目標値設定</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 mb-4">各KPIの目標値を設定します。ダッシュボードで達成率が表示されます。</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label>月間目標売上（円）</Label><Input type="number" value={targets.monthlyRevenue} onChange={(e) => setTargets((t) => ({ ...t, monthlyRevenue: e.target.value }))} placeholder="例: 8000000" /></div>
              <div><Label>自費率目標（%）</Label><Input type="number" value={targets.selfPayRatio} onChange={(e) => setTargets((t) => ({ ...t, selfPayRatio: e.target.value }))} /></div>
              <div><Label>月間新患目標（人）</Label><Input type="number" value={targets.newPatients} onChange={(e) => setTargets((t) => ({ ...t, newPatients: e.target.value }))} /></div>
              <div><Label>再来率目標（%）</Label><Input type="number" value={targets.returnRate} onChange={(e) => setTargets((t) => ({ ...t, returnRate: e.target.value }))} /></div>
              <div><Label>人件費率目標（%）</Label><Input type="number" value={targets.laborCostRatio} onChange={(e) => setTargets((t) => ({ ...t, laborCostRatio: e.target.value }))} /></div>
              <div><Label>メンテ移行率目標（%）</Label><Input type="number" value={targets.maintenanceTransitionRate} onChange={(e) => setTargets((t) => ({ ...t, maintenanceTransitionRate: e.target.value }))} /></div>
              <div><Label>営業利益率目標（%）</Label><Input type="number" value={targets.operatingProfitRate} onChange={(e) => setTargets((t) => ({ ...t, operatingProfitRate: e.target.value }))} /></div>
              <div><Label>ユニット当たり売上目標（円）</Label><Input type="number" value={targets.revenuePerUnit} onChange={(e) => setTargets((t) => ({ ...t, revenuePerUnit: e.target.value }))} /></div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={saveTargets} disabled={saving}>{saving ? "保存中..." : "目標値を保存"}</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
