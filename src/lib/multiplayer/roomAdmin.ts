import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getFirebaseAdminApp } from "@/lib/firebaseAdmin";
import type { HandMode, MultiplayerPlayerState } from "./types";
import { generateRoomCode, isValidRoomCode } from "./roomCode";
import { MAX_TOTAL_ROOMS } from "./roomLimits";

const ROOMS = "rooms";

/**
 * 部屋総数が MAX_TOTAL_ROOMS 以上なら、作成 1 件分の空きができるまで古い `createdAt` 順に削除する。
 */
export async function ensureMaxRoomsBeforeCreate(): Promise<void> {
  const db = getFirestore(getFirebaseAdminApp());
  const maxTotal = MAX_TOTAL_ROOMS;

  for (;;) {
    const countSnap = await db.collection(ROOMS).count().get();
    const n = countSnap.data().count;
    if (n < maxTotal) return;

    const deleteCount = Math.min(500, n - maxTotal + 1);
    const qs = await db
      .collection(ROOMS)
      .orderBy("createdAt", "asc")
      .limit(deleteCount)
      .get();

    if (qs.empty) {
      return;
    }

    const batch = db.batch();
    for (const d of qs.docs) {
      batch.delete(d.ref);
    }
    await batch.commit();
  }
}

export async function createRoomWithAdmin(params: {
  uid: string;
  displayName: string;
  roomName: string;
  isPublic: boolean;
  joinPassword: string;
  maxPlayers: number;
  handMode: HandMode;
}): Promise<string> {
  const {
    uid,
    displayName,
    roomName,
    isPublic,
    joinPassword,
    maxPlayers,
    handMode,
  } = params;

  await ensureMaxRoomsBeforeCreate();

  const mp = Math.min(8, Math.max(2, Math.floor(maxPlayers)));
  const initial: MultiplayerPlayerState = {
    displayName,
    joinedAtMs: Date.now(),
    phase: "lobby",
    remainingAttempts: handMode === "seven" ? 7 : -1,
    guessCount: 0,
    rank: null,
    clearTimeMs: null,
    finishedAt: null,
  };

  const db = getFirestore(getFirebaseAdminApp());

  for (let attempt = 0; attempt < 40; attempt++) {
    const code = generateRoomCode();
    if (!isValidRoomCode(code)) continue;
    const ref = db.collection(ROOMS).doc(code);

    try {
      await db.runTransaction(async (tx) => {
        const s = await tx.get(ref);
        if (s.exists) {
          throw new Error("ROOM_TAKEN");
        }
        tx.set(ref, {
          roomName: roomName.trim().slice(0, 40) || "ルーム",
          hostUid: uid,
          isPublic,
          joinPassword: joinPassword.trim(),
          maxPlayers: mp,
          handMode,
          turnSeconds: 30,
          status: "lobby",
          targetCharacterName: null,
          gameStartedAt: null,
          sessionSeq: 0,
          nextRank: 1,
          playerStates: { [uid]: initial },
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
      return code;
    } catch (e) {
      if (e instanceof Error && e.message === "ROOM_TAKEN") continue;
      throw e;
    }
  }

  throw new Error("部屋番号の生成に失敗しました。もう一度お試しください。");
}
