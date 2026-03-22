"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface UserInfo {
  id: string;
  name: string | null;
  email: string;
  isActive: boolean;
  clinicRole: string;
  createdAt: string;
}

interface InvitationInfo {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
}

const ROLE_LABELS: Record<string, string> = { ADMIN: "管理者", MEMBER: "メンバー", VIEWER: "閲覧者" };
const ROLE_COLORS: Record<string, string> = { ADMIN: "bg-red-100 text-red-700", MEMBER: "bg-blue-100 text-blue-700", VIEWER: "bg-gray-100 text-gray-700" };

export default function UsersPage() {
  const [clinicId, setClinicId] = useState("");
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [invitations, setInvitations] = useState<InvitationInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("MEMBER");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/clinics").then((r) => r.json()).then((data) => {
      if (Array.isArray(data) && data.length > 0) {
        setClinicId(data[0].id);
        loadUsers(data[0].id);
      } else setLoading(false);
    });
  }, []);

  const loadUsers = async (cid: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/users?clinicId=${cid}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        setInvitations(data.invitations || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  const invite = async () => {
    if (!inviteEmail) return;
    setMessage("");
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicId, email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        setInviteEmail("");
        setShowInvite(false);
        loadUsers(clinicId);
      } else {
        setMessage(data.error || "招待に失敗しました");
      }
    } catch { setMessage("招待に失敗しました"); }
  };

  const changeRole = async (userId: string, role: string) => {
    try {
      await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicId, userId, role }),
      });
      loadUsers(clinicId);
    } catch { /* ignore */ }
  };

  const toggleActive = async (userId: string, isActive: boolean) => {
    try {
      await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicId, userId, isActive: !isActive }),
      });
      loadUsers(clinicId);
    } catch { /* ignore */ }
  };

  const removeUser = async (userId: string) => {
    if (!confirm("このユーザーを医院から除外しますか？")) return;
    try {
      await fetch(`/api/users?clinicId=${clinicId}&userId=${userId}`, { method: "DELETE" });
      loadUsers(clinicId);
    } catch { /* ignore */ }
  };

  const cancelInvitation = async (invitationId: string) => {
    try {
      await fetch(`/api/users?clinicId=${clinicId}&invitationId=${invitationId}`, { method: "DELETE" });
      loadUsers(clinicId);
    } catch { /* ignore */ }
  };

  if (loading) return <div className="animate-pulse space-y-4"><div className="h-8 bg-gray-200 rounded w-32" /><div className="h-64 bg-gray-200 rounded" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">ユーザー管理</h1>
        <Button onClick={() => setShowInvite(!showInvite)}>ユーザー招待</Button>
      </div>

      {message && (
        <div className={`px-4 py-3 rounded text-sm ${message.includes("失敗") ? "bg-red-50 text-red-700 border border-red-200" : "bg-green-50 text-green-700 border border-green-200"}`}>{message}</div>
      )}

      {showInvite && (
        <Card>
          <CardHeader><CardTitle>ユーザー招待</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1"><Label>メールアドレス</Label><Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="user@example.com" /></div>
              <div className="w-40">
                <Label>権限</Label>
                <select className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                  <option value="ADMIN">管理者</option>
                  <option value="MEMBER">メンバー</option>
                  <option value="VIEWER">閲覧者</option>
                </select>
              </div>
              <div className="flex items-end"><Button onClick={invite}>招待</Button></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ユーザー一覧 */}
      <Card>
        <CardHeader><CardTitle>所属ユーザー ({users.length}名)</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="border-b bg-gray-50">
                <th className="px-4 py-2 text-left font-medium">名前</th>
                <th className="px-4 py-2 text-left font-medium">メール</th>
                <th className="px-4 py-2 text-center font-medium">権限</th>
                <th className="px-4 py-2 text-center font-medium">状態</th>
                <th className="px-4 py-2 text-center font-medium">操作</th>
              </tr></thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b">
                    <td className="px-4 py-2 font-medium">{user.name || "-"}</td>
                    <td className="px-4 py-2 text-gray-600">{user.email}</td>
                    <td className="px-4 py-2 text-center">
                      <select className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[user.clinicRole]}`} value={user.clinicRole} onChange={(e) => changeRole(user.id, e.target.value)}>
                        {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${user.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{user.isActive ? "有効" : "停止"}</span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex gap-1 justify-center">
                        <Button size="sm" variant="ghost" onClick={() => toggleActive(user.id, user.isActive)}>{user.isActive ? "停止" : "有効化"}</Button>
                        <Button size="sm" variant="ghost" onClick={() => removeUser(user.id)}>除外</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 招待中 */}
      {invitations.length > 0 && (
        <Card>
          <CardHeader><CardTitle>招待中 ({invitations.length}件)</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {invitations.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <span className="font-medium">{inv.email}</span>
                    <span className={`ml-2 inline-block px-2 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[inv.role]}`}>{ROLE_LABELS[inv.role]}</span>
                    <span className="ml-2 text-xs text-gray-500">期限: {new Date(inv.expiresAt).toLocaleDateString("ja-JP")}</span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => cancelInvitation(inv.id)}>取消</Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
