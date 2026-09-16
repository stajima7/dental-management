"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EMPLOYMENT_LABELS, PRACTITIONER_ROLES, ROLE_LABELS } from "@/lib/practitioner-analysis";

/**
 * 担当者（歯科医師・歯科衛生士）の名簿の編集
 *
 * 退職した人は「入力対象外」にすれば過去の実績が分析に残る。
 * 削除は過去の実績も消えるため、件数を示して確認を求める。
 */

export interface RosterPractitioner {
  id: string;
  name: string;
  role: string;
  employmentType: string;
  isDirector: boolean;
  isActive: boolean;
  statsCount: number;
}

export interface NewPractitioner {
  name: string;
  role: string;
  employmentType: string;
  isDirector: boolean;
}

export type RosterPatch = Partial<Pick<RosterPractitioner, "name" | "employmentType" | "isDirector" | "isActive">>;

export function RosterEditor({
  practitioners,
  onAdd,
  onUpdate,
  onDelete,
}: {
  practitioners: RosterPractitioner[];
  /** 失敗したときはエラー文を返す */
  onAdd: (p: NewPractitioner) => Promise<string | null>;
  onUpdate: (id: string, patch: RosterPatch) => void;
  onDelete: (id: string) => void;
}) {
  const [form, setForm] = useState<NewPractitioner>({ name: "", role: "DENTIST", employmentType: "FULLTIME", isDirector: false });
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError("氏名を入力してください"); return; }
    setAdding(true); setError("");
    const err = await onAdd({ ...form, isDirector: form.role === "DENTIST" && form.isDirector });
    if (err) setError(err);
    else setForm({ ...form, name: "", isDirector: false });
    setAdding(false);
  };

  const rename = (p: RosterPractitioner) => {
    const name = window.prompt("新しい氏名を入力してください", p.name);
    if (name != null && name.trim() && name.trim() !== p.name) onUpdate(p.id, { name: name.trim() });
  };

  const remove = (p: RosterPractitioner) => {
    const message = p.statsCount > 0
      ? `${p.name}さんを削除すると、登録済みの実績 ${p.statsCount}か月分も消え、元に戻せません。\n\n退職などで入力しなくなっただけなら「対象外にする」を使うと、過去の実績を残せます。\n\n本当に削除しますか？`
      : `${p.name}さんを名簿から削除しますか？`;
    if (window.confirm(message)) onDelete(p.id);
  };

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3 p-3 bg-gray-50 border rounded-md">
        <div className="flex-1 min-w-[10rem]">
          <label className="block text-xs font-medium text-gray-600 mb-1" htmlFor="new-name">氏名</label>
          <Input id="new-name" value={form.name} maxLength={50} placeholder="例：山田 太郎"
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1" htmlFor="new-role">職種</label>
          <select id="new-role" className="border border-gray-300 rounded-md px-2 py-2 text-sm bg-white"
            value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value, isDirector: false })}>
            {PRACTITIONER_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1" htmlFor="new-employment">雇用形態</label>
          <select id="new-employment" className="border border-gray-300 rounded-md px-2 py-2 text-sm bg-white"
            value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value })}>
            <option value="FULLTIME">{EMPLOYMENT_LABELS.FULLTIME}</option>
            <option value="PARTTIME">{EMPLOYMENT_LABELS.PARTTIME}</option>
          </select>
        </div>
        {form.role === "DENTIST" && (
          <label className="flex items-center gap-1.5 text-sm text-gray-700 pb-2">
            <input type="checkbox" checked={form.isDirector} onChange={(e) => setForm({ ...form, isDirector: e.target.checked })} />
            院長
          </label>
        )}
        <Button type="submit" disabled={adding}>{adding ? "追加中..." : "追加する"}</Button>
        {error && <p className="w-full text-sm text-red-600">{error}</p>}
      </form>

      {practitioners.length === 0 ? (
        <p className="text-sm text-gray-500">まだ登録されていません。上の欄から歯科医師・歯科衛生士を追加してください。</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-gray-600">
                <th className="px-3 py-2 text-left font-medium">氏名</th>
                <th className="px-3 py-2 text-left font-medium">職種</th>
                <th className="px-3 py-2 text-left font-medium">雇用形態</th>
                <th className="px-3 py-2 text-center font-medium">院長</th>
                <th className="px-3 py-2 text-center font-medium">入力</th>
                <th className="px-3 py-2 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {practitioners.map((p) => (
                <tr key={p.id} className={`border-b ${p.isActive ? "" : "bg-gray-50 text-gray-500"}`}>
                  <td className="px-3 py-2 font-medium whitespace-nowrap">
                    {p.name}
                    {p.statsCount > 0 && <span className="ml-2 text-[11px] font-normal text-gray-400">実績{p.statsCount}か月</span>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{ROLE_LABELS[p.role as keyof typeof ROLE_LABELS] ?? p.role}</td>
                  <td className="px-3 py-2">
                    <select aria-label={`${p.name}の雇用形態`} className="border border-gray-300 rounded-md px-2 py-1 text-sm bg-white"
                      value={p.employmentType} onChange={(e) => onUpdate(p.id, { employmentType: e.target.value })}>
                      <option value="FULLTIME">{EMPLOYMENT_LABELS.FULLTIME}</option>
                      <option value="PARTTIME">{EMPLOYMENT_LABELS.PARTTIME}</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {p.role === "DENTIST"
                      ? <input type="checkbox" aria-label={`${p.name}は院長`} checked={p.isDirector} onChange={(e) => onUpdate(p.id, { isDirector: e.target.checked })} />
                      : <span className="text-gray-300">－</span>}
                  </td>
                  <td className="px-3 py-2 text-center whitespace-nowrap">
                    {p.isActive
                      ? <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">入力対象</span>
                      : <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">対象外</span>}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => rename(p)}>名前を変更</Button>
                    <Button size="sm" variant="ghost" onClick={() => onUpdate(p.id, { isActive: !p.isActive })}>
                      {p.isActive ? "対象外にする" : "対象に戻す"}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(p)}>削除</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
