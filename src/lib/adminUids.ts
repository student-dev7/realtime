/**
 * デバッグ UI（DBG パネル・正解表示・チャットモデレーター等）を本番で有効にする UID。
 * カンマ区切りで追加: NEXT_PUBLIC_ADMIN_UIDS=uid1,uid2
 * 他人のチャット削除を許可する場合は firestore.rules の delete 条件も合わせて更新すること。
 */
/** 組み込み管理者 UID（空＝本番では誰も管理者にならない） */
const BUILTIN_ADMIN_UIDS = new Set<string>([]);

function adminUidsFromEnv(): Set<string> {
  const raw = process.env.NEXT_PUBLIC_ADMIN_UIDS ?? "";
  const next = new Set<string>();
  for (const part of raw.split(",")) {
    const t = part.trim();
    if (t.length > 0) next.add(t);
  }
  return next;
}

const envAdminUids = adminUidsFromEnv();

export function isAdminUid(uid: string | null | undefined): boolean {
  if (!uid) return false;
  if (BUILTIN_ADMIN_UIDS.has(uid)) return true;
  if (envAdminUids.has(uid)) return true;
  return false;
}
