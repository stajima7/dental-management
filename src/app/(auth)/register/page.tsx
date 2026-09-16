"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * 新規登録（招待された人だけ）
 *
 * 招待URLに含まれる合言葉を確かめてから登録画面を出す。
 * メールアドレスは招待された本人のものに固定し、パスワードだけご自身で決めていただく。
 */
function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [invitation, setInvitation] = useState<{ email: string; clinicName: string } | null>(null);
  const [checking, setChecking] = useState(true);
  const [inviteError, setInviteError] = useState("");

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setInviteError("ご登録には招待が必要です。管理者からお送りした招待URLからお手続きください。");
      setChecking(false);
      return;
    }
    fetch(`/api/invitations/${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) setInvitation(data);
        else setInviteError(data.error || "この招待は使えません");
      })
      .catch(() => setInviteError("招待の確認に失敗しました"))
      .finally(() => setChecking(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("パスワードが一致しません");
      return;
    }

    if (password.length < 8) {
      setError("パスワードは8文字以上にしてください");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // メールアドレスは招待されたものを使う（本人が書き換えられないようにする）
        body: JSON.stringify({ name, email: invitation?.email, password, confirmPassword, token }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "登録に失敗しました");
        return;
      }

      router.push("/login?registered=true");
    } catch {
      setError("登録に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 text-center text-gray-500">
        招待を確認しています...
      </div>
    );
  }

  if (!invitation) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">ご登録には招待が必要です</h2>
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-800 text-sm">
          {inviteError}
        </div>
        <div className="mt-6 text-center text-sm text-gray-600">
          既にアカウントをお持ちの方は{" "}
          <Link href="/login" className="text-blue-600 hover:underline font-medium">ログイン</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">新規登録</h2>
      <p className="text-sm text-gray-600 mb-6">
        <span className="font-medium text-gray-900">{invitation.clinicName}</span> へご招待されています。
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="email">メールアドレス</Label>
          <Input id="email" type="email" value={invitation.email} readOnly disabled className="mt-1 bg-gray-50" />
          <p className="mt-1 text-xs text-gray-500">招待されたメールアドレスです（変更できません）</p>
        </div>
        <div>
          <Label htmlFor="name">お名前 *</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="山田 太郎" required className="mt-1" />
        </div>
        <div>
          <Label htmlFor="password">パスワード *</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8文字以上" required className="mt-1" autoComplete="new-password" />
          <p className="mt-1 text-xs text-gray-500">ご自身でお決めください。管理者にも分かりません</p>
        </div>
        <div>
          <Label htmlFor="confirmPassword">パスワード確認 *</Label>
          <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="パスワード再入力" required className="mt-1" autoComplete="new-password" />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "登録中..." : "アカウントを作成"}
        </Button>
      </form>

      <div className="mt-6 text-center text-sm text-gray-600">
        既にアカウントをお持ちの方は{" "}
        <Link href="/login" className="text-blue-600 hover:underline font-medium">ログイン</Link>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center justify-center gap-2">
            <span>🦷</span> 歯科経営ダッシュボード
          </h1>
        </div>

        <Suspense fallback={<div className="bg-white rounded-xl shadow-lg p-8 text-center text-gray-500">読み込み中...</div>}>
          <RegisterForm />
        </Suspense>
      </div>
    </div>
  );
}
