"use client";

import { useState } from "react";
import { AnalysisMode, ANALYSIS_MODES } from "@/lib/analysis-mode";

interface Props {
  clinicId: string;
  mode: AnalysisMode;
  onChange: (mode: AnalysisMode) => void;
}

/**
 * 分析モードの切替。選択すると医院の analysisMode を保存し、画面を即座に切り替える。
 * 財務データが無い医院は「患者・診療」、逆は「財務」を選ぶ想定。
 */
export function AnalysisModeSelector({ clinicId, mode, onChange }: Props) {
  const [saving, setSaving] = useState(false);
  const current = ANALYSIS_MODES.find((m) => m.key === mode) ?? ANALYSIS_MODES[0];

  const select = async (next: AnalysisMode) => {
    if (next === mode || !clinicId) return;
    onChange(next); // 画面は即座に切り替える
    setSaving(true);
    try {
      await fetch(`/api/clinics/${clinicId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysisMode: next }),
      });
    } catch {
      /* 保存に失敗しても表示は切り替わっている。次回読み込みで元に戻る */
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="inline-flex rounded-md border border-gray-300 overflow-hidden self-start">
        {ANALYSIS_MODES.map((m) => {
          const active = m.key === mode;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => select(m.key)}
              title={m.desc}
              className={`px-3 py-1.5 text-sm border-r border-gray-300 last:border-r-0 transition-colors ${
                active ? "bg-blue-600 text-white font-medium" : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {m.short}
            </button>
          );
        })}
      </div>
      <span className="text-xs text-gray-500">
        {current.label}：{current.desc}{saving ? "（保存中…）" : ""}
      </span>
    </div>
  );
}
