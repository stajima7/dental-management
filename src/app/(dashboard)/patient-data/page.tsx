"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CANCEL_REASONS, CANCEL_CATEGORY_LABELS } from "@/lib/constants";
import { formatNumber } from "@/lib/utils";

interface ClinicInfo { id: string; clinicName: string; latestYearMonth?: string; }
interface RecallForm { notifiedCount: number; bookedCount: number; visitedCount: number; rebookedCount: number; }
interface CancelRow { category: string; reasonCode: string; count: number; recoveredCount: number; }
interface DiscontinuedForm { noNextAppointment: number; afterCancel: number; afterNoShow: number; maintenanceOverdue: number; }

const EMPTY_RECALL: RecallForm = { notifiedCount: 0, bookedCount: 0, visitedCount: 0, rebookedCount: 0 };
const EMPTY_DISCONTINUED: DiscontinuedForm = { noNextAppointment: 0, afterCancel: 0, afterNoShow: 0, maintenanceOverdue: 0 };

/** キャンセル理由マスタの並び（患者都合→医院都合） */
const REASON_LIST = Object.values(CANCEL_REASONS);

const pct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : 0);

export default function PatientDataPage() {
  const [clinics, setClinics] = useState<ClinicInfo[]>([]);
  const [selectedClinicId, setSelectedClinicId] = useState("");
  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date(); now.setMonth(now.getMonth() - 1);
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const [recall, setRecall] = useState<RecallForm>(EMPTY_RECALL);
  const [cancels, setCancels] = useState<CancelRow[]>([]);
  const [discontinued, setDiscontinued] = useState<DiscontinuedForm>(EMPTY_DISCONTINUED);
  const [registeredCancelCount, setRegisteredCancelCount] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
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

  const emptyCancelRows = useCallback(
    () => REASON_LIST.map(r => ({ category: r.category as string, reasonCode: r.code as string, count: 0, recoveredCount: 0 })),
    []
  );

  const load = useCallback(async () => {
    if (!selectedClinicId || !yearMonth) return;
    setLoading(true); setMessage("");
    try {
      const res = await fetch(`/api/patient-data?clinicId=${selectedClinicId}&yearMonth=${yearMonth}`);
      if (res.ok) {
        const d = await res.json();
        setRecall(d.recall ?? EMPTY_RECALL);
        setDiscontinued(d.discontinued ?? EMPTY_DISCONTINUED);
        setRegisteredCancelCount(d.registeredCancelCount);
        // マスタの全理由を並べ、登録済みの件数を差し込む（未登録の理由も入力できるように）
        const saved: CancelRow[] = d.cancelDetails ?? [];
        setCancels(emptyCancelRows().map(row => {
          const hit = saved.find(s => s.reasonCode === row.reasonCode);
          return hit ? { ...row, count: hit.count, recoveredCount: hit.recoveredCount } : row;
        }));
      }
    } catch { setMessage("読み込みに失敗しました"); }
    setLoading(false);
  }, [selectedClinicId, yearMonth, emptyCancelRows]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true); setMessage("");
    try {
      const res = await fetch("/api/patient-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicId: selectedClinicId, yearMonth, recall, cancelDetails: cancels, discontinued }),
      });
      setMessage(res.ok
        ? "保存しました。患者分析・カネ分析の数値に反映されます。"
        : "保存に失敗しました");
      if (res.ok) load();
    } catch { setMessage("保存に失敗しました"); }
    setSaving(false);
  };

  const num = (v: string) => Math.max(0, Number(v) || 0);
  const cancelTotal = cancels.reduce((s, c) => s + c.count, 0);
  const cancelRecovered = cancels.reduce((s, c) => s + c.recoveredCount, 0);
  const clinicSide = cancels.filter(c => c.category === "CLINIC").reduce((s, c) => s + c.count, 0);
  const discontinuedTotal = discontinued.noNextAppointment + discontinued.afterCancel
    + discontinued.afterNoShow + discontinued.maintenanceOverdue;

  // 入力の矛盾を保存前に気づけるようにする
  const recallWarnings = [
    recall.bookedCount > recall.notifiedCount && "予約者数が通知者数を超えています",
    recall.visitedCount > recall.bookedCount && "来院者数が予約者数を超えています",
    recall.rebookedCount > recall.visitedCount && "再予約者数が来院者数を超えています",
  ].filter(Boolean) as string[];

  const cancelMismatch =
    registeredCancelCount != null && cancelTotal > 0 && cancelTotal !== registeredCancelCount;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">患者データ登録</h1>
          <p className="text-sm text-gray-500 mt-1">
            リコール・キャンセル理由・中断患者を登録します。登録すると患者分析の各グラフに反映されます。
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

      {message && (
        <div className={`text-sm rounded-md px-4 py-2.5 ${
          message.includes("失敗") ? "bg-red-50 text-red-700 border border-red-100"
                                   : "bg-emerald-50 text-emerald-700 border border-emerald-100"
        }`}>{message}</div>
      )}

      {loading ? (
        <Card><CardContent className="py-12 text-center text-gray-500">読み込み中...</CardContent></Card>
      ) : (
        <>
          {/* ① リコール */}
          <Card>
            <CardHeader><CardTitle>リコール（呼び戻し）</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500 mb-4">
                その月にリコール通知を出した人数と、そこから予約・来院・次回予約へ進んだ人数を入力します。
              </p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  { key: "notifiedCount" as const, label: "① 通知を出した人数", hint: "リコール案内の送付数" },
                  { key: "bookedCount" as const, label: "② 予約に至った人数", hint: "①のうち予約した人" },
                  { key: "visitedCount" as const, label: "③ 実際に来院した人数", hint: "②のうち来院した人" },
                  { key: "rebookedCount" as const, label: "④ 次回予約まで進んだ人数", hint: "③のうち次を予約した人" },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                    <Input type="number" min={0} value={recall[f.key] || ""}
                      onChange={e => setRecall({ ...recall, [f.key]: num(e.target.value) })} />
                    <p className="text-xs text-gray-400 mt-1">{f.hint}</p>
                  </div>
                ))}
              </div>

              {recallWarnings.length > 0 && (
                <div className="mt-4 text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-md px-3 py-2">
                  {recallWarnings.map(w => <div key={w}>⚠️ {w}（保存時に上限へ丸められます）</div>)}
                </div>
              )}

              {recall.notifiedCount > 0 && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { label: "予約率", v: pct(recall.bookedCount, recall.notifiedCount), target: 80 },
                    { label: "来院率", v: pct(recall.visitedCount, recall.bookedCount), target: 90 },
                    { label: "継続率", v: pct(recall.rebookedCount, recall.visitedCount), target: 75 },
                  ].map(x => (
                    <div key={x.label} className="border rounded-md px-3 py-2 bg-gray-50">
                      <div className="text-xs text-gray-500">{x.label}（目標{x.target}%）</div>
                      <div className={`text-lg font-bold ${x.v >= x.target ? "text-emerald-600" : x.v >= x.target * 0.85 ? "text-amber-600" : "text-red-600"}`}>
                        {x.v.toFixed(1)}%
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ② キャンセル理由内訳 */}
          <Card>
            <CardHeader><CardTitle>キャンセルの理由別内訳</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500 mb-4">
                理由ごとのキャンセル件数と、そのうち別の日に予約を取り直せた件数を入力します。0件の理由は空欄のままで構いません。
              </p>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="px-3 py-2 text-left font-medium">区分</th>
                      <th className="px-3 py-2 text-left font-medium">キャンセル理由</th>
                      <th className="px-3 py-2 text-right font-medium w-32">件数</th>
                      <th className="px-3 py-2 text-right font-medium w-32">取り直せた件数</th>
                      <th className="px-3 py-2 text-right font-medium w-24">リカバリー率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cancels.map((c, i) => {
                      const rec = pct(c.recoveredCount, c.count);
                      const over = c.recoveredCount > c.count;
                      return (
                        <tr key={c.reasonCode} className="border-b">
                          <td className="px-3 py-1.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              c.category === "CLINIC" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"
                            }`}>{CANCEL_CATEGORY_LABELS[c.category]}</span>
                          </td>
                          <td className="px-3 py-1.5">{REASON_LIST.find(r => r.code === c.reasonCode)?.name ?? c.reasonCode}</td>
                          <td className="px-3 py-1.5">
                            <Input type="number" min={0} className="text-right"
                              value={c.count || ""}
                              onChange={e => setCancels(prev => prev.map((x, j) => j === i ? { ...x, count: num(e.target.value) } : x))} />
                          </td>
                          <td className="px-3 py-1.5">
                            <Input type="number" min={0} className={`text-right ${over ? "border-red-400" : ""}`}
                              value={c.recoveredCount || ""}
                              onChange={e => setCancels(prev => prev.map((x, j) => j === i ? { ...x, recoveredCount: num(e.target.value) } : x))} />
                          </td>
                          <td className={`px-3 py-1.5 text-right font-medium ${
                            over ? "text-red-600" : rec >= 60 ? "text-emerald-600" : rec >= 35 ? "text-amber-600" : "text-gray-400"
                          }`}>
                            {over ? "件数超過" : c.count > 0 ? `${rec.toFixed(0)}%` : "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 font-medium">
                      <td className="px-3 py-2" colSpan={2}>合計（医院都合 {formatNumber(clinicSide)}件）</td>
                      <td className="px-3 py-2 text-right">{formatNumber(cancelTotal)}件</td>
                      <td className="px-3 py-2 text-right">{formatNumber(cancelRecovered)}件</td>
                      <td className="px-3 py-2 text-right">{cancelTotal > 0 ? `${pct(cancelRecovered, cancelTotal).toFixed(0)}%` : "-"}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {cancelMismatch && (
                <div className="mt-4 text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-md px-3 py-2">
                  ⚠️ 内訳の合計（{formatNumber(cancelTotal)}件）が、データ取込で登録済みのキャンセル数（{formatNumber(registeredCancelCount!)}件）と一致していません。
                  どちらかが誤っている可能性があります。
                </div>
              )}
            </CardContent>
          </Card>

          {/* ③ 中断患者 */}
          <Card>
            <CardHeader><CardTitle>中断患者（次回予約が入っていない人）</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500 mb-4">
                判定期間を過ぎても次回予約が入っていない患者数を、状態別に入力します。合計が「連絡すべき患者数」になります。
              </p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  { key: "noNextAppointment" as const, label: "次回予約が入っていない", hint: "治療途中の可能性（最優先）" },
                  { key: "afterCancel" as const, label: "キャンセル後そのまま", hint: "取り直しの連絡漏れ" },
                  { key: "afterNoShow" as const, label: "無断キャンセル後そのまま", hint: "連絡が届いているか確認" },
                  { key: "maintenanceOverdue" as const, label: "メンテ予定日を過ぎている", hint: "リコール通知の対象" },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                    <Input type="number" min={0} value={discontinued[f.key] || ""}
                      onChange={e => setDiscontinued({ ...discontinued, [f.key]: num(e.target.value) })} />
                    <p className="text-xs text-gray-400 mt-1">{f.hint}</p>
                  </div>
                ))}
              </div>
              {discontinuedTotal > 0 && (
                <div className="mt-4 text-sm text-gray-700">
                  合計 <span className="text-lg font-bold text-gray-900">{formatNumber(discontinuedTotal)}</span> 人が連絡対象です。
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button onClick={save} disabled={saving || !selectedClinicId}>
              {saving ? "保存中..." : "保存する"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
