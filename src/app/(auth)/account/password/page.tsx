"use client";

import { useState } from "react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * パスワード変更ページ
 *
 * 管理者が仮パスワードで利用者を作成するため、本人が自分で変更できる場所が要る。
 * 仮パスワードのままの利用者は、中身の画面に入る前にここへ誘導される（middleware）。
 */
export default function ChangePasswordPage() {
  const { data: session } = useSession();
  const mustChange = (session?.user as { mustChangePassword?: boolean } | undefined)?.mustChangePassword;

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("新しいパスワードが確認用と一致しません");
      return;
    }
    if (newPassword.length < 8) {
      setError("新しいパスワードは8文字以上にしてください");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "パスワードの変更に失敗しました");
        setLoading(false);
        return;
      }
      // ログイン情報の中に「変更が必要」の印が残っているため、
      // 変更後は一度ログアウトして入り直してもらう。
      setDone(true);
      setTimeout(() => signOut({ callbackUrl: "/login" }), 2500);
    } catch {
      setError("パスワードの変更に失敗しました");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center justify-center gap-2">
            <span>🦷</span> 歯科経営ダッシュボード
          </h1>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">パスワードの変更</h2>
          {session?.user?.email && (
            <p className="text-sm text-gray-500 mb-6">{session.user.email}</p>
          )}

          {done ? (
            <div className="p-4 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm">
              パスワードを変更しました。<br />
              新しいパスワードでログインし直してください。ログイン画面へ移動します...
            </div>
          ) : (
            <>
              {mustChange && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-800 text-sm">
                  現在は管理者が発行した<strong>仮パスワード</strong>です。
                  ご自身だけが知るパスワードに変更してから、ご利用ください。
                </div>
              )}

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="current">現在のパスワード{mustChange ? "（仮パスワード）" : ""}</Label>
                  <Input
                    id="current"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className="mt-1"
                    autoComplete="current-password"
                  />
                </div>

                <div>
                  <Label htmlFor="new">新しいパスワード（8文字以上）</Label>
                  <Input
                    id="new"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="mt-1"
                    autoComplete="new-password"
                  />
                </div>

                <div>
                  <Label htmlFor="confirm">新しいパスワード（確認用）</Label>
                  <Input
                    id="confirm"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="mt-1"
                    autoComplete="new-password"
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "変更中..." : "パスワードを変更する"}
                </Button>
              </form>

              {!mustChange && (
                <div className="mt-6 text-center text-sm text-gray-600">
                  <Link href="/dashboard" className="text-blue-600 hover:underline font-medium">
                    ダッシュボードに戻る
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
