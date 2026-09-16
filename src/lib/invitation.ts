/**
 * 招待の発行と確認
 *
 * 新規登録は招待された人だけに限る。URLを知っていれば誰でもアカウントを
 * 作れる状態を避けるため、招待の合言葉（トークン）が無い登録は受け付けない。
 *
 * パスワードは招待された本人が決める。こちらが相手のパスワードを
 * 知っている状態を作らないための設計。
 */

import crypto from "crypto";
import prisma from "./prisma";

/** 招待の有効期間（日） */
export const INVITE_EXPIRY_DAYS = 7;

/** 推測できない合言葉を作る */
export function newInvitationToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function invitationExpiry(): Date {
  return new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
}

export interface ValidInvitation {
  id: string;
  clinicId: string;
  clinicName: string;
  email: string;
  role: string;
}

/**
 * 使える招待かを確かめる。使えない場合は null。
 * 「期限切れ」「使用済み」「存在しない」を区別して返さないのは、
 * 合言葉を総当たりされたときに手がかりを与えないため。
 */
export async function findValidInvitation(
  token: string | null | undefined
): Promise<ValidInvitation | null> {
  if (!token) return null;

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { clinic: { select: { clinicName: true } } },
  });

  if (!invitation) return null;
  if (invitation.accepted) return null;
  if (invitation.expiresAt.getTime() < Date.now()) return null;

  return {
    id: invitation.id,
    clinicId: invitation.clinicId,
    clinicName: invitation.clinic.clinicName,
    email: invitation.email,
    role: invitation.role,
  };
}
