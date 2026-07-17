"use client";

import { Period, PERIOD_PRESETS, resolvePeriod, countMonths } from "@/lib/period";

interface PeriodSelectorProps {
  value: Period;
  onChange: (period: Period) => void;
  /** 期間の最終月。プリセット選択時はここから遡る */
  baseMonth: string;
}

/**
 * トレンドグラフの期間セレクタ。
 * 3ヶ月／6ヶ月／1年のプリセットと、開始〜終了を自由指定するカスタムを持つ。
 */
export function PeriodSelector({ value, onChange, baseMonth }: PeriodSelectorProps) {
  const isCustom = value.type === "custom";
  const { from, to } = resolvePeriod(value, baseMonth);

  const selectCustom = () => {
    // 現在表示中の期間をそのまま引き継いで編集を始められるようにする
    onChange({ type: "custom", from, to });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-md border border-gray-300 overflow-hidden">
        {PERIOD_PRESETS.map((p) => {
          const active = value.type === "preset" && value.months === p.months;
          return (
            <button
              key={p.months}
              type="button"
              onClick={() => onChange({ type: "preset", months: p.months })}
              className={`px-3 py-1.5 text-sm border-r border-gray-300 last:border-r-0 transition-colors ${
                active ? "bg-blue-600 text-white font-medium" : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {p.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={selectCustom}
          className={`px-3 py-1.5 text-sm transition-colors ${
            isCustom ? "bg-blue-600 text-white font-medium" : "bg-white text-gray-700 hover:bg-gray-50"
          }`}
        >
          カスタム
        </button>
      </div>

      {isCustom ? (
        <div className="flex items-center gap-1.5">
          <input
            type="month"
            aria-label="開始月"
            className="border border-gray-300 rounded-md px-2 py-1.5 text-sm"
            value={value.from}
            onChange={(e) => e.target.value && onChange({ ...value, from: e.target.value })}
          />
          <span className="text-sm text-gray-500">〜</span>
          <input
            type="month"
            aria-label="終了月"
            className="border border-gray-300 rounded-md px-2 py-1.5 text-sm"
            value={value.to}
            onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value })}
          />
          <span className="text-sm text-gray-500 whitespace-nowrap">（{countMonths(from, to)}ヶ月）</span>
        </div>
      ) : (
        <span className="text-sm text-gray-500 whitespace-nowrap">{from} 〜 {to}</span>
      )}
    </div>
  );
}
