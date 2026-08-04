"use client";

import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { GLOSSARY, GlossaryTerm } from "@/lib/glossary";

/** 「利益の階段」— 売上から利益までの引き算を視覚化する */
function ProfitStaircase() {
  const rows = [
    { label: "月商（売上）", desc: "医院に入ってくるお金の合計", value: 100, color: "bg-blue-500", text: "text-blue-700" },
    { label: "− 直接原価", desc: "材料費・技工料など（診療の材料代）", value: 12, color: "bg-orange-300", text: "text-orange-700", minus: true },
    { label: "＝ 売上総利益（粗利）", desc: "ここから家賃・人件費を払う", value: 88, color: "bg-emerald-400", text: "text-emerald-700", result: true },
    { label: "− その他すべての費用", desc: "人件費・家賃・広告費・リースなど", value: 68, color: "bg-orange-300", text: "text-orange-700", minus: true },
    { label: "＝ 営業利益（最終のもうけ）", desc: "最終的に手元に残る本業のもうけ", value: 20, color: "bg-emerald-500", text: "text-emerald-800", result: true },
  ];
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i} className={`flex items-center gap-3 ${r.result ? "" : "pl-0"}`}>
          <div className="w-52 shrink-0">
            <div className={`text-sm font-semibold ${r.text}`}>{r.label}</div>
            <div className="text-xs text-gray-500">{r.desc}</div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="h-7 bg-gray-100 rounded overflow-hidden">
              <div
                className={`h-full ${r.color} ${r.minus ? "opacity-70" : ""} rounded flex items-center justify-end pr-2 transition-all`}
                style={{ width: `${r.value}%` }}
              >
                <span className="text-xs font-bold text-white">{r.minus ? "" : `${r.value}`}</span>
              </div>
            </div>
          </div>
        </div>
      ))}
      <p className="text-xs text-gray-500 pt-2">
        ※ 数字は「売上を100としたときの割合」のイメージ図です。実際の値は各分析ページでご確認いただけます。
      </p>
    </div>
  );
}

function TermRow({ t }: { t: GlossaryTerm }) {
  return (
    <div className="py-4 border-b border-gray-100 last:border-0">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h3 className="text-base font-bold text-gray-900">{t.term}</h3>
        {t.reading && <span className="text-xs text-gray-400">{t.reading}</span>}
        {t.benchmark && (
          <span className="ml-auto text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-2.5 py-0.5">
            🎯 {t.benchmark}
          </span>
        )}
      </div>
      <p className="mt-2 text-sm text-gray-700 leading-relaxed">{t.plain}</p>
      {t.formula && (
        <div className="mt-2.5 text-sm bg-gray-50 border border-gray-100 rounded-md px-3 py-2 text-gray-800">
          <span className="text-xs text-gray-400 mr-2">計算式</span>
          {t.formula}
        </div>
      )}
      <p className="mt-2.5 text-sm text-gray-600 leading-relaxed">
        <span className="inline-block text-xs font-semibold text-blue-700 bg-blue-50 rounded px-1.5 py-0.5 mr-2 align-middle">どう読む</span>
        {t.howToRead}
      </p>
    </div>
  );
}

export default function GlossaryPage() {
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<string>("all");

  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    return GLOSSARY.map((cat) => {
      if (activeCat !== "all" && activeCat !== cat.id) return null;
      const terms = cat.terms.filter((t) => {
        if (!q) return true;
        const hay = [t.term, t.reading, t.plain, t.formula, t.howToRead, ...(t.aliases || [])]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
      return terms.length > 0 ? { ...cat, terms } : null;
    }).filter(Boolean) as typeof GLOSSARY;
  }, [q, activeCat]);

  const totalHits = filtered.reduce((s, c) => s + c.terms.length, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">経営用語集</h1>
        <p className="mt-1 text-sm text-gray-500">
          このシステムに出てくる経営の言葉を、専門知識がなくても分かるように解説します。分析画面で見慣れない言葉が出てきたら、ここで調べてください。
        </p>
      </div>

      {/* 利益の階段：一番大事な考え方をまず図で */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">💹</span>
            <h2 className="text-lg font-bold text-gray-900">まずこれだけ：「利益」はこう決まる</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            売上から費用を段階的に引いていくと、最後に「営業利益（本当のもうけ）」が残ります。この引き算の流れが、経営数字のいちばんの土台です。
          </p>
          <ProfitStaircase />
        </CardContent>
      </Card>

      {/* 検索＋カテゴリ */}
      <div className="space-y-3">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="用語を検索（例：営業利益、CPA、粗利、チェア稼働率）"
            className="w-full border border-gray-300 rounded-md pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCat("all")}
            className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
              activeCat === "all"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            }`}
          >
            すべて
          </button>
          {GLOSSARY.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCat(cat.id)}
              className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                activeCat === cat.id
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {cat.icon} {cat.title}
            </button>
          ))}
        </div>
        {q && (
          <p className="text-xs text-gray-500">「{query}」の検索結果：{totalHits}件</p>
        )}
      </div>

      {/* 用語一覧 */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <p>「{query}」に一致する用語が見つかりませんでした。</p>
            <p className="text-sm mt-1">別の言葉（例：もうけ、あらり、集客）でもお試しください。</p>
          </CardContent>
        </Card>
      ) : (
        filtered.map((cat) => (
          <Card key={cat.id}>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3 pb-3 mb-1 border-b border-gray-100">
                <span className="text-2xl leading-none">{cat.icon}</span>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{cat.title}</h2>
                  <p className="text-sm text-gray-500 mt-0.5">{cat.summary}</p>
                </div>
              </div>
              {cat.terms.map((t) => (
                <TermRow key={t.term} t={t} />
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
