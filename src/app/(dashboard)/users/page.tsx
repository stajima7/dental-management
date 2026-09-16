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
  token: string;
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
  // 文言に「失敗」が含まれるかで色を決めていたため、失敗の案内が緑色で出ていた
  const [messageError, setMessageError] = useState(false);
  // 作成直後の仮パスワード。再表示できないため、画面に出したままにする
  const [createdAccount, setCreatedAccount] = useState<{ email: string; tempPassword: string } | null>(null);
  // 1医院あたりの人数の上限（サーバー側で数えた値をそのまま使う）
  const [limit, setLimit] = useState(0);
  const [used, setUsed] = useState(0);
  // 発行した招待URL。メールを送る仕組みが無いため、画面から手渡しで伝えてもらう
  const [invited, setInvited] = useState<{ email: string; url: string } | null>(null);

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
        setLimit(data.limit || 0);
        setUsed(data.used || 0);
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  const inviteUrlOf = (token: string) =>
    typeof window !== "undefined" ? `${window.location.origin}/register?token=${token}` : `/register?token=${token}`;

  // createIfMissing: 本人での登録が難しい場合だけ true（仮パスワードを発行する）
  const invite = async (createIfMissing = false, emailArg?: string) => {
    const email = emailArg || inviteEmail;
    if (!email) return;
    setMessage("");
    setMessageError(false);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicId, email, role: inviteRole, createIfMissing }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        // 招待URLと仮パスワードは、それぞれ発行したときだけ返る
        setInvited(data.token ? { email: data.email, url: inviteUrlOf(data.token) } : null);
        setCreatedAccount(data.tempPassword ? { email: data.email, tempPassword: data.tempPassword } : null);
        setInviteEmail("");
        setShowInvite(false);
        loadUsers(clinicId);
      } else {
        setMessage(data.error || "追加に失敗しました");
        setMessageError(true);
      }
    } catch {
      setMessage("追加に失敗しました");
      setMessageError(true);
    }
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

  const toggleActive = async (user: UserInfo) => {
    const label = user.name || user.email;
    const ok = user.isActive
      ? confirm(`${label}さんのこの医院での利用を停止しますか？

停止するとすぐに、この医院のデータを見ることも操作することもできなくなります（他の医院での利用には影響しません）。あとで「有効化」で戻せます。`)
      : confirm(`${label}さんのこの医院での利用を再開しますか？`);
    if (!ok) return;
    setMessage("");
    setMessageError(false);
    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicId, userId: user.id, isActive: !user.isActive }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(user.isActive ? `${label}さんのこの医院での利用を停止しました。` : `${label}さんのこの医院での利用を再開しました。`);
      } else {
        setMessage(data.error || "更新に失敗しました");
        setMessageError(true);
      }
      loadUsers(clinicId);
    } catch {
      setMessage("更新に失敗しました");
      setMessageError(true);
    }
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

  // 管理者アカウントは枠に含めないため、人数はサーバーが数えた値を使う
  const isFull = limit > 0 && used >= limit;

  if (loading) return <div className="animate-pulse space-y-4"><div className="h-8 bg-gray-200 rounded w-32" /><div className="h-64 bg-gray-200 rounded" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">ユーザー管理</h1>
        <div className="flex items-center gap-3">
          <Button onClick={() => setShowInvite(!showInvite)} disabled={isFull}>利用者を追加</Button>
        </div>
      </div>

      {isFull && (
        <div className="px-4 py-3 rounded text-sm bg-amber-50 text-amber-800 border border-amber-200">
          この医院の登録枠（{limit}名）を使い切っています。新しい方を追加するには、下の一覧で使わなくなったアカウントを「除外」してください。
        </div>
      )}

      {message && (
        <div className={`px-4 py-3 rounded text-sm ${messageError ? "bg-red-50 text-red-700 border border-red-200" : "bg-green-50 text-green-700 border border-green-200"}`}>{message}</div>
      )}

      {invited && (
        <Card className="border-blue-300">
          <CardHeader><CardTitle>招待URLを発行しました</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700">
              下のURLを <span className="font-medium">{invited.email}</span> のご本人にお伝えください。
              このURLからご自身でパスワードを決めて登録していただくと、この医院を見られるようになります。
            </p>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs bg-gray-50 border rounded px-2 py-1 break-all">{invited.url}</span>
              <Button size="sm" variant="ghost" onClick={() => navigator.clipboard?.writeText(invited.url)}>コピー</Button>
            </div>
            <p className="mt-3 text-xs text-gray-500">
              有効期限は7日間です。URLは下の「招待中」からいつでも取り出せます。
            </p>
            <p className="mt-4 text-sm text-gray-600">
              ご本人での登録が難しい場合は、こちらでアカウントを作り、仮パスワードをお伝えすることもできます。
            </p>
            <div className="mt-2">
              <Button size="sm" variant="ghost" onClick={() => invite(true, invited.email)}>仮パスワードを発行して作成する</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {createdAccount && (
        <Card className="border-amber-300">
          <CardHeader><CardTitle>仮パスワード（この画面を閉じると二度と表示できません）</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div><span className="text-gray-500 w-32 inline-block">メールアドレス</span><span className="font-mono">{createdAccount.email}</span></div>
              <div><span className="text-gray-500 w-32 inline-block">仮パスワード</span><span className="font-mono text-lg font-bold tracking-wider">{createdAccount.tempPassword}</span></div>
            </div>
            <p className="mt-3 text-sm text-gray-600">
              本人にお伝えください。初回ログイン時に、ご本人によるパスワード変更が必須になります。
            </p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => navigator.clipboard?.writeText(`メールアドレス: ${createdAccount.email}
仮パスワード: ${createdAccount.tempPassword}`)}>コピー</Button>
              <Button size="sm" variant="ghost" onClick={() => setCreatedAccount(null)}>閉じる</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showInvite && (
        <Card>
          <CardHeader><CardTitle>利用者を追加</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-3">
              未登録のアドレスなら<strong>招待URLを発行</strong>します。ご本人がそのURLからご自身でパスワードを決めて登録すると、
              この医院を見られるようになります（パスワードは管理者にも分かりません）。<br />
              既に登録済みのアドレスなら、そのままこの医院に追加します。
            </p>
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
              <div className="flex items-end"><Button onClick={() => invite(false)}>追加する</Button></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ユーザー一覧 */}
      <Card>
        <CardHeader>
          <CardTitle>
            所属ユーザー ({users.length}名)
            {limit > 0 && <span className="ml-2 text-sm font-normal text-gray-500">登録枠 {used} / {limit}名（招待中を含む）</span>}
          </CardTitle>
        </CardHeader>
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
                        <Button size="sm" variant="ghost" onClick={() => toggleActive(user)}>{user.isActive ? "停止" : "有効化"}</Button>
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
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => navigator.clipboard?.writeText(inviteUrlOf(inv.token))}>招待URLをコピー</Button>
                    <Button size="sm" variant="ghost" onClick={() => cancelInvitation(inv.id)}>取消</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
