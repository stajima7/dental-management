"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CLINIC_TYPES } from "@/lib/constants";

const STEPS = ["医院情報", "設備・規模", "人員構成", "稼働条件", "確認"];

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 0: 医院情報
  const [clinicName, setClinicName] = useState("");
  const [corporateName, setCorporateName] = useState("");
  const [prefecture, setPrefecture] = useState("");
  const [city, setCity] = useState("");
  const [openingYear, setOpeningYear] = useState<number | "">("");
  const [corporateType, setCorporateType] = useState<"INDIVIDUAL" | "CORPORATION">("INDIVIDUAL");
  const [clinicType, setClinicType] = useState<string[]>([]);
  const [isHomeVisit, setIsHomeVisit] = useState(false);

  // Step 1: 設備
  const [unitCount, setUnitCount] = useState<number | "">(0);
  const [activeUnitCount, setActiveUnitCount] = useState<number | "">(0);
  const [hasCt, setHasCt] = useState(false);
  const [hasMicroscope, setHasMicroscope] = useState(false);
  const [hasCadcam, setHasCadcam] = useState(false);
  const [hasOperationRoom, setHasOperationRoom] = useState(false);

  // Step 2: 人員
  const [ftDentist, setFtDentist] = useState<number | "">(0);
  const [ptDentist, setPtDentist] = useState<number | "">(0);
  const [ftHygienist, setFtHygienist] = useState<number | "">(0);
  const [ptHygienist, setPtHygienist] = useState<number | "">(0);
  const [ftAssistant, setFtAssistant] = useState<number | "">(0);
  const [ptAssistant, setPtAssistant] = useState<number | "">(0);
  const [ftReception, setFtReception] = useState<number | "">(0);
  const [ptReception, setPtReception] = useState<number | "">(0);
  const [ftTechnician, setFtTechnician] = useState<number | "">(0);
  const [ptTechnician, setPtTechnician] = useState<number | "">(0);
  const [hasOfficeManager, setHasOfficeManager] = useState(false);

  // Step 3: 稼働
  const [clinicDaysPerMonth, setClinicDaysPerMonth] = useState<number | "">(22);
  const [avgHoursPerDay, setAvgHoursPerDay] = useState<number | "">(8);
  const [workHours, setWorkHours] = useState("9:00-18:00");
  const [avgOvertimeHours, setAvgOvertimeHours] = useState<number | "">(0);

  const toggleClinicType = (type: string) => {
    setClinicType(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  };

  const numInput = (value: number | "", onChange: (v: number | "") => void, placeholder?: string) => (
    <Input
      type="number"
      value={value}
      onChange={e => onChange(e.target.value === "" ? "" : Number(e.target.value))}
      placeholder={placeholder}
    />
  );

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      // Create clinic
      const clinicRes = await fetch("/api/clinics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinicName,
          corporateName,
          prefecture,
          city,
          openingYear: openingYear || null,
          corporateType,
          clinicType: JSON.stringify(clinicType),
          isHomeVisit,
        }),
      });

      if (!clinicRes.ok) throw new Error("医院の登録に失敗しました");
      const clinic = await clinicRes.json();

      // Create profile
      await fetch(`/api/clinics/${clinic.id}/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unitCount: unitCount || 0,
          activeUnitCount: activeUnitCount || unitCount || 0,
          fulltimeDentistCount: ftDentist || 0,
          parttimeDentistCount: ptDentist || 0,
          fulltimeHygienistCount: ftHygienist || 0,
          parttimeHygienistCount: ptHygienist || 0,
          fulltimeAssistantCount: ftAssistant || 0,
          parttimeAssistantCount: ptAssistant || 0,
          fulltimeReceptionCount: ftReception || 0,
          parttimeReceptionCount: ptReception || 0,
          fulltimeTechnicianCount: ftTechnician || 0,
          parttimeTechnicianCount: ptTechnician || 0,
          hasOfficeManager,
          hasCt,
          hasMicroscope,
          hasCadcam,
          hasOperationRoom,
          clinicDaysPerMonth: clinicDaysPerMonth || 22,
          avgHoursPerDay: avgHoursPerDay || 8,
          avgOvertimeHours: avgOvertimeHours || 0,
          workHours,
        }),
      });

      // Mark setup complete
      await fetch(`/api/clinics/${clinic.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSetupComplete: true }),
      });

      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (step === 0 && !clinicName) {
      setError("医院名を入力してください");
      return;
    }
    if (step === 1 && !unitCount) {
      setError("ユニット台数を入力してください");
      return;
    }
    setError("");
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8">
      {/* Progress */}
      <div className="flex items-center justify-center mb-8 gap-1">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center">
            {i > 0 && <div className={`w-8 h-0.5 ${i <= step ? "bg-blue-500" : "bg-gray-200"}`} />}
            <div className="flex items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                i === step ? "bg-blue-600 text-white" : i < step ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500"
              }`}>
                {i < step ? "✓" : i + 1}
              </div>
              <span className={`text-xs hidden sm:inline ${i === step ? "text-blue-600 font-semibold" : "text-gray-400"}`}>{label}</span>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">{error}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{STEPS[step]}</CardTitle>
        </CardHeader>
        <CardContent>
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <Label>医院名 *</Label>
                <Input value={clinicName} onChange={e => setClinicName(e.target.value)} placeholder="○○歯科クリニック" className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>法人名</Label>
                  <Input value={corporateName} onChange={e => setCorporateName(e.target.value)} placeholder="医療法人○○会" className="mt-1" />
                </div>
                <div>
                  <Label>法人形態</Label>
                  <select className="mt-1 flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                    value={corporateType} onChange={e => setCorporateType(e.target.value as "INDIVIDUAL" | "CORPORATION")}>
                    <option value="INDIVIDUAL">個人</option>
                    <option value="CORPORATION">医療法人</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>都道府県</Label><Input value={prefecture} onChange={e => setPrefecture(e.target.value)} placeholder="東京都" className="mt-1" /></div>
                <div><Label>市区町村</Label><Input value={city} onChange={e => setCity(e.target.value)} placeholder="渋谷区" className="mt-1" /></div>
              </div>
              <div><Label>開業年</Label>{numInput(openingYear, setOpeningYear, "2010")}</div>
              <div>
                <Label>医院タイプ（複数選択可）</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {Object.entries(CLINIC_TYPES).map(([key, label]) => (
                    <button key={key} type="button"
                      className={`px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                        clinicType.includes(key) ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                      }`}
                      onClick={() => toggleClinicType(key)}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isHomeVisit} onChange={e => setIsHomeVisit(e.target.checked)} className="w-4 h-4 accent-blue-600" />
                <span className="text-sm">訪問診療あり</span>
              </label>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>ユニット台数 *</Label>{numInput(unitCount, setUnitCount, "5")}</div>
                <div><Label>稼働ユニット数</Label>{numInput(activeUnitCount, setActiveUnitCount, "5")}</div>
              </div>
              <div>
                <Label>設備</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {[
                    [hasOperationRoom, setHasOperationRoom, "オペ室"],
                    [hasCt, setHasCt, "CT"],
                    [hasMicroscope, setHasMicroscope, "マイクロスコープ"],
                    [hasCadcam, setHasCadcam, "セレック/CAD/CAM"],
                  ].map(([checked, setter, label]) => (
                    <label key={label as string} className="flex items-center gap-2 cursor-pointer py-1">
                      <input type="checkbox" checked={checked as boolean} onChange={e => (setter as (v: boolean) => void)(e.target.checked)} className="w-4 h-4 accent-blue-600" />
                      <span className="text-sm">{label as string}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500 mb-4">各職種の常勤・非常勤人数を入力してください</p>
              {[
                ["歯科医師", ftDentist, setFtDentist, ptDentist, setPtDentist],
                ["歯科衛生士", ftHygienist, setFtHygienist, ptHygienist, setPtHygienist],
                ["歯科助手", ftAssistant, setFtAssistant, ptAssistant, setPtAssistant],
                ["受付", ftReception, setFtReception, ptReception, setPtReception],
                ["技工士", ftTechnician, setFtTechnician, ptTechnician, setPtTechnician],
              ].map(([label, ftVal, ftSet, ptVal, ptSet]) => (
                <div key={label as string} className="grid grid-cols-[120px_1fr_1fr] gap-3 items-center py-2 border-b border-gray-100">
                  <span className="text-sm font-medium">{label as string}</span>
                  <div className="flex items-center gap-2">
                    {numInput(ftVal as number | "", ftSet as (v: number | "") => void)}
                    <span className="text-xs text-gray-400">常勤</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {numInput(ptVal as number | "", ptSet as (v: number | "") => void)}
                    <span className="text-xs text-gray-400">非常勤</span>
                  </div>
                </div>
              ))}
              <label className="flex items-center gap-2 cursor-pointer mt-4">
                <input type="checkbox" checked={hasOfficeManager} onChange={e => setHasOfficeManager(e.target.checked)} className="w-4 h-4 accent-blue-600" />
                <span className="text-sm">事務長あり</span>
              </label>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>月間診療日数</Label>{numInput(clinicDaysPerMonth, setClinicDaysPerMonth, "22")}</div>
                <div><Label>1日平均診療時間</Label>{numInput(avgHoursPerDay, setAvgHoursPerDay, "8")}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>診療時間</Label><Input value={workHours} onChange={e => setWorkHours(e.target.value)} placeholder="9:00-18:00" className="mt-1" /></div>
                <div><Label>平均残業時間（月）</Label>{numInput(avgOvertimeHours, setAvgOvertimeHours, "0")}</div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-sm font-semibold text-blue-600 mb-2">医院情報</h4>
                <div className="text-sm space-y-1">
                  <div><strong>医院名:</strong> {clinicName || "-"}</div>
                  <div><strong>所在地:</strong> {prefecture} {city}</div>
                  <div><strong>法人形態:</strong> {corporateType === "CORPORATION" ? "医療法人" : "個人"}</div>
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-sm font-semibold text-blue-600 mb-2">設備</h4>
                <div className="text-sm space-y-1">
                  <div><strong>ユニット:</strong> {unitCount}台（稼働 {activeUnitCount || unitCount}台）</div>
                  <div><strong>設備:</strong> {[hasCt && "CT", hasMicroscope && "マイクロ", hasCadcam && "CAD/CAM", hasOperationRoom && "オペ室"].filter(Boolean).join("、") || "なし"}</div>
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-sm font-semibold text-blue-600 mb-2">人員構成</h4>
                <div className="text-sm space-y-1">
                  <div><strong>歯科医師:</strong> 常勤{ftDentist || 0}名 / 非常勤{ptDentist || 0}名</div>
                  <div><strong>歯科衛生士:</strong> 常勤{ftHygienist || 0}名 / 非常勤{ptHygienist || 0}名</div>
                  <div><strong>歯科助手:</strong> 常勤{ftAssistant || 0}名 / 非常勤{ptAssistant || 0}名</div>
                  <div><strong>受付:</strong> 常勤{ftReception || 0}名 / 非常勤{ptReception || 0}名</div>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between mt-8">
            {step > 0 && <Button variant="secondary" onClick={() => setStep(step - 1)}>戻る</Button>}
            <div className="ml-auto">
              <Button onClick={handleNext} disabled={loading}>
                {step === STEPS.length - 1 ? (loading ? "登録中..." : "設定を完了してダッシュボードへ") : "次へ"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
