"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "ダッシュボード", icon: "📊" },
  { href: "/import", label: "データ取込", icon: "📄" },
  { href: "/analysis/human", label: "ヒト分析", icon: "👥" },
  { href: "/analysis/equipment", label: "モノ分析", icon: "🏥" },
  { href: "/analysis/finance", label: "カネ分析", icon: "💰" },
  { href: "/costs", label: "コスト登録", icon: "📝" },
  { href: "/allocation", label: "配賦設定", icon: "⚖️" },
  { href: "/department", label: "部門別採算", icon: "📋" },
  { href: "/analysis/patient", label: "患者分析", icon: "🧑‍⚕️" },
  { href: "/action", label: "改善提案", icon: "🎯" },
  { href: "/users", label: "ユーザー管理", icon: "👤" },
  { href: "/master", label: "マスタ管理", icon: "🔧" },
  { href: "/settings", label: "医院設定", icon: "⚙️" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* モバイルハンバーガーボタン */}
      <button
        className="lg:hidden fixed top-3 left-3 z-50 p-2 bg-white rounded-md shadow-md border border-gray-200"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="メニュー"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {isOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* オーバーレイ（モバイル） */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/30 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* サイドバー */}
      <aside
        className={cn(
          "bg-white border-r border-gray-200 flex flex-col min-h-screen shrink-0 z-40",
          "fixed lg:static top-0 left-0 h-full transition-transform duration-200",
          "w-56 lg:w-56",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="p-4 border-b border-gray-200">
          <Link href="/dashboard" className="flex items-center gap-2 text-lg font-bold text-gray-900" onClick={() => setIsOpen(false)}>
            <span>🦷</span>
            <span className="text-sm">歯科経営ダッシュボード</span>
          </Link>
        </div>
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                pathname === item.href || pathname.startsWith(item.href + "/")
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
              onClick={() => setIsOpen(false)}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>
    </>
  );
}
