"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";
import { KPI_DEFINITIONS } from "@/lib/kpi-calculator";
import type { Opportunity } from "@/lib/improvement-simulator";

// 難易度のラベル(DIFFICULTY_LABELS)はAI診断結果と共通のものを下部で定義している
const DIFFICULTY_COLORS: Record<string, string> = {
  LOW: "bg-green-100 text-green-700",
  MEDIUM: "bg-yellow-100 text-yellow-700",
  HIGH: "bg-red-100 text-red-700",
};

interface AiInsight {
  id: string;
  category: string;
  area: string;
  title: string;
  description: string;
  cause: string;
  suggestion: string;
  expectedImpact: string;
  impact: string;
  difficulty: string;
  priority: number;
}

interface ActionPlan {
  id: string;
  clinicId: string;
  insightId: string | null;
  title: string;
  description: string;
  status: string;
  dueDate: string | null;
  assignee: string | null;
  createdAt: string;
  kpiCode: string | null;
  baselineValue: number | null;
  targetValue: number | null;
  resultValue: number | null;
  expectedImpact: number | null;
  startedAt: string | null;
  completedAt: string | null;
}

interface ClinicInfo { id: string; clinicName: string; }

type TabType = "simulation" | "insights" | "plans";

const CATEGORY_LABELS: Record<string, string> = { revenue: "売上", patient: "患者", cost: "コスト", productivity: "生産性", profit: "収益性", operation: "運営" };
const CATEGORY_COLORS: Record<string, string> = { revenue: "bg-blue-100 text-blue-700", patient: "bg-green-100 text-green-700", cost: "bg-red-100 text-red-700", productivity: "bg-purple-100 text-purple-700", profit: "bg-amber-100 text-amber-700", operation: "bg-gray-100 text-gray-700" };
const IMPACT_LABELS: Record<string, string> = { HIGH: "高", MEDIUM: "中", LOW: "低" };
const DIFFICULTY_LABELS: Record<string, string> = { HIGH: "難", MEDIUM: "中", LOW: "易" };

/** アクション作成フォームの初期値 */
const EMPTY_FORM = {
  title: "", description: "", status: "TODO", dueDate: "", assignee: "", insightId: "",
  kpiCode: "", baselineValue: "", targetValue: "", resultValue: "", expectedImpact: "",
};

/**
 * 目標を達成したか。
 * キャンセル率のように「低いほど良い」指標は目標以下で達成、
 * 自費率のように「高いほど良い」指標は目標以上で達成となるため、
 * KPI定義の higherIsBetter を見て判定を反転させる。
 */
function achieved(plan: { kpiCode: string | null; targetValue: number | null; resultValue: number | null }): boolean {
  if (plan.targetValue == null || plan.resultValue == null) return false;
  const def = plan.kpiCode ? KPI_DEFINITIONS[plan.kpiCode] : undefined;
  // KPIコードが無い手動作成のアクションは「高いほど良い」とみなす
  const higherIsBetter = def?.higherIsBetter ?? true;
  return higherIsBetter ? plan.resultValue >= plan.targetValue : plan.resultValue <= plan.targetValue;
}
const STATUS_LABELS: Record<string, string> = { TODO: "未着手", IN_PROGRESS: "進行中", DONE: "完了", CANCELLED: "中止" };
const STATUS_COLORS: Record<string, string> = { TODO: "bg-gray-100 text-gray-700", IN_PROGRESS: "bg-blue-100 text-blue-700", DONE: "bg-green-100 text-green-700", CANCELLED: "bg-red-100 text-red-700" };

export default function ActionPage() {
  const [activeTab, setActiveTab] = useState<TabType>("simulation");
  const [clinics, setClinics] = useState<ClinicInfo[]>([]);
  const [selectedClinicId, setSelectedClinicId] = useState("");
  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date(); now.setMonth(now.getMonth() - 1);
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [insights, setInsights] = useState<AiInsight[]>([]);
  const [plans, setPlans] = useState<ActionPlan[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<ActionPlan | null>(null);
  const [formData, setFormData] = useState({
    title: "", description: "", status: "TODO", dueDate: "", assignee: "", insightId: "",
    kpiCode: "", baselineValue: "", targetValue: "", resultValue: "", expectedImpact: "",
  });

  useEffect(() => {
    fetch("/api/clinics").then((r) => r.json()).then((data) => {
      if (Array.isArray(data) && data.length > 0) {
        setClinics(data);
        setSelectedClinicId(data[0].id);
        if (data[0].latestYearMonth) setYearMonth(data[0].latestYearMonth);
      }
    });
  }, []);

  const loadOpportunities = async () => {
    try {
      const res = await fetch(`/api/improvement?clinicId=${selectedClinicId}&yearMonth=${yearMonth}`);
      if (res.ok) { const data = await res.json(); setOpportunities(data.opportunities ?? []); }
    } catch { /* ignore */ }
  };

  const loadInsights = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ai?clinicId=${selectedClinicId}&yearMonth=${yearMonth}`);
      if (res.ok) { const data = await res.json(); setInsights(Array.isArray(data) ? data : []); }
    } catch { /* ignore */ }
    setLoading(false);
  };

  const loadPlans = async () => {
    try {
      const res = await fetch(`/api/action?clinicId=${selectedClinicId}`);
      if (res.ok) { const data = await res.json(); setPlans(Array.isArray(data) ? data : []); }
    } catch { /* ignore */ }
  };

  // 取得関数の宣言より後ろに置く（宣言前参照を避けるため）
  useEffect(() => {
    if (selectedClinicId) { loadInsights(); loadPlans(); loadOpportunities(); }
  }, [selectedClinicId, yearMonth]);

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      await fetch("/api/kpi", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clinicId: selectedClinicId, yearMonth }) });
      const res = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clinicId: selectedClinicId, yearMonth }) });
      if (res.ok) { const data = await res.json(); setInsights(Array.isArray(data) ? data : []); }
    } catch { /* ignore */ }
    setAnalyzing(false);
  };

  const createFromInsight = (insight: AiInsight) => {
    setFormData({
      ...EMPTY_FORM,
      title: insight.title, description: insight.suggestion, insightId: insight.id,
    });
    setEditingPlan(null);
    setShowForm(true);
    setActiveTab("plans");
  };

  const savePlan = async () => {
    try {
      // 数値項目はフォーム上は文字列で持つため、未入力はnull、入力済みは数値に変換する
      const num = (s: string) => (s === "" ? null : Number(s));
      const payload = {
        ...formData,
        dueDate: formData.dueDate || null,
        kpiCode: formData.kpiCode || null,
        baselineValue: num(formData.baselineValue),
        targetValue: num(formData.targetValue),
        resultValue: num(formData.resultValue),
        expectedImpact: num(formData.expectedImpact),
      };

      if (editingPlan) {
        await fetch("/api/action", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingPlan.id, ...payload }),
        });
      } else {
        await fetch("/api/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clinicId: selectedClinicId, ...payload }),
        });
      }
      setShowForm(false);
      setEditingPlan(null);
      setFormData(EMPTY_FORM);
      loadPlans();
    } catch { /* ignore */ }
  };

  const editPlan = (plan: ActionPlan) => {
    setEditingPlan(plan);
    setFormData({
      title: plan.title, description: plan.description, status: plan.status,
      dueDate: plan.dueDate ? plan.dueDate.slice(0, 10) : "", assignee: plan.assignee || "",
      insightId: plan.insightId || "",
      kpiCode: plan.kpiCode || "",
      baselineValue: plan.baselineValue?.toString() ?? "",
      targetValue: plan.targetValue?.toString() ?? "",
      resultValue: plan.resultValue?.toString() ?? "",
      expectedImpact: plan.expectedImpact?.toString() ?? "",
    });
    setShowForm(true);
  };

  const deletePlan = async (id: string) => {
    if (!confirm("このアクションプランを削除しますか？")) return;
    try {
      await fetch(`/api/action?id=${id}`, { method: "DELETE" });
      loadPlans();
    } catch { /* ignore */ }
  };

  const updateStatus = async (plan: ActionPlan, newStatus: string) => {
    try {
      await fetch("/api/action", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: plan.id, status: newStatus }),
      });
      loadPlans();
    } catch { /* ignore */ }
  };

  const highPriority = insights.filter((i) => i.priority >= 80);
  const mediumPriority = insights.filter((i) => i.priority >= 50 && i.priority < 80);
  const lowPriority = insights.filter((i) => i.priority < 50);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">AI経営診断・改善提案</h1>
        <div className="flex items-center gap-3 flex-wrap">
          {clinics.length > 1 && (
            <select className="border border-gray-300 rounded-md px-3 py-1.5 text-sm" value={selectedClinicId} onChange={(e) => setSelectedClinicId(e.target.value)}>
              {clinics.map((c) => <option key={c.id} value={c.id}>{c.clinicName}</option>)}
            </select>
          )}
          <input type="month" className="border border-gray-300 rounded-md px-3 py-1.5 text-sm" value={yearMonth} onChange={(e) => setYearMonth(e.target.value)} />
          <Button onClick={runAnalysis} disabled={analyzing}>{analyzing ? "分析中..." : "分析実行"}</Button>
        </div>
      </div>

      {/* タブ */}
      <div className="flex border-b border-gray-200">
        {[
          { key: "simulation" as TabType, label: `改善額シミュレーション (${opportunities.length})` },
          { key: "insights" as TabType, label: `AI診断結果 (${insights.length})` },
          { key: "plans" as TabType, label: `改善アクション (${plans.length})` },
        ].map((tab) => (
          <button key={tab.key} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`} onClick={() => setActiveTab(tab.key)}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* AI診断結果タブ */}
      {activeTab === "simulation" && (
        <div className="space-y-4">
          {opportunities.length === 0 ? (
            <Card>
              <CardContent>
                <p className="py-12 text-center text-gray-500">
                  改善余地のある項目はありません。すべての指標が目標値を達成しています。
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardContent>
                  <div className="py-2">
                    <p className="text-sm text-gray-600">改善余地の合計（月次・上限値）</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">
                      {formatCurrency(opportunities.reduce((s, o) => s + o.monthlyImpact, 0))}
                      <span className="text-base font-normal text-gray-500 ml-3">
                        年換算 {formatCurrency(opportunities.reduce((s, o) => s + o.monthlyImpact, 0) * 12)}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500 mt-3 leading-relaxed">
                      各項目は独立に試算しています。施策どうしが重複するため（例: チェアを埋めれば人件費率も下がる）、
                      <strong>合計は単純合算であり、実際の効果はこれより小さくなります</strong>。個別の金額を優先順位づけにお使いください。
                    </p>
                  </div>
                </CardContent>
              </Card>

              {opportunities.map((op, i) => (
                <Card key={op.code}>
                  <CardContent>
                    <div className="py-2">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">{i + 1}</span>
                          <h3 className="font-semibold text-gray-900">{op.title}</h3>
                          <span className={`inline-block px-1.5 py-0.5 rounded text-xs ${DIFFICULTY_COLORS[op.difficulty]}`}>
                            難易度: {DIFFICULTY_LABELS[op.difficulty]}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-green-700">＋{formatCurrency(op.monthlyImpact)}</p>
                          <p className="text-xs text-gray-500">月次／年換算 {formatCurrency(op.monthlyImpact * 12)}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-3 text-sm">
                        <span className="px-2 py-1 rounded bg-red-50 text-red-700 font-medium">現状 {op.current}</span>
                        <span className="text-gray-400">→</span>
                        <span className="px-2 py-1 rounded bg-green-50 text-green-700 font-medium">目標 {op.target}</span>
                      </div>

                      <p className="text-sm text-gray-700 mt-3">{op.problem}</p>
                      <div className="mt-3 p-3 rounded bg-blue-50">
                        <p className="text-xs font-medium text-blue-900 mb-1">打ち手</p>
                        <p className="text-sm text-blue-900">{op.suggestion}</p>
                      </div>

                      <Button
                        size="sm"
                        variant="secondary"
                        className="mt-3"
                        onClick={() => {
                          // 着手時点の値・目標値・想定効果を引き継ぎ、後から成果を測れるようにする
                          setFormData({
                            ...EMPTY_FORM,
                            title: op.title,
                            description: `${op.problem}\n\n【打ち手】${op.suggestion}`,
                            kpiCode: op.code,
                            baselineValue: parseFloat(op.current).toString(),
                            targetValue: parseFloat(op.target).toString(),
                            expectedImpact: Math.round(op.monthlyImpact).toString(),
                          });
                          setEditingPlan(null);
                          setShowForm(true);
                          setActiveTab("plans");
                        }}
                      >
                        アクションに追加
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </div>
      )}

      {activeTab === "insights" && (
        <>
          {loading && <p className="text-gray-500">読み込み中...</p>}
          {!loading && insights.length === 0 && (
            <Card><CardContent className="py-12 text-center text-gray-500">
              <p className="text-lg font-medium">分析結果がありません</p>
              <p className="text-sm mt-2">「分析実行」ボタンを押してAI診断を実行してください。</p>
            </CardContent></Card>
          )}

          {insights.length > 0 && (
            <>
              <div className="grid grid-cols-3 gap-4">
                <Card><CardContent className="pt-4"><div className="text-xs text-gray-500">重要度: 高</div><div className="text-2xl font-bold text-red-600">{highPriority.length}件</div></CardContent></Card>
                <Card><CardContent className="pt-4"><div className="text-xs text-gray-500">重要度: 中</div><div className="text-2xl font-bold text-amber-600">{mediumPriority.length}件</div></CardContent></Card>
                <Card><CardContent className="pt-4"><div className="text-xs text-gray-500">重要度: 低</div><div className="text-2xl font-bold text-green-600">{lowPriority.length}件</div></CardContent></Card>
              </div>

              {[
                { items: highPriority, title: "優先改善項目", color: "text-red-700", icon: "🔴" },
                { items: mediumPriority, title: "改善推奨項目", color: "text-amber-700", icon: "🟡" },
                { items: lowPriority, title: "良好な項目", color: "text-green-700", icon: "🟢" },
              ].map(({ items, title, color, icon }) => items.length > 0 && (
                <Card key={title}>
                  <CardHeader><CardTitle className={color}>{icon} {title}</CardTitle></CardHeader>
                  <CardContent><div className="space-y-3">
                    {items.map((insight) => (
                      <div key={insight.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between cursor-pointer" onClick={() => setExpandedId(expandedId === insight.id ? null : insight.id)}>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[insight.category] || "bg-gray-100 text-gray-700"}`}>{CATEGORY_LABELS[insight.category] || insight.category}</span>
                              <span className="text-xs text-gray-500">{insight.area}</span>
                              <div className="flex gap-1 ml-auto">
                                <span className={`inline-block px-1.5 py-0.5 rounded text-xs ${insight.impact === "HIGH" ? "bg-red-100 text-red-700" : insight.impact === "MEDIUM" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-600"}`}>影響: {IMPACT_LABELS[insight.impact] || insight.impact}</span>
                                <span className={`inline-block px-1.5 py-0.5 rounded text-xs ${insight.difficulty === "LOW" ? "bg-green-100 text-green-700" : insight.difficulty === "MEDIUM" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>難易度: {DIFFICULTY_LABELS[insight.difficulty] || insight.difficulty}</span>
                              </div>
                            </div>
                            <h3 className="font-medium text-gray-900">{insight.title}</h3>
                            <p className="text-sm text-gray-600 mt-1">{insight.description}</p>
                          </div>
                        </div>
                        {expandedId === insight.id && (
                          <div className="mt-4 space-y-3 border-t pt-3">
                            {insight.cause && <div><h4 className="text-sm font-medium text-gray-700 mb-1">原因仮説</h4><p className="text-sm text-gray-600">{insight.cause}</p></div>}
                            <div><h4 className="text-sm font-medium text-gray-700 mb-1">改善提案</h4><p className="text-sm text-gray-600">{insight.suggestion}</p></div>
                            {insight.expectedImpact && <div><h4 className="text-sm font-medium text-gray-700 mb-1">期待効果</h4><p className="text-sm text-gray-600">{insight.expectedImpact}</p></div>}
                            <div className="flex justify-end">
                              <Button size="sm" onClick={() => createFromInsight(insight)}>アクションプランに追加</Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div></CardContent>
                </Card>
              ))}
            </>
          )}
        </>
      )}

      {/* 改善アクションタブ */}
      {activeTab === "plans" && (
        <>
          <div className="flex justify-end">
            <Button onClick={() => { setShowForm(true); setEditingPlan(null); setFormData(EMPTY_FORM); }}>
              新規アクション追加
            </Button>
          </div>

          {/* フォーム */}
          {showForm && (
            <Card>
              <CardHeader><CardTitle>{editingPlan ? "アクション編集" : "新規アクション"}</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2"><Label>タイトル *</Label><Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} /></div>
                  <div className="md:col-span-2"><Label>説明 *</Label><textarea className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm min-h-[80px]" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} /></div>
                  <div>
                    <Label>ステータス</Label>
                    <select className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                      {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div><Label>期日</Label><Input type="date" value={formData.dueDate} onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })} /></div>
                  <div><Label>担当者</Label><Input value={formData.assignee} onChange={(e) => setFormData({ ...formData, assignee: e.target.value })} /></div>
                </div>

                <div className="mt-6 pt-4 border-t">
                  <p className="text-sm font-medium text-gray-700 mb-1">成果の測定</p>
                  <p className="text-xs text-gray-500 mb-3">
                    着手時の値と目標値を入れておくと、完了後に実績値と比べて効果を確認できます。改善額シミュレーションから起票した場合は自動で入ります。
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <Label>着手時の値</Label>
                      <Input type="number" step="0.1" value={formData.baselineValue} onChange={(e) => setFormData({ ...formData, baselineValue: e.target.value })} />
                    </div>
                    <div>
                      <Label>目標値</Label>
                      <Input type="number" step="0.1" value={formData.targetValue} onChange={(e) => setFormData({ ...formData, targetValue: e.target.value })} />
                    </div>
                    <div>
                      <Label>実績値</Label>
                      <Input type="number" step="0.1" value={formData.resultValue} onChange={(e) => setFormData({ ...formData, resultValue: e.target.value })} />
                    </div>
                    <div>
                      <Label>想定効果（月・円）</Label>
                      <Input type="number" value={formData.expectedImpact} onChange={(e) => setFormData({ ...formData, expectedImpact: e.target.value })} />
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex gap-2 justify-end">
                  <Button variant="ghost" onClick={() => { setShowForm(false); setEditingPlan(null); }}>キャンセル</Button>
                  <Button onClick={savePlan} disabled={!formData.title || !formData.description}>{editingPlan ? "更新" : "作成"}</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* プラン一覧 */}
          {plans.length === 0 && !showForm && (
            <Card><CardContent className="py-12 text-center text-gray-500">
              <p className="text-lg font-medium">アクションプランがありません</p>
              <p className="text-sm mt-2">AI診断結果からプランを作成するか、手動で追加してください。</p>
            </CardContent></Card>
          )}

          {plans.length > 0 && (
            <div className="space-y-3">
              {plans.map((plan) => (
                <Card key={plan.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[plan.status]}`}>{STATUS_LABELS[plan.status]}</span>
                          {plan.dueDate && <span className="text-xs text-gray-500">期日: {new Date(plan.dueDate).toLocaleDateString("ja-JP")}</span>}
                          {plan.assignee && <span className="text-xs text-gray-500">担当: {plan.assignee}</span>}
                        </div>
                        <h3 className="font-medium text-gray-900">{plan.title}</h3>
                        <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{plan.description}</p>

                        {(plan.baselineValue != null || plan.targetValue != null || plan.expectedImpact != null) && (
                          <div className="mt-3 p-3 rounded bg-gray-50">
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                              {plan.baselineValue != null && (
                                <span className="text-gray-600">着手時 <strong className="text-gray-900">{plan.baselineValue}</strong></span>
                              )}
                              {plan.targetValue != null && (
                                <>
                                  <span className="text-gray-400">→</span>
                                  <span className="text-gray-600">目標 <strong className="text-gray-900">{plan.targetValue}</strong></span>
                                </>
                              )}
                              {plan.resultValue != null && (
                                <>
                                  <span className="text-gray-400">→</span>
                                  <span className="text-gray-600">
                                    実績 <strong className={achieved(plan) ? "text-green-700" : "text-orange-700"}>{plan.resultValue}</strong>
                                    {achieved(plan) ? "（達成）" : "（未達）"}
                                  </span>
                                </>
                              )}
                              {plan.expectedImpact != null && (
                                <span className="text-gray-600">想定効果 <strong className="text-gray-900">月{formatCurrency(plan.expectedImpact)}</strong></span>
                              )}
                            </div>
                            {(plan.startedAt || plan.completedAt) && (
                              <div className="flex flex-wrap gap-x-4 mt-2 text-xs text-gray-500">
                                {plan.startedAt && <span>着手日: {new Date(plan.startedAt).toLocaleDateString("ja-JP")}</span>}
                                {plan.completedAt && <span>完了日: {new Date(plan.completedAt).toLocaleDateString("ja-JP")}</span>}
                                {plan.startedAt && plan.completedAt && (
                                  <span>所要 {Math.round((new Date(plan.completedAt).getTime() - new Date(plan.startedAt).getTime()) / 86400000)}日</span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {plan.status === "TODO" && <Button size="sm" variant="ghost" onClick={() => updateStatus(plan, "IN_PROGRESS")}>着手</Button>}
                        {plan.status === "IN_PROGRESS" && <Button size="sm" variant="ghost" onClick={() => updateStatus(plan, "DONE")}>完了</Button>}
                        <Button size="sm" variant="ghost" onClick={() => editPlan(plan)}>編集</Button>
                        <Button size="sm" variant="ghost" onClick={() => deletePlan(plan.id)}>削除</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
