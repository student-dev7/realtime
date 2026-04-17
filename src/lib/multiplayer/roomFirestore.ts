import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  type Firestore,
  type Unsubscribe,
} from "firebase/firestore";
import CHARACTERS from "@/data/characters.json";
import { pickRandomTarget } from "@/lib/guessUtils";
import type {
  HandMode,
  MultiplayerPlayerState,
  MultiplayerRoomDoc,
} from "./types";
import { generateRoomCode, isValidRoomCode } from "./roomCode";

const ROOMS = "rooms";
const MAX_LIST = 24;

function dbRooms(db: Firestore) {
  return collection(db, ROOMS);
}

function roomRef(db: Firestore, roomCode: string) {
  return doc(db, ROOMS, roomCode);
}

export function subscribeRoom(
  db: Firestore,
  roomCode: string,
  onData: (room: MultiplayerRoomDoc | null) => void,
  onError?: (e: Error) => void
): Unsubscribe {
  return onSnapshot(
    roomRef(db, roomCode),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData(snap.data() as MultiplayerRoomDoc);
    },
    (e) => onError?.(e instanceof Error ? e : new Error(String(e)))
  );
}

/** 公開ロビー一覧（クエリ 1 回 + クライアントで件数調整可） */
export async function listPublicLobbies(db: Firestore): Promise<
  { code: string; data: MultiplayerRoomDoc }[]
> {
  const q = query(
    dbRooms(db),
    where("isPublic", "==", true),
    where("status", "==", "lobby"),
    orderBy("createdAt", "desc"),
    limit(MAX_LIST)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    code: d.id,
    data: d.data() as MultiplayerRoomDoc,
  }));
}

export async function fetchRoom(
  db: Firestore,
  roomCode: string
): Promise<MultiplayerRoomDoc | null> {
  const snap = await getDoc(roomRef(db, roomCode));
  if (!snap.exists()) return null;
  return snap.data() as MultiplayerRoomDoc;
}

export async function createRoom(params: {
  db: Firestore;
  uid: string;
  displayName: string;
  roomName: string;
  isPublic: boolean;
  joinPassword: string;
  maxPlayers: number;
  handMode: HandMode;
}): Promise<string> {
  const {
    db,
    uid,
    displayName,
    roomName,
    isPublic,
    joinPassword,
    maxPlayers,
    handMode,
  } = params;

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

  for (let attempt = 0; attempt < 40; attempt++) {
    const code = generateRoomCode();
    if (!isValidRoomCode(code)) continue;
    try {
      const ref = roomRef(db, code);
      const snap = await getDoc(ref);
      if (snap.exists()) continue;
      await runTransaction(db, async (tx) => {
        const s = await tx.get(ref);
        if (s.exists()) {
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
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
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

export async function joinRoom(params: {
  db: Firestore;
  roomCode: string;
  uid: string;
  displayName: string;
  joinPassword: string;
}): Promise<void> {
  const { db, roomCode, uid, displayName, joinPassword } = params;
  const ref = roomRef(db, roomCode);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("ルームが見つかりません");
    const data = snap.data() as MultiplayerRoomDoc;
    if (data.status !== "lobby") {
      throw new Error("すでに試合が始まっているか終了しています");
    }
    if (data.joinPassword && data.joinPassword !== joinPassword.trim()) {
      throw new Error("パスワードが違います");
    }
    const ps = { ...data.playerStates };
    if (ps[uid]) {
      tx.update(ref, {
        [`playerStates.${uid}.displayName`]: displayName,
        updatedAt: serverTimestamp(),
      });
      return;
    }
    const n = Object.keys(ps).length;
    if (n >= data.maxPlayers) {
      throw new Error("定員に達しています");
    }
    const handMode = data.handMode;
    ps[uid] = {
      displayName,
      joinedAtMs: Date.now(),
      phase: "lobby",
      remainingAttempts: handMode === "seven" ? 7 : -1,
      guessCount: 0,
      rank: null,
      clearTimeMs: null,
      finishedAt: null,
    };
    tx.update(ref, {
      playerStates: ps,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function leaveLobby(params: {
  db: Firestore;
  roomCode: string;
  uid: string;
}): Promise<void> {
  const { db, roomCode, uid } = params;
  const ref = roomRef(db, roomCode);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const data = snap.data() as MultiplayerRoomDoc;
    if (data.status !== "lobby") {
      throw new Error("試合中は退室できません（ブラウザを閉じてください）");
    }
    if (data.hostUid === uid) {
      throw new Error("ホストは解散するか、他プレイヤーにホストを譲ってください");
    }
    const ps = { ...data.playerStates };
    delete ps[uid];
    tx.update(ref, {
      playerStates: ps,
      updatedAt: serverTimestamp(),
    });
  });
}

function pickTargetName(): string {
  const list = CHARACTERS as { name: string }[];
  return pickRandomTarget(list).name;
}

function resetPlayersForRound(
  ps: Record<string, MultiplayerPlayerState>,
  handMode: HandMode
): Record<string, MultiplayerPlayerState> {
  const next: Record<string, MultiplayerPlayerState> = {};
  for (const [k, v] of Object.entries(ps)) {
    next[k] = {
      ...v,
      phase: "playing",
      remainingAttempts: handMode === "seven" ? 7 : -1,
      guessCount: 0,
      rank: null,
      clearTimeMs: null,
      finishedAt: null,
    };
  }
  return next;
}

export async function hostStartGame(params: {
  db: Firestore;
  roomCode: string;
  hostUid: string;
}): Promise<void> {
  const { db, roomCode, hostUid } = params;
  const ref = roomRef(db, roomCode);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("ルームが見つかりません");
    const data = snap.data() as MultiplayerRoomDoc;
    if (data.hostUid !== hostUid) throw new Error("ホストのみ開始できます");
    if (data.status !== "lobby") throw new Error("すでに開始済みです");
    const n = Object.keys(data.playerStates).length;
    if (n < 2) throw new Error("参加者が2人以上いるときだけ開始できます");
    const target = pickTargetName();
    const playerStates = resetPlayersForRound(data.playerStates, data.handMode);
    tx.update(ref, {
      status: "playing",
      targetCharacterName: target,
      gameStartedAt: serverTimestamp(),
      sessionSeq: data.sessionSeq + 1,
      nextRank: 1,
      playerStates,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function hostPlayAgain(params: {
  db: Firestore;
  roomCode: string;
  hostUid: string;
}): Promise<void> {
  const { db, roomCode, hostUid } = params;
  const ref = roomRef(db, roomCode);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("ルームが見つかりません");
    const data = snap.data() as MultiplayerRoomDoc;
    if (data.hostUid !== hostUid) throw new Error("ホストのみ再開できます");
    if (data.status !== "finished") throw new Error("終了していません");
    const n = Object.keys(data.playerStates).length;
    if (n < 2) throw new Error("参加者が2人以上いるときだけ再開できます");
    const target = pickTargetName();
    const playerStates = resetPlayersForRound(data.playerStates, data.handMode);
    tx.update(ref, {
      status: "playing",
      targetCharacterName: target,
      gameStartedAt: serverTimestamp(),
      sessionSeq: data.sessionSeq + 1,
      nextRank: 1,
      playerStates,
      updatedAt: serverTimestamp(),
    });
  });
}

function countPlaced(states: Record<string, MultiplayerPlayerState>): number {
  return Object.values(states).filter((p) => p.rank != null).length;
}

function countPlaying(states: Record<string, MultiplayerPlayerState>): number {
  return Object.values(states).filter((p) => p.phase === "playing" && p.rank == null)
    .length;
}

function forceEndIfNeeded(
  states: Record<string, MultiplayerPlayerState>,
  data: MultiplayerRoomDoc
): {
  playerStates: Record<string, MultiplayerPlayerState>;
  status: MultiplayerRoomDoc["status"];
  nextRank: number;
} {
  const total = Object.keys(states).length;
  const placed = countPlaced(states);
  const playing = countPlaying(states);
  let nextRank = data.nextRank;
  let status: MultiplayerRoomDoc["status"] = data.status;
  if (
    total >= 2 &&
    playing === 1 &&
    placed >= total - 1 &&
    placed < total
  ) {
    const uidLast = Object.entries(states).find(
      ([, p]) => p.phase === "playing" && p.rank == null
    )?.[0];
    if (uidLast) {
      const p = states[uidLast]!;
      states[uidLast] = {
        ...p,
        phase: "done",
        rank: nextRank,
        clearTimeMs: null,
        finishedAt: Timestamp.now(),
      };
      nextRank += 1;
    }
  }
  if (countPlaced(states) >= total && total > 0) {
    status = "finished";
  }
  return { playerStates: states, status, nextRank };
}

export async function applyGuessResult(params: {
  db: Firestore;
  roomCode: string;
  uid: string;
  guessedName: string;
  kind: "correct" | "wrong";
}): Promise<void> {
  const { db, roomCode, uid, guessedName, kind } = params;
  const ref = roomRef(db, roomCode);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("ルームが見つかりません");
    const data = snap.data() as MultiplayerRoomDoc;
    if (data.status !== "playing") throw new Error("試合中ではありません");
    const target = data.targetCharacterName;
    if (!target) throw new Error("お題がありません");

    const states = { ...data.playerStates } as Record<
      string,
      MultiplayerPlayerState
    >;
    const me = states[uid];
    if (!me) throw new Error("ルームに参加していません");
    if (me.phase !== "playing" || me.rank != null) {
      throw new Error("すでに結果が確定しています");
    }

    const isCorrect =
      kind === "correct" && guessedName.trim() === target.trim();

    if (kind === "correct" && !isCorrect) {
      throw new Error("正解と一致しません");
    }
    if (kind === "wrong" && guessedName.trim() === target.trim()) {
      throw new Error("不正解として送信できません（正解です）");
    }

    let nextRank = data.nextRank;
    const handMode = data.handMode;
    const startedAt = data.gameStartedAt;

    if (isCorrect) {
      const t =
        startedAt instanceof Timestamp
          ? startedAt.toMillis()
          : Date.now();
      const clearTimeMs = Math.max(0, Date.now() - t);
      states[uid] = {
        ...me,
        guessCount: me.guessCount + 1,
        phase: "done",
        rank: nextRank,
        clearTimeMs,
        finishedAt: Timestamp.now(),
      };
      nextRank += 1;
    } else {
      const gc = me.guessCount + 1;
      if (handMode === "seven" && me.remainingAttempts > 0) {
        const rem = me.remainingAttempts - 1;
        if (rem <= 0) {
          states[uid] = {
            ...me,
            guessCount: gc,
            remainingAttempts: 0,
            phase: "done",
            rank: nextRank,
            clearTimeMs: null,
            finishedAt: Timestamp.now(),
          };
          nextRank += 1;
        } else {
          states[uid] = {
            ...me,
            guessCount: gc,
            remainingAttempts: rem,
          };
        }
      } else {
        states[uid] = {
          ...me,
          guessCount: gc,
        };
      }
    }

    const after = forceEndIfNeeded(states, {
      ...data,
      nextRank,
    });
    let finalStatus = after.status;
    if (finalStatus !== "finished" && countPlaced(after.playerStates) >= Object.keys(after.playerStates).length) {
      finalStatus = "finished";
    }

    tx.update(ref, {
      playerStates: after.playerStates,
      nextRank: after.nextRank,
      status: finalStatus,
      updatedAt: serverTimestamp(),
    });
  });
}

/** 30 秒タイムアウト: ミス 1 回（不正解と同様の手数消費） */
export async function applyTimeoutPenalty(params: {
  db: Firestore;
  roomCode: string;
  uid: string;
}): Promise<void> {
  await applyGuessResult({
    db: params.db,
    roomCode: params.roomCode,
    uid: params.uid,
    guessedName: "",
    kind: "wrong",
  });
}
