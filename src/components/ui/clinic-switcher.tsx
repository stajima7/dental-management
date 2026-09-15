"use client";

import { useState, useEffect } from "react";

/**
 * 医院の切替
 *
 * 管理者（SUPER_ADMIN）は所属していない医院も含めて全医院を扱えるため、
 * どの画面でも医院を切り替えられる必要がある。
 * 一部の画面には切替欄が無く、常に先頭の医院しか見られなかった。
 *
 * 画面ごとの状態管理には手を入れず、この部品が自分で一覧を取得する。
 * 医院が1つしかない利用者には何も表示しない（不要な選択肢を見せない）。
 */

interface ClinicInfo { id: string; clinicName: string; }

export function ClinicSwitcher({
  value,
  onChange,
}: {
  value: string;
  onChange: (clinicId: string) => void;
}) {
  const [clinics, setClinics] = useState<ClinicInfo[]>([]);

  useEffect(() => {
    fetch("/api/clinics")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setClinics(Array.isArray(d) ? d : []))
      .catch(() => setClinics([]));
  }, []);

  if (clinics.length <= 1) return null;

  return (
    <select
      className="border border-gray-300 rounded-md px-3 py-1.5 text-sm max-w-[14rem]"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="医院を切り替える"
    >
      {clinics.map((c) => (
        <option key={c.id} value={c.id}>{c.clinicName}</option>
      ))}
    </select>
  );
}
