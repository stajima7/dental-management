/**
 * 「いま見ている医院」を画面間で共有する
 *
 * 管理者は複数の医院を扱うため、どの画面でも同じ医院が表示されている必要がある。
 * 画面ごとに状態を持つと、ヘッダーで切り替えても他の画面に伝わらない。
 *
 * 選択をCookieに保存し、医院一覧API（/api/clinics）がその医院を先頭に並べ替えて返す。
 * 各画面は「一覧の先頭」を初期表示する作りなので、画面側に手を入れなくても
 * 切り替えが全画面へ反映される。
 */

export const CLINIC_COOKIE = "dental_selected_clinic";

/** 1年間保持する。医院を選び直すまで維持される */
const MAX_AGE = 60 * 60 * 24 * 365;

export function saveClinicId(clinicId: string): void {
  try {
    if (typeof document === "undefined") return;
    // SameSite=Lax で通常の遷移では送られる。機密情報ではないので Secure は必須にしない
    document.cookie = `${CLINIC_COOKIE}=${encodeURIComponent(clinicId)}; path=/; max-age=${MAX_AGE}; SameSite=Lax`;
  } catch {
    // 保存できなくても動作は継続する（その場合は先頭の医院が選ばれる）
  }
}

export function getSavedClinicId(): string | null {
  try {
    if (typeof document === "undefined") return null;
    const hit = document.cookie
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${CLINIC_COOKIE}=`));
    return hit ? decodeURIComponent(hit.slice(CLINIC_COOKIE.length + 1)) : null;
  } catch {
    return null;
  }
}

/**
 * 医院の一覧を、選択中の医院が先頭に来るよう並べ替える。
 * 選択された医院が一覧に無い場合（権限が外れた・削除された等）はそのまま返す。
 */
export function moveSelectedFirst<T extends { id: string }>(list: T[], selectedId: string | null | undefined): T[] {
  if (!selectedId) return list;
  const i = list.findIndex((c) => c.id === selectedId);
  if (i <= 0) return list;
  return [list[i], ...list.slice(0, i), ...list.slice(i + 1)];
}
