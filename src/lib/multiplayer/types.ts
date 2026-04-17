import type { Timestamp } from "firebase/firestore";

/** 5 文字・英大文字と数字（紛らわしい文字は roomCode で除外） */
export type RoomCode = string;

export type HandMode = "seven" | "unlimited";

export type RoomStatus = "lobby" | "playing" | "finished";

export type PlayerRoomPhase = "lobby" | "playing" | "done";

export type MultiplayerPlayerState = {
  displayName: string;
  /** ロビー参加順（同時刻タイブレ用の便宜） */
  joinedAtMs: number;
  phase: PlayerRoomPhase;
  /**
   * 残り手数。無制限モードは -1（表示は ∞）。
   * 7 手モードは正の整数。
   */
  remainingAttempts: number;
  /** 確定した回答回数（正解・不正解・タイムアウトいずれも 1 回として加算） */
  guessCount: number;
  rank: number | null;
  clearTimeMs: number | null;
  finishedAt: Timestamp | null;
};

export type MultiplayerRoomDoc = {
  roomName: string;
  hostUid: string;
  isPublic: boolean;
  /** 空文字ならロックなし */
  joinPassword: string;
  maxPlayers: number;
  handMode: HandMode;
  /** 仕様固定 30 秒（将来の拡張用に保持） */
  turnSeconds: number;
  status: RoomStatus;
  targetCharacterName: string | null;
  gameStartedAt: Timestamp | null;
  /** ホストが「もう一度」でインクリメント。クライアントがローカルタイマーをリセットするのに使う */
  sessionSeq: number;
  /** 次に割り当てる順位（1 始まり） */
  nextRank: number;
  playerStates: Record<string, MultiplayerPlayerState>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
