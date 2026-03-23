"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: "/dashboard",
      });

      console.log("signIn result:", JSON.stringify(result));

      if (result?.error) {
        setError("メールアドレスまたはパスワードが正しくありません");
      } else if (result?.ok) {
        // 認証成功 - ダッシュボードへ
        window.location.href = "/dashboard";
      } else if (result?.url) {
        // リダイレクトURLがある場合
        window.location.href = result.url;
      } else {
        // フォールバック
        window.location.href = "/dashboard";
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("ログインに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">ログイン</h2>

      {registered && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm">
          アカウントが作成されました。ログインしてください。
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="email">メールアドレス</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            required
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="password">パスワード</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="パスワード"
            required
            className="mt-1"
          />
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "ログイン中..." : "ログイン"}
        </Button>
      </form>

      <div className="mt-6 text-center text-sm text-gray-600">
        アカウントをお持ちでない方は{" "}
        <Link href="/register" className="text-blue-600 hover:underline font-medium">
          新規登録
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center justify-center gap-2">
            <span>🦷</span> 歯科経営ダッシュボード
          </h1>
          <p className="mt-2 text-gray-600">医院の経営を見える化し、改善アクションまで提案</p>
        </div>

        <Suspense fallback={<div className="bg-white rounded-xl shadow-lg p-8 text-center text-gray-500">読み込み中...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
