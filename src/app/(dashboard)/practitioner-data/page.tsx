"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RosterEditor, type NewPractitioner, type RosterPatch, type RosterPractitioner } from "@/components/practitioner/roster-editor";
import { StatsGrid, EMPTY_VALUES, MAX_MONTH_HOURS, toNumber, type GridField, type GridValues } from "@/components/practitioner/stats-grid";
import { applyCsvRows, buildCsvTemplate, CSV_FIELD_LABELS, decodeCsvBuffer, readPractitionerCsv, type CsvValueField } from "@/lib/practitioner-csv";

/**
 * 担当者データ登録
 *
 * ① 歯科医師・歯科衛生士の名簿を作る
 * ② 月ごとに、担当者別の売上・勤務時間・担当患者数を入力する（CSV取込も可）
 */

interface StatsRecord {
  practitionerId: string;
  insuranceRevenue: number;
  selfPayRevenue: number;
  workHours: number;
  patientCount: number;
}

const str = (n: number) => (n > 0 ? String(n) : "");

export default function PractitionerDataPage() {
  const [clinicId, setClinicId] = useState("");
  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date(); now.setMonth(now.getMonth() - 1);
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const [roster, setRoster] = useState<RosterPractitioner[]>([]);
  const [values, setValues] = useState<Record<string, GridValues>>({});
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [clinicRevenue, setClinicRevenue] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [csvReport, setCsvReport] = useState<{ applied: number; fields: CsvValueField[]; unmatched: string[]; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/clinics").then((r) => r.json()).then((d) => {
      if (Array.isArray(d) && d.length > 0) {
        setClinicId(d[0].id);
        if (d[0].latestYearMonth) setYearMonth(d[0].latestYearMonth);
      } else {
        setLoading(false);
      }
    }).catch(() => setLoading(false));
  }, []);

  const loadRoster = useCallback(async () => {
    if (!clinicId) return;
    const res = await fetch(`/api/practitioners?clinicId=${clinicId}`);
    if (res.ok) setRoster(await res.json());
  }, [clinicId]);

  const loadStats = useCallback(async () => {
    if (!clinicId || !yearMonth) return;
    setLoading(true); setCsvReport(null);
    try {
      const res = await fetch(`/api/practitioner-stats?clinicId=${clinicId}&yearMonth=${yearMonth}`);
      if (res.ok) {
        const d = await res.json();
        const next: Record<string, GridValues> = {};
        for (const s of d.stats as StatsRecord[]) {
          next[s.practitionerId] = {
            insuranceRevenue: str(s.insuranceRevenue),
            selfPayRevenue: str(s.selfPayRevenue),
            workHours: str(s.workHours),
            patientCount: str(s.patientCount),
          };
        }
        setValues(next);
        setSavedIds(new Set((d.stats as StatsRecord[]).map((s) => s.practitionerId)));
        setClinicRevenue(d.clinicRevenue);
        setDirty(false);
      } else {
        setMessage({ text: "読み込みに失敗しました", error: true });
      }
    } catch {
      setMessage({ text: "読み込みに失敗しました", error: true });
    }
    setLoading(false);
  }, [clinicId, yearMonth]);

  useEffect(() => { loadRoster(); }, [loadRoster]);
  useEffect(() => { loadStats(); }, [loadStats]);

  // 入力対象の人に加え、対象外でもこの月の実績がある人は表に出す（黙って消えないように）
  const gridPractitioners = roster.filter((p) => p.isActive || savedIds.has(p.id));

  const changeMonth = (ym: string) => {
    if (dirty && !window.confirm("保存していない入力があります。月を切り替えると入力内容は失われます。よろしいですか？")) return;
    setMessage(null);
    setYearMonth(ym);
  };

  const onChange = (id: string, field: GridField, value: string) => {
    setValues((prev) => ({ ...prev, [id]: { ...(prev[id] ?? EMPTY_VALUES), [field]: value } }));
    setDirty(true);
  };

  // ---------- 名簿 ----------
  const addPractitioner = async (p: NewPractitioner): Promise<string | null> => {
    const res = await fetch("/api/practitioners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clinicId, ...p }),
    });
    if (!res.ok) return (await res.json()).error || "追加に失敗しました";
    await loadRoster();
    return null;
  };

  const updatePractitioner = async (id: string, patch: RosterPatch) => {
    const res = await fetch("/api/practitioners", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clinicId, id, ...patch }),
    });
    if (!res.ok) setMessage({ text: (await res.json()).error || "更新に失敗しました", error: true });
    await loadRoster();
  };

  const deletePractitioner = async (id: string) => {
    const res = await fetch(`/api/practitioners?clinicId=${clinicId}&id=${id}`, { method: "DELETE" });
    if (!res.ok) setMessage({ text: (await res.json()).error || "削除に失敗しました", error: true });
    // 削除した人の入力中の値も捨てる
    setValues((prev) => { const next = { ...prev }; delete next[id]; return next; });
    await loadRoster();
  };

  // ---------- CSV ----------
  const downloadTemplate = () => {
    const names = gridPractitioners.map((p) => p.name);
    const blob = new Blob([buildCsvTemplate(names)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `担当者別実績_${yearMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importCsv = async (file: File) => {
    setMessage(null);
    try {
      const text = decodeCsvBuffer(await file.arrayBuffer());
      const result = readPractitionerCsv(text, roster);
      if (result.rows.length > 0) {
        // CSVに無い項目（例：レセコンのCSVには無い勤務時間）は、入力済みの値を残す
        setValues((prev) => applyCsvRows(prev, result.rows));
        setDirty(true);
      }
      // 対象外の人の行を読み込んだ場合も表に出るようにする
      setSavedIds((prev) => new Set([...prev, ...result.rows.map((r) => r.practitionerId)]));
      setCsvReport({ applied: result.rows.length, fields: result.fields, unmatched: result.unmatched, errors: result.errors });
    } catch {
      setMessage({ text: "CSVファイルを読み込めませんでした", error: true });
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  // ---------- 保存 ----------
  const overHours = gridPractitioners.filter((p) => toNumber(values[p.id]?.workHours) > MAX_MONTH_HOURS);

  const save = async () => {
    if (overHours.length > 0) {
      setMessage({ text: `${overHours.map((p) => p.name).join("、")}の勤務時間が1か月の時間数を超えています。入力を確認してください`, error: true });
      return;
    }
    setSaving(true); setMessage(null);
    try {
      const rows = gridPractitioners.map((p) => {
        const v = values[p.id] ?? EMPTY_VALUES;
        return {
          practitionerId: p.id,
          insuranceRevenue: toNumber(v.insuranceRevenue),
          selfPayRevenue: toNumber(v.selfPayRevenue),
          workHours: toNumber(v.workHours),
          patientCount: toNumber(v.patientCount),
        };
      });
      const res = await fetch("/api/practitioner-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicId, yearMonth, rows }),
      });
      const d = await res.json();
      if (res.ok) {
        setMessage({ text: `保存しました（${d.saved}名分）。担当者別分析に反映されます。`, error: false });
        await Promise.all([loadStats(), loadRoster()]);
      } else {
        setMessage({ text: d.error || "保存に失敗しました", error: true });
      }
    } catch {
      setMessage({ text: "保存に失敗しました", error: true });
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">担当者データ登録</h1>
          <p className="text-sm text-gray-500 mt-1">
            歯科医師・歯科衛生士ごとの売上と勤務時間を登録します。登録すると
            <Link href="/analysis/practitioner" className="text-blue-600 hover:underline mx-0.5">担当者別分析</Link>
            に反映されます。
          </p>
        </div>
        <input type="month" className="border border-gray-300 rounded-md px-3 py-1.5 text-sm" aria-label="対象月"
          value={yearMonth} onChange={(e) => changeMonth(e.target.value)} />
      </div>

      {message && (
        <div className={`text-sm rounded-md px-4 py-2.5 border ${
          message.error ? "bg-red-50 text-red-700 border-red-100" : "bg-emerald-50 text-emerald-700 border-emerald-100"
        }`}>
          {message.text}
          {!message.error && <Link href="/analysis/practitioner" className="ml-2 underline font-medium">分析を見る →</Link>}
        </div>
      )}

      {/* ① 名簿。登録済みなら普段は閉じておき、月の入力を主役にする */}
      <Card>
        <details open={roster.length === 0}>
          <summary className="cursor-pointer select-none px-6 py-4 font-semibold text-gray-900">
            ① 担当者の名簿（{roster.filter((p) => p.isActive).length}名が入力対象）
            <span className="ml-2 text-xs font-normal text-gray-500">クリックで開閉</span>
          </summary>
          <CardContent>
            <RosterEditor practitioners={roster} onAdd={addPractitioner} onUpdate={updatePractitioner} onDelete={deletePractitioner} />
          </CardContent>
        </details>
      </Card>

      {/* ② 月次の実績 */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>② {yearMonth.slice(0, 4)}年{Number(yearMonth.slice(5))}月の実績</CardTitle>
            {gridPractitioners.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={downloadTemplate}>ひな形CSVをダウンロード</Button>
                <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>CSVから読み込む</Button>
                <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) importCsv(f); }} />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {gridPractitioners.length === 0 ? (
            <p className="text-sm text-gray-500">先に①で担当者を登録してください。</p>
          ) : loading ? (
            <p className="py-8 text-center text-gray-500">読み込み中...</p>
          ) : (
            <>
              <div className="text-xs text-gray-500 mb-4 leading-relaxed space-y-0.5">
                <p>・<strong>保険売上</strong>はレセコンの担当者別集計の点数×10円、<strong>自費売上</strong>は担当者別の自費の合計を入れてください。</p>
                <p>・<strong>勤務時間</strong>は、その月に実際に勤務した時間（残業を含む）です。時間単価の計算に使います。</p>
                <p>・歯科医師と衛生士が同じ患者を診た場合、<strong>同じ売上を両方に入れない</strong>でください（患者数は両方で数えて構いません）。</p>
                <p>・CSVは1行目に「氏名,保険売上,自費売上,勤務時間,担当患者数」の見出しを入れてください。保険売上の代わりに「保険点数」列でも読み込めます。</p>
              </div>

              {csvReport && (
                <div className={`text-sm rounded-md px-4 py-3 mb-4 border ${
                  csvReport.unmatched.length > 0 || csvReport.errors.length > 0 ? "bg-amber-50 border-amber-200 text-amber-900" : "bg-blue-50 border-blue-200 text-blue-900"
                }`}>
                  <p className="font-medium">
                    CSVから{csvReport.applied}名分の{csvReport.fields.map((f) => CSV_FIELD_LABELS[f]).join("・")}を入力欄に反映しました。内容を確認して「保存する」を押してください（まだ保存されていません）。
                  </p>
                  {csvReport.applied > 0 && csvReport.fields.length < 4 && (
                    <p className="mt-1">
                      CSVに無かった{(Object.keys(CSV_FIELD_LABELS) as CsvValueField[]).filter((f) => !csvReport.fields.includes(f)).map((f) => CSV_FIELD_LABELS[f]).join("・")}は、入力済みの値をそのまま残しています。
                    </p>
                  )}
                  {csvReport.unmatched.length > 0 && (
                    <p className="mt-1">⚠️ 名簿に無い氏名のため読み込まなかった行：{csvReport.unmatched.join("、")}（①で追加するか、氏名の表記を名簿に合わせてください）</p>
                  )}
                  {csvReport.errors.map((e) => <p key={e} className="mt-1">⚠️ {e}</p>)}
                </div>
              )}

              <StatsGrid practitioners={gridPractitioners} values={values} onChange={onChange} clinicRevenue={clinicRevenue} />

              <div className="flex items-center justify-end gap-3 mt-6">
                {dirty && <span className="text-xs text-amber-700">未保存の入力があります</span>}
                <Button onClick={save} disabled={saving || !clinicId}>{saving ? "保存中..." : "保存する"}</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
