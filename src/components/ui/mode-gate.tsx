"use client";

import { AnalysisMode, sectionVisibleInMode } from "@/lib/analysis-mode";

interface Props {
  requires: ("finance" | "clinical")[];
  mode: AnalysisMode;
  children: React.ReactNode;
  /** 隠れたときにプレースホルダを出すか（既定: 何も出さない） */
  showPlaceholder?: boolean;
  title?: string;
}

const NEED_LABEL = { finance: "財務諸表（BS/PL/CS）", clinical: "患者数・診療点数（カルテ/レセプト）" };

/**
 * セクションを分析モードで出し分ける。必要データが無いモードでは非表示、
 * showPlaceholder 指定時は「このモードでは表示できない」旨を出す。
 */
export function ModeGate({ requires, mode, children, showPlaceholder, title }: Props) {
  if (sectionVisibleInMode(requires, mode)) return <>{children}</>;
  if (!showPlaceholder) return null;

  const missing = requires
    .filter((r) => (mode === "FINANCIAL" ? r === "clinical" : r === "finance"))
    .map((r) => NEED_LABEL[r]);

  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
      {title && <p className="text-sm font-medium text-gray-700 mb-1">{title}</p>}
      <p className="text-sm text-gray-500">
        この分析には{missing.join("・")}のデータが必要です。<br />
        統合分析モードに切り替えるか、該当データを取り込むと表示されます。
      </p>
    </div>
  );
}
