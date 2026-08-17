"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { DIFFICULTY_LABEL } from "@/lib/improvement-simulator";

/**
 * 今月のまとめ ＋ 今月やること
 *
 * ダッシュボードの一番上に置き、数字より先に日本語が目に入るようにする。
 * 経営に慣れていない先生が「開いて10秒で状況が分かる」ことを狙う。
 */

interface SummaryLine {
  kind: "headline" | "good" | "warning" | "trend";
  text: string;
  kpiCode?: string;
}

interface Action {
  code: string;
  title: string;
  problem: string;
  suggestion: string;
  monthlyImpact: number;
  difficulty: "LOW" | "MEDIUM" | "HIGH";
  current: string;
  target: string;
  feasibilityNote?: string;
}

interface SummaryResponse {
  lines: SummaryLine[];
  actions: Action[];
  hasData: boolean;
  top3MonthlyImpact?: number;
  totalOpportunityCount?: number;
}

const KIND_STYLE: Record<SummaryLine["kind"], { chip: string; label: string }> = {
  headline: { chip: "bg-blue-50 text-blue-700 border-blue-100", label: "今月" },
  good:     { chip: "bg-emerald-50 text-emerald-700 border-emerald-100", label: "良い点" },
  warning:  { chip: "bg-amber-50 text-amber-700 border-amber-100", label: "注意" },
  trend:    { chip: "bg-orange-50 text-orange-700 border-orange-100", label: "傾向" },
};

const DIFFICULTY_STYLE: Record<Action["difficulty"], string> = {
  LOW: "bg-emerald-50 text-emerald-700 border-emerald-100",
  MEDIUM: "bg-amber-50 text-amber-700 border-amber-100",
  HIGH: "bg-gray-100 text-gray-600 border-gray-200",
};

export function MonthlyBriefing({ clinicId, yearMonth }: { clinicId: string; yearMonth: string }) {
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!clinicId || !yearMonth) return;
    setLoading(true);
    fetch(`/api/summary?clinicId=${clinicId}&yearMonth=${yearMonth}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [clinicId, yearMonth]);

  if (loading && !data) {
    return (
      <Card><CardContent className="py-8 text-center text-sm text-gray-400">今月のまとめを準備しています...</CardContent></Card>
    );
  }
  if (!data?.hasData || (data.lines.length === 0 && data.actions.length === 0)) return null;

  const [y, m] = yearMonth.split("-");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      {/* 今月のまとめ */}
      <Card className="lg:col-span-3">
        <CardContent className="pt-6">
          <h2 className="text-base font-bold text-gray-900 mb-4">
            {Number(y)}年{Number(m)}月のまとめ
          </h2>
          <ul className="space-y-3">
            {data.lines.map((l, i) => (
              <li key={i} className="flex gap-2.5 items-start">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded border shrink-0 mt-0.5 ${KIND_STYLE[l.kind].chip}`}>
                  {KIND_STYLE[l.kind].label}
                </span>
                <span className="text-sm text-gray-700 leading-relaxed">{l.text}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-400 mt-4">
            数字の意味が分からないときは、左メニューの「用語集」で調べられます。
          </p>
        </CardContent>
      </Card>

      {/* 今月やること トップ3 */}
      <Card className="lg:col-span-2">
        <CardContent className="pt-6">
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <h2 className="text-base font-bold text-gray-900">今月やること</h2>
            {data.actions.length > 0 && (
              <span className="text-xs text-gray-400">効果の高い順に3つ</span>
            )}
          </div>

          {data.actions.length === 0 ? (
            <p className="text-sm text-gray-500 py-6">
              目安を下回っている項目はありません。この調子を維持してください。
            </p>
          ) : (
            <>
              <ol className="space-y-2.5 mt-3">
                {data.actions.map((a, i) => {
                  const open = openIndex === i;
                  return (
                    <li key={a.code} className="border border-gray-200 rounded-md overflow-hidden">
                      <button
                        className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-200"
                        onClick={() => setOpenIndex(open ? null : i)}
                        aria-expanded={open}
                      >
                        <div className="flex items-start gap-2.5">
                          <span className="text-sm font-bold text-gray-400 shrink-0 mt-0.5">{i + 1}</span>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-bold text-gray-900">{a.title}</div>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                              <span className="text-sm font-bold text-emerald-700">
                                最大 月 +{formatCurrency(a.monthlyImpact)}
                              </span>
                              <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded border ${DIFFICULTY_STYLE[a.difficulty]}`}>
                                {DIFFICULTY_LABEL[a.difficulty]}
                              </span>
                            </div>
                          </div>
                          <span className="text-gray-300 text-xs shrink-0 mt-1">{open ? "▲" : "▼"}</span>
                        </div>
                      </button>
                      {open && (
                        <div className="px-3 pb-3 pt-1 border-t border-gray-100 bg-gray-50">
                          <p className="text-xs text-gray-600 leading-relaxed">{a.problem}</p>
                          <p className="text-xs text-gray-800 leading-relaxed mt-2">
                            <span className="font-bold">打ち手：</span>{a.suggestion}
                          </p>
                          {/* 上限値をそのまま目標と誤解しないよう、実現条件を添える */}
                          {a.feasibilityNote && (
                            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded px-2 py-1.5 mt-2 leading-relaxed">
                              {a.feasibilityNote}
                            </p>
                          )}
                          <p className="text-[11px] text-gray-400 mt-2">
                            現状 {a.current} → 目標 {a.target}
                          </p>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
              <p className="text-xs text-gray-500 mt-3 leading-relaxed">
                金額はいずれも<span className="font-medium">理論上の上限</span>で、達成を約束するものではありません。
                項目を開くと、その根拠と打ち手が確認できます。
                {(data.totalOpportunityCount ?? 0) > 3 && (
                  <>
                    {" "}他 {(data.totalOpportunityCount ?? 0) - 3} 件の提案は
                    <a href="/action" className="text-blue-600 hover:underline mx-0.5">改善提案</a>
                    で確認できます。
                  </>
                )}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
