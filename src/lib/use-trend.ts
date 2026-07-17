"use client";

import { useState, useEffect } from "react";
import { Period, resolvePeriod, formatMonthLabel } from "./period";

/** グラフに渡す1行分。label は横軸用、他はKPIコードごとの値 */
export type TrendRow = { yearMonth: string; label: string } & Record<string, number | string>;

/**
 * 指定期間のKPI推移を取得する。
 * /api/kpi/range を使い、期間の長さによらず1リクエストで済ませる。
 */
export function useTrend(clinicId: string, period: Period, baseMonth: string) {
  const [rows, setRows] = useState<TrendRow[]>([]);

  const { from, to } = resolvePeriod(period, baseMonth);

  useEffect(() => {
    if (!clinicId || !from || !to) return;

    // 期間を素早く切り替えた際に、古いレスポンスで新しい結果を上書きしないようにする
    let cancelled = false;

    fetch(`/api/kpi/range?clinicId=${clinicId}&from=${from}&to=${to}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: { yearMonth: string; values: Record<string, number> }[]) => {
        if (cancelled) return;
        setRows(
          Array.isArray(data)
            ? data.map((d) => ({ yearMonth: d.yearMonth, label: formatMonthLabel(d.yearMonth), ...d.values }))
            : []
        );
      })
      .catch(() => { if (!cancelled) setRows([]); });

    return () => { cancelled = true; };
  }, [clinicId, from, to]);

  return { rows };
}
