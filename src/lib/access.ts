/**
 * 医院へのアクセス権の判定
 *
 * これまで各APIが prisma.clinicUser.findUnique を直接呼んで所属を確かめていたため、
 * 50か所に同じ判定が散らばり、「保存では確認しているが取得では確認していない」
 * といった漏れが生まれていた。判定をここに集約する。
 *
 * 階層:
 *   SUPER_ADMIN … システム全体の管理者。所属していない医院も横断して扱える
 *   それ以外     … ClinicUser に所属がある医院だけ
 *
 * ⚠️ SUPER_ADMIN は新規登録では付与されない（登録経路で付けると誰でも全医院を
 *    見られてしまう）。DBで明示的に設定する運用とする。
 */

import prisma from "./prisma";

export type ClinicRole = "ADMIN" | "MEMBER" | "VIEWER";

export interface ClinicAccess {
  /** その医院での役割。管理者が所属外の医院に入る場合は ADMIN 相当として扱う */
  role: ClinicRole;
  /** 所属ではなく管理者権限で通した場合に true（画面の表示や監査に使う） */
  viaSuperAdmin: boolean;
}

/** セッションから利用者IDを取り出す */
export function userIdOf(session: { user?: unknown } | null | undefined): string | undefined {
  const u = session?.user as { id?: string } | undefined;
  return u?.id || undefined;
}

/** システム全体の管理者か */
export async function isSuperAdmin(userId: string | undefined | null): Promise<boolean> {
  if (!userId) return false;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return user?.role === "SUPER_ADMIN";
}

/**
 * その医院を扱えるか。扱えない場合は null を返す。
 * 所属があればその役割を、無くても管理者なら ADMIN 相当を返す。
 */
export async function getClinicAccess(
  userId: string | undefined | null,
  clinicId: string | undefined | null
): Promise<ClinicAccess | null> {
  if (!userId || !clinicId) return null;

  const clinicUser = await prisma.clinicUser.findUnique({
    where: { userId_clinicId: { userId, clinicId } },
    select: { role: true },
  });
  if (clinicUser) {
    return { role: clinicUser.role as ClinicRole, viaSuperAdmin: false };
  }

  // 所属していなくても、管理者なら扱える
  if (await isSuperAdmin(userId)) {
    return { role: "ADMIN", viaSuperAdmin: true };
  }
  return null;
}

/**
 * 1医院あたりに登録できる利用者数の上限。
 *
 * システム全体の管理者（SUPER_ADMIN）は数に含めない。
 * 保守のために全医院へ所属しているだけで、医院側が使える枠を
 * 減らしてしまうのは筋が通らないため。
 */
export const MAX_CLINIC_USERS = 5;

/** その医院に登録済みの利用者数（管理者アカウントを除く） */
export async function countClinicMembers(clinicId: string): Promise<number> {
  return prisma.clinicUser.count({
    where: { clinicId, user: { role: { not: "SUPER_ADMIN" } } },
  });
}

/**
 * 枠の使用数。登録済みの利用者に加え、まだ使われていない招待も1名分として数える。
 * 招待を数えないと、上限を超える人数に招待URLを配れてしまい、
 * 登録の段になって初めて断られることになるため。
 */
export async function countClinicSlotsUsed(
  clinicId: string,
  /**
   * 数えない招待の宛先。
   * 発行済みの招待を仮パスワード発行に切り替えるとき、その招待は取り消される。
   * 数に入れたままだと、同じ相手の分を二重に数えて断ってしまう。
   */
  excludeEmail?: string
): Promise<number> {
  const [members, pendingInvites] = await Promise.all([
    countClinicMembers(clinicId),
    prisma.invitation.count({
      where: {
        clinicId,
        accepted: false,
        expiresAt: { gt: new Date() },
        ...(excludeEmail ? { email: { not: excludeEmail } } : {}),
      },
    }),
  ]);
  return members + pendingInvites;
}

/**
 * 閲覧できる医院のIDを返す。管理者は全医院。
 * 医院一覧や横断集計で使う。
 */
export async function accessibleClinicIds(userId: string | undefined | null): Promise<string[]> {
  if (!userId) return [];
  if (await isSuperAdmin(userId)) {
    const all = await prisma.clinic.findMany({ select: { id: true } });
    return all.map((c) => c.id);
  }
  const links = await prisma.clinicUser.findMany({
    where: { userId },
    select: { clinicId: true },
  });
  return links.map((l) => l.clinicId);
}
