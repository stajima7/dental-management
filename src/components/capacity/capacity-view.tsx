"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { CAPACITY_CEILING } from "@/lib/capacity";

/**
 * 増員・増設の検討 の表示部分
 *
 * データ取得と切り離しておくことで、実データが無くても表示を確認できる。
 * 判定ロジックの結果をそのまま受け取り、描画だけを担う。
 */

export interface Resource {
  key: string; label: string; utilization: number; current: number;
  unitLabel: string; status: "tight" | "moderate" | "loose"; basis: string;
}
export interface Signal { key: string; label: string; hit: boolean; detail: string; }
export interface Plan {
  key: string; label: string; addUnits: number; unitCountAfter: number;
  revenueDiff: number; afterTaxDiff: number; investment: number;
  paybackMonths: number | null; warning?: string;
  addHygienists: number; addAssistants: number; addDentists: number;
}
export interface CapacityData {
  hasData: boolean; reason?: string;
  capacity: { resources: Resource[]; verdict: string; headline: string; advice: string; missing?: string[] };
  maintenance: {
    signals: Signal[]; hitCount: number; recommend: boolean; headline: string; body: string;
    simulation: { additionalSlots: number; additionalRevenue: number; additionalCost: number;
      netEffect: number; revenuePerMaintenance: number } | null;
    simulationNote?: string;
  };
  expansion: {
    current: { revenue: number; afterTax: number; unitCountAfter: number };
    plans: Plan[];
    curve: { units: number; revenue: number; afterTax: number; specialExpense: boolean }[];
    recoveryUnits: number | null;
    assumption: { revenuePerUnitBase: number; revenuePerUnitMarginal: number; baseUnitCount: number };
  } | null;
  expansionNote?: string;
  staffRatesConfigured: boolean;
}

const STATUS_STYLE: Record<Resource["status"], { bar: string; text: string; label: string }> = {
  tight:    { bar: "bg-red-500",     text: "text-red-700",     label: "限界に近い" },
  moderate: { bar: "bg-amber-500",   text: "text-amber-700",   label: "やや詰まっている" },
  loose:    { bar: "bg-emerald-500", text: "text-emerald-700", label: "余力あり" },
};

export function CapacityView({ data }: { data: CapacityData }) {
  const cap = data.capacity;
  const mt = data.maintenance;
  const exp = data.expansion;

  return (
    <>
      {/* ① 余力とボトルネック */}
      {cap && (
        <Card>
          <CardHeader><CardTitle>いま足りていないもの</CardTitle></CardHeader>
          <CardContent>
            <div className={`text-lg font-bold mb-1 ${
              cap.verdict === "demand" ? "text-emerald-700"
              : cap.verdict === "unknown" ? "text-gray-600" : "text-red-700"}`}>
              {cap.headline}
            </div>
            <p className="text-sm text-gray-600 mb-5 leading-relaxed">{cap.advice}</p>

            <div className="space-y-4">
              {cap.resources.map(r => {
                const st = STATUS_STYLE[r.status];
                const width = Math.min(100, Math.max(0, r.utilization));
                return (
                  <div key={r.key}>
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-800">
                        {r.label}
                        <span className="text-xs text-gray-400 ml-2">
                          現在 {r.current % 1 === 0 ? r.current : r.current.toFixed(1)}{r.unitLabel}
                        </span>
                      </span>
                      <span className={`text-sm font-bold ${st.text}`}>
                        {r.utilization.toFixed(0)}% <span className="text-xs font-medium">{st.label}</span>
                      </span>
                    </div>
                    <div className="relative h-6 bg-gray-100 rounded overflow-hidden">
                      <div className={`h-full ${st.bar} transition-all`} style={{ width: `${width}%` }} />
                      <div className="absolute top-0 bottom-0 w-0.5 bg-gray-700/50"
                        style={{ left: `${CAPACITY_CEILING}%` }} />
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">{r.basis}</p>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 mt-4">
              縦線は限界の目安（{CAPACITY_CEILING}%）です。準備や片付け、急患の枠を考えると100%は達成できないため、
              この水準を上限としています。
            </p>
          </CardContent>
        </Card>
      )}

      {/* ② メンテナンス体制 */}
      {mt && (
        <Card>
          <CardHeader><CardTitle>メンテナンス体制</CardTitle></CardHeader>
          <CardContent>
            <div className={`text-lg font-bold mb-1 ${mt.recommend ? "text-blue-700" : "text-gray-700"}`}>
              {mt.headline}
            </div>
            <p className="text-sm text-gray-600 mb-5 leading-relaxed">{mt.body}</p>

            <div className="space-y-2 mb-5">
              {mt.signals.map(s => (
                <div key={s.key} className="flex items-start gap-2.5">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded border shrink-0 mt-0.5 ${
                    s.hit ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-gray-50 text-gray-400 border-gray-200"}`}>
                    {s.hit ? "該当" : "—"}
                  </span>
                  <div className="min-w-0">
                    <div className={`text-sm ${s.hit ? "font-medium text-gray-800" : "text-gray-500"}`}>{s.label}</div>
                    <div className="text-xs text-gray-400">{s.detail}</div>
                  </div>
                </div>
              ))}
            </div>

            {mt.simulation ? (
              <div className="border border-gray-200 rounded-md p-4 bg-gray-50">
                <div className="text-sm font-bold text-gray-800 mb-2">歯科衛生士を1名増やした場合</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div><div className="text-xs text-gray-500">増える対応枠</div>
                    <div className="font-bold">{formatNumber(mt.simulation.additionalSlots)}件/月</div></div>
                  <div><div className="text-xs text-gray-500">増える売上</div>
                    <div className="font-bold text-emerald-700">+{formatCurrency(mt.simulation.additionalRevenue)}</div></div>
                  <div><div className="text-xs text-gray-500">増える人件費</div>
                    <div className="font-bold text-red-700">−{formatCurrency(mt.simulation.additionalCost)}</div></div>
                  <div><div className="text-xs text-gray-500">差引</div>
                    <div className={`font-bold ${mt.simulation.netEffect >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                      {mt.simulation.netEffect >= 0 ? "+" : "−"}{formatCurrency(Math.abs(mt.simulation.netEffect))}/月
                    </div></div>
                </div>
                {mt.simulationNote && <p className="text-xs text-amber-700 mt-3">{mt.simulationNote}</p>}
              </div>
            ) : (
              <p className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-md p-3">
                {mt.simulationNote}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ③ 増設シミュレーション */}
      {exp && (
        <Card>
          <CardHeader><CardTitle>増やしたら、いくら残るのか</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
              現状（ユニット{exp.current.unitCountAfter}台・年商{formatCurrency(exp.current.revenue)}・
              税引後 {formatCurrency(exp.current.afterTax)}）と比べた、1年間の見通しです。
            </p>

            <div className="overflow-x-auto mb-5">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="px-3 py-2 text-left font-medium">案</th>
                    <th className="px-3 py-2 text-right font-medium">売上の変化</th>
                    <th className="px-3 py-2 text-right font-medium">税引後の手残りの変化</th>
                    <th className="px-3 py-2 text-right font-medium">初期費用</th>
                    <th className="px-3 py-2 text-right font-medium">回収</th>
                  </tr>
                </thead>
                <tbody>
                  {exp.plans.map(p => (
                    <tr key={p.key} className="border-b align-top">
                      <td className="px-3 py-2">
                        <div className="font-medium">{p.label}</div>
                        {p.addUnits > 0 && (
                          <div className="text-xs text-gray-400">
                            {p.unitCountAfter}台になります
                            {p.addHygienists > 0 && `／衛生士 +${p.addHygienists}人`}
                            {p.addAssistants > 0 && `／助手 +${p.addAssistants}人`}
                          </div>
                        )}
                        {p.warning && <div className="text-xs text-amber-700 mt-1">⚠️ {p.warning}</div>}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {p.revenueDiff >= 0 ? "+" : "−"}{formatCurrency(Math.abs(p.revenueDiff))}
                      </td>
                      <td className={`px-3 py-2 text-right font-bold ${
                        p.afterTaxDiff >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                        {p.afterTaxDiff >= 0 ? "+" : "−"}{formatCurrency(Math.abs(p.afterTaxDiff))}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-600">
                        {p.investment > 0 ? formatCurrency(p.investment) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-600">
                        {p.paybackMonths ? `${p.paybackMonths}ヶ月` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 台数ごとの手残り */}
            <div className="mb-4">
              <div className="text-sm font-bold text-gray-800 mb-2">台数を増やしていったときの手残り</div>
              <div className="space-y-1.5">
                {exp.curve.map(c => {
                  const max = Math.max(...exp.curve.map(x => Math.abs(x.afterTax)), 1);
                  const w = Math.max(2, (Math.abs(c.afterTax) / max) * 100);
                  const isCurrent = c.units === exp.current.unitCountAfter;
                  const down = c.afterTax < exp.current.afterTax;
                  return (
                    <div key={c.units} className="flex items-center gap-3">
                      <span className="w-12 shrink-0 text-xs text-gray-600 text-right">{c.units}台</span>
                      <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
                        <div className={`h-full rounded flex items-center justify-end pr-2 ${
                          isCurrent ? "bg-gray-500" : down ? "bg-red-400" : "bg-blue-500"}`}
                          style={{ width: `${w}%` }}>
                          <span className="text-[11px] font-bold text-white whitespace-nowrap">
                            {formatCurrency(c.afterTax)}
                          </span>
                        </div>
                      </div>
                      <span className="w-24 shrink-0 text-[11px] text-gray-400">
                        {isCurrent ? "現状" : c.specialExpense ? "特例あり" : "特例なし"}
                      </span>
                    </div>
                  );
                })}
              </div>
              {exp.recoveryUnits != null && exp.recoveryUnits > exp.current.unitCountAfter + 1 && (
                <p className="text-xs text-gray-600 mt-2">
                  一時的に手残りが下がっても、<span className="font-bold">{exp.recoveryUnits}台</span>まで進めば現状を上回ります。
                  途中の期間をどう乗り切るかも含めてご検討ください。
                </p>
              )}
            </div>

            <div className="text-xs text-gray-500 bg-amber-50 border border-amber-100 rounded-md p-3 leading-relaxed">
              <p className="font-medium text-amber-800 mb-1">この試算について</p>
              <p>
                1台あたりの売上は実績から推計しています（基準 {formatCurrency(exp.assumption.revenuePerUnitBase)}／
                {exp.assumption.baseUnitCount}台超の分 {formatCurrency(exp.assumption.revenuePerUnitMarginal)}）。
                税額は所得税・住民税の概算で、所得控除や事業税は含んでいません。
                <span className="font-medium">実際の税額は税理士にご確認ください。</span>
              </p>
              {data.expansionNote && <p className="mt-1">{data.expansionNote}</p>}
              {!data.staffRatesConfigured && (
                <p className="mt-1">職種別の人件費が未設定のため、一般的な水準で試算しています。下の設定から登録すると精度が上がります。</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
