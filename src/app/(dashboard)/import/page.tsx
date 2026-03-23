"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CSV_MAPPING_LABELS, COST_ITEMS } from "@/lib/constants";
import Papa from "papaparse";

type MappingKey = keyof typeof CSV_MAPPING_LABELS;
type TabType = "csv" | "manual";

interface ClinicInfo {
  id: string;
  clinicName: string;
}

export default function ImportPage() {
  const [activeTab, setActiveTab] = useState<TabType>("csv");
  const [clinics, setClinics] = useState<ClinicInfo[]>([]);
  const [selectedClinicId, setSelectedClinicId] = useState("");

  useEffect(() => {
    fetch("/api/clinics")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setClinics(data);
          if (data.length === 1) setSelectedClinicId(data[0].id);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">データ取込</h1>

      {/* 医院選択 */}
      {clinics.length > 1 && (
        <div className="flex items-center gap-3">
          <Label>医院選択</Label>
          <select
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            value={selectedClinicId}
            onChange={(e) => setSelectedClinicId(e.target.value)}
          >
            <option value="">選択してください</option>
            {clinics.map((c) => (
              <option key={c.id} value={c.id}>{c.clinicName}</option>
            ))}
          </select>
        </div>
      )}

      {/* タブ */}
      <div className="flex border-b border-gray-200">
        {([
          { key: "csv" as TabType, label: "CSV取込" },
          { key: "manual" as TabType, label: "手入力" },
        ]).map((tab) => (
          <button
            key={tab.key}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "csv" ? (
        <CsvImportTab clinicId={selectedClinicId} />
      ) : (
        <ManualInputTab clinicId={selectedClinicId} />
      )}
    </div>
  );
}

// ============ CSV取込タブ ============
function CsvImportTab({ clinicId }: { clinicId: string }) {
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [step, setStep] = useState<"upload" | "mapping" | "preview" | "result">("upload");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ importedCount: number; totalRows: number; errors: string[] } | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          setError(`CSV解析エラー: ${results.errors[0].message}`);
          return;
        }
        const headers = results.meta.fields || [];
        setCsvHeaders(headers);
        setCsvData(results.data as Record<string, string>[]);
        const autoMapping: Record<string, string> = {};
        const mappingKeys = Object.keys(CSV_MAPPING_LABELS) as MappingKey[];
        for (const key of mappingKeys) {
          const label = CSV_MAPPING_LABELS[key];
          const matchHeader = headers.find((h) => h === label || h.includes(label) || label.includes(h));
          if (matchHeader) autoMapping[key] = matchHeader;
        }
        setMapping(autoMapping);
        setStep("mapping");
      },
      error: (err) => setError(`CSVファイルの読み込みに失敗しました: ${err.message}`),
    });
  }, []);

  const getMappedData = (): Record<string, string>[] => {
    return csvData.map((row) => {
      const mapped: Record<string, string> = {};
      for (const [key, header] of Object.entries(mapping)) {
        if (header && row[header] !== undefined) mapped[key] = row[header];
      }
      return mapped;
    });
  };

  const handleImport = async () => {
    if (!clinicId) { setError("医院を選択してください"); return; }
    setLoading(true);
    setError("");
    try {
      const mappedData = getMappedData();
      console.log("Import data sample:", mappedData[0]);
      console.log("ClinicId:", clinicId);
      const res = await fetch("/api/import/csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicId, data: mappedData, mapping: JSON.stringify(mapping) }),
      });
      const responseData = await res.json();
      console.log("Import response:", responseData);
      if (!res.ok) {
        throw new Error(responseData.error || `インポートに失敗しました (${res.status})`);
      }
      setResult(responseData);
      setStep("result");
    } catch (err) {
      console.error("Import error:", err);
      setError(err instanceof Error ? err.message : "インポートに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setCsvData([]); setCsvHeaders([]); setMapping({}); setStep("upload"); setResult(null); setError("");
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="space-y-4">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">{error}</div>}

      {step === "upload" && (
        <Card>
          <CardHeader><CardTitle>CSVファイルをアップロード</CardTitle></CardHeader>
          <CardContent>
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <div className="text-gray-500 space-y-2">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-sm">クリックしてCSVファイルを選択</p>
                <p className="text-xs text-gray-400">レセコン・予約管理システムからエクスポートしたCSVに対応</p>
              </div>
            </div>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
          </CardContent>
        </Card>
      )}

      {step === "mapping" && (
        <Card>
          <CardHeader><CardTitle>列マッピング設定</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 mb-4">CSVの列と取込項目を対応付けてください。</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(Object.keys(CSV_MAPPING_LABELS) as MappingKey[]).map((key) => (
                <div key={key} className="flex items-center gap-2">
                  <Label className="w-32 text-sm shrink-0">{CSV_MAPPING_LABELS[key]}</Label>
                  <select className="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm" value={mapping[key] || ""} onChange={(e) => setMapping((p) => ({ ...p, [key]: e.target.value }))}>
                    <option value="">-- 未設定 --</option>
                    {csvHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-6">
              <Button variant="ghost" onClick={reset}>戻る</Button>
              <Button onClick={() => setStep("preview")}>プレビュー</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "preview" && (
        <Card>
          <CardHeader><CardTitle>インポートプレビュー（先頭5行）</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border">
                <thead>
                  <tr className="bg-gray-50">
                    {Object.entries(mapping).filter(([, v]) => v).map(([key]) => (
                      <th key={key} className="px-3 py-2 border text-left font-medium">{CSV_MAPPING_LABELS[key]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {getMappedData().slice(0, 5).map((row, i) => (
                    <tr key={i} className="border-t">
                      {Object.entries(mapping).filter(([, v]) => v).map(([key]) => (
                        <td key={key} className="px-3 py-2 border">{row[key] || "-"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-gray-500 mt-2">全{csvData.length}行のデータをインポートします</p>
            <div className="flex gap-2 mt-4">
              <Button variant="ghost" onClick={() => setStep("mapping")}>マッピング修正</Button>
              <Button onClick={handleImport} disabled={loading}>{loading ? "インポート中..." : "インポート実行"}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "result" && result && (
        <Card>
          <CardHeader><CardTitle>インポート完了</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
                {result.importedCount} / {result.totalRows} 行を正常にインポートしました
              </div>
              {result.errors.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded">
                  <p className="font-medium mb-1">エラー ({result.errors.length}件)</p>
                  <ul className="list-disc list-inside text-sm">
                    {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={reset}>別のファイルを取込</Button>
                <Button variant="secondary" onClick={() => window.location.href = "/dashboard"}>ダッシュボードへ</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============ 手入力タブ ============
function ManualInputTab({ clinicId }: { clinicId: string }) {
  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date();
    now.setMonth(now.getMonth() - 1);
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [section, setSection] = useState<"revenue" | "patients" | "appointments" | "costs">("revenue");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // 売上
  const [revenue, setRevenue] = useState({
    insuranceRevenue: 0, insurancePoints: 0, selfPayRevenue: 0,
    maintenanceRevenue: 0, homeVisitRevenue: 0, retailRevenue: 0,
  });

  // 患者
  const [patients, setPatients] = useState({
    totalPatientCount: 0, uniquePatientCount: 0, newPatientCount: 0,
    returnPatientCount: 0, dropoutCount: 0, maintenanceTransitionCount: 0,
  });

  // 予約
  const [appointments, setAppointments] = useState({
    appointmentCount: 0, cancelCount: 0, noShowCount: 0,
  });

  // コスト
  const [costs, setCosts] = useState<{ costItemCode: string; amount: number; costLayer: string }[]>(
    Object.values(COST_ITEMS).map((item) => ({
      costItemCode: item.code, amount: 0, costLayer: item.isIndirect ? "INDIRECT" : "DIRECT",
    }))
  );

  // 既存データの読み込み
  useEffect(() => {
    if (!clinicId || !yearMonth) return;
    loadExistingData();
  }, [clinicId, yearMonth]);

  const loadExistingData = async () => {
    try {
      const res = await fetch(`/api/monthly?clinicId=${clinicId}&yearMonth=${yearMonth}`);
      if (res.ok) {
        const data = await res.json();
        if (data.revenue) {
          setRevenue((prev) => ({
            ...prev,
            insuranceRevenue: data.revenue.find((r: any) => r.departmentType === "INSURANCE")?.amount || 0,
            selfPayRevenue: data.revenue.find((r: any) => r.departmentType === "SELF_PAY")?.amount || 0,
            maintenanceRevenue: data.revenue.find((r: any) => r.departmentType === "MAINTENANCE")?.amount || 0,
            homeVisitRevenue: data.revenue.find((r: any) => r.departmentType === "HOME_VISIT")?.amount || 0,
            retailRevenue: data.revenue.find((r: any) => r.departmentType === "RETAIL")?.amount || 0,
            insurancePoints: data.revenue.find((r: any) => r.departmentType === "INSURANCE")?.points || 0,
          }));
        }
        if (data.patients?.[0]) {
          const p = data.patients[0];
          setPatients({
            totalPatientCount: p.totalPatientCount || 0,
            uniquePatientCount: p.uniquePatientCount || 0,
            newPatientCount: p.newPatientCount || 0,
            returnPatientCount: p.returnPatientCount || 0,
            dropoutCount: p.dropoutCount || 0,
            maintenanceTransitionCount: p.maintenanceTransitionCount || 0,
          });
        }
        if (data.appointments?.[0]) {
          const a = data.appointments[0];
          setAppointments({
            appointmentCount: a.appointmentCount || 0,
            cancelCount: a.cancelCount || 0,
            noShowCount: a.noShowCount || 0,
          });
        }
        if (data.costs && data.costs.length > 0) {
          setCosts((prev) => prev.map((c) => {
            const found = data.costs.find((dc: any) => dc.costItemCode === c.costItemCode);
            return found ? { ...c, amount: found.amount, costLayer: found.costLayer || c.costLayer } : c;
          }));
        }
      }
    } catch {
      // 新規入力
    }
  };

  const handleSave = async () => {
    if (!clinicId) { setMessage("医院を選択してください"); return; }
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/monthly/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinicId, yearMonth, revenue, patients, appointments,
          costs: costs.filter((c) => c.amount > 0),
        }),
      });
      if (res.ok) {
        setMessage("保存しました");
      } else {
        const data = await res.json();
        setMessage(data.error || "保存に失敗しました");
      }
    } catch {
      setMessage("保存に失敗しました");
    }
    setSaving(false);
  };

  const sections = [
    { key: "revenue" as const, label: "売上" },
    { key: "patients" as const, label: "患者" },
    { key: "appointments" as const, label: "予約" },
    { key: "costs" as const, label: "コスト" },
  ];

  const totalRevenue = revenue.insuranceRevenue + revenue.selfPayRevenue + revenue.maintenanceRevenue + revenue.homeVisitRevenue + revenue.retailRevenue;

  return (
    <div className="space-y-4">
      {message && (
        <div className={`px-4 py-3 rounded text-sm ${message.includes("失敗") || message.includes("選択") ? "bg-red-50 text-red-700 border border-red-200" : "bg-green-50 text-green-700 border border-green-200"}`}>
          {message}
        </div>
      )}

      {/* 年月選択 */}
      <div className="flex items-center gap-3">
        <Label>対象年月</Label>
        <input type="month" className="border border-gray-300 rounded-md px-3 py-1.5 text-sm" value={yearMonth} onChange={(e) => setYearMonth(e.target.value)} />
      </div>

      {/* セクション切り替え */}
      <div className="flex gap-2">
        {sections.map((s) => (
          <button
            key={s.key}
            className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
              section === s.key ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
            onClick={() => setSection(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* 売上入力 */}
      {section === "revenue" && (
        <Card>
          <CardHeader><CardTitle>売上データ入力</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>保険売上（円）</Label>
                <Input type="number" value={revenue.insuranceRevenue || ""} onChange={(e) => setRevenue((p) => ({ ...p, insuranceRevenue: Number(e.target.value) || 0 }))} placeholder="0" />
              </div>
              <div>
                <Label>保険点数</Label>
                <Input type="number" value={revenue.insurancePoints || ""} onChange={(e) => setRevenue((p) => ({ ...p, insurancePoints: Number(e.target.value) || 0 }))} placeholder="0" />
              </div>
              <div>
                <Label>自費売上（円）</Label>
                <Input type="number" value={revenue.selfPayRevenue || ""} onChange={(e) => setRevenue((p) => ({ ...p, selfPayRevenue: Number(e.target.value) || 0 }))} placeholder="0" />
              </div>
              <div>
                <Label>メンテナンス売上（円）</Label>
                <Input type="number" value={revenue.maintenanceRevenue || ""} onChange={(e) => setRevenue((p) => ({ ...p, maintenanceRevenue: Number(e.target.value) || 0 }))} placeholder="0" />
              </div>
              <div>
                <Label>訪問売上（円）</Label>
                <Input type="number" value={revenue.homeVisitRevenue || ""} onChange={(e) => setRevenue((p) => ({ ...p, homeVisitRevenue: Number(e.target.value) || 0 }))} placeholder="0" />
              </div>
              <div>
                <Label>物販売上（円）</Label>
                <Input type="number" value={revenue.retailRevenue || ""} onChange={(e) => setRevenue((p) => ({ ...p, retailRevenue: Number(e.target.value) || 0 }))} placeholder="0" />
              </div>
            </div>
            <div className="mt-4 p-3 bg-blue-50 rounded text-sm">
              <span className="font-medium">合計売上: </span>
              <span className="text-blue-700 font-bold">{totalRevenue.toLocaleString()}円</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 患者入力 */}
      {section === "patients" && (
        <Card>
          <CardHeader><CardTitle>患者データ入力</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>延患者数</Label>
                <Input type="number" value={patients.totalPatientCount || ""} onChange={(e) => setPatients((p) => ({ ...p, totalPatientCount: Number(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label>実患者数</Label>
                <Input type="number" value={patients.uniquePatientCount || ""} onChange={(e) => setPatients((p) => ({ ...p, uniquePatientCount: Number(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label>新患数</Label>
                <Input type="number" value={patients.newPatientCount || ""} onChange={(e) => setPatients((p) => ({ ...p, newPatientCount: Number(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label>再来患者数</Label>
                <Input type="number" value={patients.returnPatientCount || ""} onChange={(e) => setPatients((p) => ({ ...p, returnPatientCount: Number(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label>中断患者数</Label>
                <Input type="number" value={patients.dropoutCount || ""} onChange={(e) => setPatients((p) => ({ ...p, dropoutCount: Number(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label>メンテ移行数</Label>
                <Input type="number" value={patients.maintenanceTransitionCount || ""} onChange={(e) => setPatients((p) => ({ ...p, maintenanceTransitionCount: Number(e.target.value) || 0 }))} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 予約入力 */}
      {section === "appointments" && (
        <Card>
          <CardHeader><CardTitle>予約データ入力</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>予約数</Label>
                <Input type="number" value={appointments.appointmentCount || ""} onChange={(e) => setAppointments((p) => ({ ...p, appointmentCount: Number(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label>キャンセル数</Label>
                <Input type="number" value={appointments.cancelCount || ""} onChange={(e) => setAppointments((p) => ({ ...p, cancelCount: Number(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label>無断キャンセル数</Label>
                <Input type="number" value={appointments.noShowCount || ""} onChange={(e) => setAppointments((p) => ({ ...p, noShowCount: Number(e.target.value) || 0 }))} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* コスト入力 */}
      {section === "costs" && (
        <Card>
          <CardHeader><CardTitle>コストデータ入力</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {costs.map((cost, index) => {
                const item = Object.values(COST_ITEMS).find((i) => i.code === cost.costItemCode);
                return (
                  <div key={cost.costItemCode}>
                    <Label>{item?.name || cost.costItemCode}（円）</Label>
                    <Input
                      type="number"
                      value={cost.amount || ""}
                      onChange={(e) => setCosts((prev) => prev.map((c, i) => i === index ? { ...c, amount: Number(e.target.value) || 0 } : c))}
                      placeholder="0"
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-4 p-3 bg-orange-50 rounded text-sm">
              <span className="font-medium">コスト合計: </span>
              <span className="text-orange-700 font-bold">{costs.reduce((s, c) => s + c.amount, 0).toLocaleString()}円</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 保存ボタン */}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => window.location.href = "/dashboard"}>ダッシュボードへ</Button>
        <Button onClick={handleSave} disabled={saving}>{saving ? "保存中..." : "月次データを保存"}</Button>
      </div>
    </div>
  );
}
