"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { PractitionerAnalysisView } from "@/components/practitioner/analysis-view";
import type { PractitionerReport } from "@/lib/practitioner-report";

/**
 * 担当者別分析（歯科医師・歯科衛生士ごとの売上・時間単価）
 */
export default function PractitionerAnalysisPage() {
  const [clinicId, setClinicId] = useState("");
  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date(); now.setMonth(now.getMonth() - 1);
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [report, setReport] = useState<PractitionerReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  const load = useCallback(async () => {
    if (!clinicId || !yearMonth) return;
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/practitioner-analysis?clinicId=${clinicId}&yearMonth=${yearMonth}`);
      if (res.ok) setReport(await res.json());
      else setError("分析結果の取得に失敗しました");
    } catch {
      setError("分析結果の取得に失敗しました");
    }
    setLoading(false);
  }, [clinicId, yearMonth]);

  useEffect(() => { load(); }, [load]);

  const noRoster = report != null && report.practitioners.length === 0;
  const noStatsThisMonth = report != null && !noRoster && report.people.every((p) => p.verdict === "nodata");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">歯科医師・歯科衛生士別の分析</h1>
          <p className="text-sm text-gray-500 mt-1">
            担当者ごとの売上と時間単価を比べ、誰がどれだけ売上を生んでいるかを確認します。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input type="month" className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
            value={yearMonth} onChange={(e) => setYearMonth(e.target.value)} aria-label="対象月" />
          <Link href="/practitioner-data" className="h-8 px-3 inline-flex items-center rounded-md text-xs font-medium border border-gray-300 bg-white hover:bg-gray-50">
            データを登録する
          </Link>
        </div>
      </div>

      {error && (
        <div className="text-sm rounded-md px-4 py-2.5 bg-red-50 text-red-700 border border-red-100">{error}</div>
      )}

      {loading ? (
        <Card><CardContent className="py-12 text-center text-gray-500">読み込み中...</CardContent></Card>
      ) : noRoster ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <p className="text-lg font-medium text-gray-800">まだ担当者が登録されていません</p>
            <p className="text-sm text-gray-500 leading-relaxed">
              まず歯科医師・歯科衛生士の名簿を作り、月ごとの売上と勤務時間を入力してください。<br />
              レセコンの担当者別集計などをCSVで取り込むこともできます。
            </p>
            <Link href="/practitioner-data" className="h-10 px-4 inline-flex items-center rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700">
              担当者データ登録へ
            </Link>
          </CardContent>
        </Card>
      ) : report ? (
        <>
          {noStatsThisMonth && (
            <div className="text-sm rounded-md px-4 py-2.5 bg-amber-50 text-amber-800 border border-amber-200">
              この月の実績がまだ入力されていません。<Link href="/practitioner-data" className="underline font-medium">担当者データ登録</Link>から入力すると、ここに反映されます。
            </div>
          )}
          <PractitionerAnalysisView report={report} />
        </>
      ) : null}
    </div>
  );
}
