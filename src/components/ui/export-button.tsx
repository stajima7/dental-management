"use client";

import { useState } from "react";
import { Button } from "./button";

interface ExportButtonProps {
  clinicId: string;
  /** kpi | department | costs | monthly | trend */
  type: string;
  /** trend以外で必須 */
  yearMonth?: string;
  /** type=trend のとき必須 */
  from?: string;
  to?: string;
  label?: string;
}

/**
 * CSVをダウンロードするボタン。
 * BOM付きUTF-8で出力しているため、Excelでそのまま開いても日本語が文字化けしない。
 */
export function ExportButton({ clinicId, type, yearMonth, from, to, label = "CSV出力" }: ExportButtonProps) {
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    if (!clinicId) return;
    setDownloading(true);
    try {
      const params = new URLSearchParams({ clinicId, type, format: "csv" });
      if (yearMonth) params.set("yearMonth", yearMonth);
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const res = await fetch(`/api/report?${params}`);
      if (!res.ok) {
        alert("CSVの出力に失敗しました");
        return;
      }

      // サーバーが付けたファイル名をそのまま使う
      const disposition = res.headers.get("Content-Disposition") || "";
      const matched = /filename="([^"]+)"/.exec(disposition);
      const filename = matched ? matched[1] : `${type}.csv`;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("CSVの出力に失敗しました");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Button size="sm" variant="secondary" onClick={download} disabled={downloading || !clinicId}>
      {downloading ? "出力中..." : label}
    </Button>
  );
}
