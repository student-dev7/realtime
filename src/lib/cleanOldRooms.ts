import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getFirebaseAdminApp } from "@/lib/firebaseAdmin";

const ROOMS = "rooms";

/** デフォルト: 部屋作成からこの時間より古いドキュメントを削除対象にする */
export const DEFAULT_ROOM_MAX_AGE_HOURS = 6;

const BATCH_LIMIT = 500;

/**
 * `createdAt` が指定時間より古い `rooms` ドキュメントを削除（Admin SDK・ルール無視）。
 * 大量件数は 500 件ずつ繰り返し。
 */
export async function cleanOldRooms(options?: {
  maxAgeHours?: number;
}): Promise<{ deleted: number }> {
  const hoursRaw = options?.maxAgeHours ?? DEFAULT_ROOM_MAX_AGE_HOURS;
  const hours = Math.min(168, Math.max(1, Math.floor(hoursRaw)));

  const db = getFirestore(getFirebaseAdminApp());
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  const cutoffTs = Timestamp.fromDate(cutoff);

  let deleted = 0;

  for (;;) {
    const snap = await db
      .collection(ROOMS)
      .where("createdAt", "<", cutoffTs)
      .limit(BATCH_LIMIT)
      .get();

    if (snap.empty) break;

    const batch = db.batch();
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
    deleted += snap.size;

    if (snap.size < BATCH_LIMIT) break;
  }

  return { deleted };
}
