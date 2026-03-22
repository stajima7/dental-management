"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
}

interface ClinicInfo { id: string; clinicName: string; }

type TabType = "insights" | "plans";

const CATEGORY_LABELS: Record<string, string> = { revenue: "売上", patient: "患者", cost: "コスト", productivity: "生産性", profit: "収益性", operation: "運営" };
const CATEGORY_COLORS: Record<string, string> = { revenue: "bg-blue-100 text-blue-700", patient: "bg-green-100 text-green-700", cost: "bg-red-100 text-red-700", productivity: "bg-purple-100 text-purple-700", profit: "bg-amber-100 text-amber-700", operation: "bg-gray-100 text-gray-700" };
const IMPACT_LABELS: Record<string, string> = { HIGH: "高", MEDIUM: "中", LOW: "低" };
const DIFFICULTY_LABELS: Record<string, string> = { HIGH: "難", MEDIUM: "中", LOW: "易" };
const STATUS_LABELS: Record<string, string> = { TODO: "未着手", IN_PROGRESS: "進行中", DONE: "完了", CANCELLED: "中止" };
const STATUS_COLORS: Record<string, string> = { TODO: "bg-gray-100 text-gray-700", IN_PROGRESS: "bg-blue-100 text-blue-700", DONE: "bg-green-100 text-green-700", CANCELLED: "bg-red-100 text-red-700" };

export default function ActionPage() {
  const [activeTab, setActiveTab] = useState<TabType>("insights");
  const [clinics, setClinics] = useState<ClinicInfo[]>([]);
  const [selectedClinicId, setSelectedClinicId] = useState("");
  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date(); now.setMonth(now.getMonth() - 1);
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [insights, setInsights] = useState<AiInsight[]>([]);
  const [plans, setPlans] = useState<ActionPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<ActionPlan | null>(null);
  const [formData, setFormData] = useState({ title: "", description: "", status: "TODO", dueDate: "", assignee: "", insightId: "" });

  useEffect(() => {
    fetch("/api/clinics").then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) { setClinics(data); if (data.length > 0) setSelectedClinicId(data[0].id); }
    });
  }, []);

  useEffect(() => {
    if (selectedClinicId) { loadInsights(); loadPlans(); }
  }, [selectedClinicId, yearMonth]);

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
    setFormData({ title: insight.title, description: insight.suggestion, status: "TODO", dueDate: "", assignee: "", insightId: insight.id });
    setEditingPlan(null);
    setShowForm(true);
    setActiveTab("plans");
  };

  const savePlan = async () => {
    try {
      if (editingPlan) {
        await fetch("/api/action", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingPlan.id, ...formData, dueDate: formData.dueDate || null }),
        });
      } else {
        await fetch("/api/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clinicId: selectedClinicId, ...formData, dueDate: formData.dueDate || null }),
        });
      }
      setShowForm(false);
      setEditingPlan(null);
      setFormData({ title: "", description: "", status: "TODO", dueDate: "", assignee: "", insightId: "" });
      loadPlans();
    } catch { /* ignore */ }
  };

  const editPlan = (plan: ActionPlan) => {
    setEditingPlan(plan);
    setFormData({
      title: plan.title, description: plan.description, status: plan.status,
      dueDate: plan.dueDate ? plan.dueDate.slice(0, 10) : "", assignee: plan.assignee || "",
      insightId: plan.insightId || "",
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
          { key: "insights" as TabType, label: `AI診断結果 (${insights.length})` },
          { key: "plans" as TabType, label: `改善アクション (${plans.length})` },
        ].map((tab) => (
          <button key={tab.key} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`} onClick={() => setActiveTab(tab.key)}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* AI診断結果タブ */}
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
            <Button onClick={() => { setShowForm(true); setEditingPlan(null); setFormData({ title: "", description: "", status: "TODO", dueDate: "", assignee: "", insightId: "" }); }}>
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
                        <p className="text-sm text-gray-600 mt-1">{plan.description}</p>
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
