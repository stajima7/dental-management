"use client";

import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function Header() {
  const { data: session } = useSession();
  const [clinicName, setClinicName] = useState("");

  useEffect(() => {
    fetch("/api/clinics")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setClinicName(data[0].clinicName);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <header className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-4 pl-10 lg:pl-0">
        {clinicName && (
          <span className="text-sm font-medium text-gray-700 truncate max-w-[200px]">{clinicName}</span>
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
