"use client";

import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { saveClinicId } from "@/lib/selected-clinic";

interface ClinicInfo { id: string; clinicName: string; }

/**
 * 画面上部の共通ヘッダー
 *
 * 医院の切り替えをここに置いている。複数の医院を扱うとき、
 * 「いまどの医院を見ているか」が常に見えていないと、別の医院の数字を
 * 自院のものと取り違える恐れがあるため。
 *
 * 切り替えるとCookieに保存し、画面を読み込み直す。
 * 医院一覧APIが選択中の医院を先頭に返すので、全画面がその医院に切り替わる。
 */
export function Header() {
  const { data: session } = useSession();
  const [clinics, setClinics] = useState<ClinicInfo[]>([]);
  const [currentId, setCurrentId] = useState("");
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    fetch("/api/clinics")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setClinics(data);
          // APIが選択中の医院を先頭に返すため、先頭が現在の医院
          setCurrentId(data[0].id);
        }
      })
      .catch(() => {});
  }, []);

  const handleChange = (clinicId: string) => {
    if (!clinicId || clinicId === currentId) return;
    setSwitching(true);
    saveClinicId(clinicId);
    // 全画面に反映させるため読み込み直す
    window.location.reload();
  };

  const current = clinics.find((c) => c.id === currentId);

  return (
    <header className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-3 pl-10 lg:pl-0 min-w-0">
        {clinics.length > 1 ? (
          <>
            <label htmlFor="clinic-switcher" className="text-xs text-gray-400 shrink-0 hidden sm:inline">
              医院
            </label>
            <select
              id="clinic-switcher"
              className="border border-gray-300 rounded-md px-2 py-1 text-sm font-medium text-gray-800 max-w-[16rem] disabled:opacity-60"
              value={currentId}
              disabled={switching}
              onChange={(e) => handleChange(e.target.value)}
            >
              {clinics.map((c) => (
                <option key={c.id} value={c.id}>{c.clinicName}</option>
              ))}
            </select>
            {switching && <span className="text-xs text-gray-400 shrink-0">切り替えています...</span>}
          </>
        ) : (
          current && (
            <span className="text-sm font-medium text-gray-700 truncate max-w-[200px]">
              {current.clinicName}
            </span>
          )
        )}
      </div>
      <div className="flex items-center gap-2 md:gap-4">
        {session?.user?.name && (
          <span className="text-sm text-gray-500 hidden sm:inline">{session.user.name}</span>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          ログアウト
        </Button>
      </div>
    </header>
  );
}
