"use client";

import { useCallback, useEffect, useState } from "react";
import { getFirestore } from "firebase/firestore";
import {
  createRoom,
  listPublicLobbies,
} from "@/lib/multiplayer/roomFirestore";
import type { HandMode, MultiplayerRoomDoc } from "@/lib/multiplayer/types";
import {
  ensureAnonymousSession,
  getFirebaseAuth,
} from "@/lib/firebaseClient";
import { normalizeRoomCodeInput } from "@/lib/multiplayer/roomCode";
import { validateDisplayName } from "@/lib/validateDisplayName";
import { GameRulesModal } from "@/components/GameRulesModal";
import { PlayerNameModal } from "@/components/PlayerNameModal";

const PLAYER_NAME_KEY = "genshinguesser-player-name";

export default function HomePage() {
  const [lobbies, setLobbies] = useState<
    { code: string; data: MultiplayerRoomDoc }[]
  >([]);
  const [listError, setListError] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);

  const [displayName, setDisplayName] = useState("");
  const [rulesOpen, setRulesOpen] = useState(false);
  const [nameModalOpen, setNameModalOpen] = useState(false);

  const [roomName, setRoomName] = useState("みんなでゲッサー");
  const [isPublic, setIsPublic] = useState(true);
  const [joinPassword, setJoinPassword] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [handMode, setHandMode] = useState<HandMode>("seven");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [joinErr, setJoinErr] = useState<string | null>(null);

  const [joinInput, setJoinInput] = useState("");
  const [joinPwd, setJoinPwd] = useState("");

  useEffect(() => {
    try {
      const s = localStorage.getItem(PLAYER_NAME_KEY);
      if (s) setDisplayName(s);
    } catch {
      /* ignore */
    }
  }, []);

  const nameCheck = validateDisplayName(displayName);

  const refreshList = useCallback(async () => {
    setListError(null);
    setLoadingList(true);
    try {
      await ensureAnonymousSession();
      const db = getFirestore(getFirebaseAuth().app);
      const rows = await listPublicLobbies(db);
      setLobbies(rows);
    } catch (e) {
      setListError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  const onCreate = async () => {
    setCreateError(null);
    const v = validateDisplayName(displayName);
    if (!v.ok) {
      setCreateError(v.error);
      setNameModalOpen(true);
      return;
    }
    setCreating(true);
    try {
      await ensureAnonymousSession();
      const auth = getFirebaseAuth();
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("ログインに失敗しました");
      const db = getFirestore(auth.app);
      const code = await createRoom({
        db,
        uid,
        displayName: v.name,
        roomName,
        isPublic,
        joinPassword,
        maxPlayers,
        handMode,
      });
      try {
        localStorage.setItem(PLAYER_NAME_KEY, v.name);
      } catch {
        /* ignore */
      }
      window.location.href = `/room/${code}`;
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  };

  const goJoinByCode = () => {
    const v = validateDisplayName(displayName);
    if (!v.ok) {
      setJoinErr(v.error);
      setNameModalOpen(true);
      return;
    }
    const code = normalizeRoomCodeInput(joinInput);
    if (code.length !== 5) {
      setJoinErr("部屋番号は5文字の英数字で入力してください");
      return;
    }
    setJoinErr(null);
    try {
      localStorage.setItem(PLAYER_NAME_KEY, v.name);
    } catch {
      /* ignore */
    }
    const q = joinPwd.trim() ? `?pwd=${encodeURIComponent(joinPwd.trim())}` : "";
    window.location.href = `/room/${code}${q}`;
  };

  const goPublicRoom = (code: string) => {
    const v = validateDisplayName(displayName);
    if (!v.ok) {
      setJoinErr(v.error);
      setNameModalOpen(true);
      return;
    }
    try {
      localStorage.setItem(PLAYER_NAME_KEY, v.name);
    } catch {
      /* ignore */
    }
    window.location.href = `/room/${code}`;
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-8 px-4 py-8 text-white">
      <GameRulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
      <PlayerNameModal
        open={nameModalOpen}
        onClose={() => setNameModalOpen(false)}
        initialName={displayName}
        onSaved={(name) => {
          setDisplayName(name);
          try {
            localStorage.setItem(PLAYER_NAME_KEY, name);
          } catch {
            /* ignore */
          }
        }}
      />

      <header>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#ece5d8]/55">
              Multi
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-[#ece5d8]">
              ルームで対戦
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-white/65">
              5桁の部屋番号で集まり、リアルタイムで対戦しよう。
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => setRulesOpen(true)}
              className="rounded-lg border border-[#ece5d8]/25 bg-[#0a0f1e]/90 px-2.5 py-1.5 text-xs font-medium text-[#ece5d8]/90 transition hover:border-[#ece5d8]/45"
            >
              ルール
            </button>
            <button
              type="button"
              onClick={() => setNameModalOpen(true)}
              className="rounded-lg border border-amber-500/35 bg-amber-950/30 px-2.5 py-1.5 text-xs font-medium text-amber-100/95 transition hover:border-amber-400/50"
            >
              名前変更
            </button>
          </div>
        </div>
        <p className="mt-4 text-sm text-amber-200/90">
          参加者が2人以上そろったら、ホストが「ゲーム開始」でプレイ画面に移ります。
        </p>
      </header>

      <section className="rounded-2xl border border-[#ece5d8]/20 bg-[#0d1324]/90 p-4">
        <h2 className="text-sm font-semibold text-[#ece5d8]">部屋番号で入室</h2>
        <p className="mt-2 text-xs text-white/50">
          入室前に右上の「名前変更」で表示名（2〜12文字）を設定してください。
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex-1 text-xs text-white/55">
            5桁コード
            <input
              value={joinInput}
              onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
              maxLength={8}
              placeholder="例: XJ79L"
              className="mt-1 w-full rounded-xl border border-[#ece5d8]/20 bg-[#0a0f1e] px-3 py-2 font-mono text-sm text-white outline-none"
            />
          </label>
          <label className="flex-1 text-xs text-white/55">
            パスワード（任意）
            <input
              type="password"
              value={joinPwd}
              onChange={(e) => setJoinPwd(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#ece5d8]/20 bg-[#0a0f1e] px-3 py-2 text-sm text-white outline-none"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={!nameCheck.ok}
          onClick={goJoinByCode}
          className="mt-3 w-full rounded-xl border border-emerald-500/40 bg-emerald-950/40 py-2.5 text-sm font-medium text-emerald-100 disabled:cursor-not-allowed disabled:opacity-45"
        >
          入室
        </button>
        {joinErr && (
          <p className="mt-2 text-xs text-rose-400">{joinErr}</p>
        )}
      </section>

      <section className="rounded-2xl border border-[#ece5d8]/20 bg-[#0d1324]/90 p-4">
        <h2 className="text-sm font-semibold text-[#ece5d8]">ルームを作成</h2>
        <label className="mt-3 block text-xs text-white/55">
          ルーム名
          <input
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[#ece5d8]/20 bg-[#0a0f1e] px-3 py-2 text-sm text-white outline-none"
          />
        </label>
        <label className="mt-3 flex items-center gap-2 text-sm text-white/80">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
          />
          公開一覧に載せる
        </label>
        <label className="mt-3 block text-xs text-white/55">
          合言葉（空ならなし）
          <input
            value={joinPassword}
            onChange={(e) => setJoinPassword(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[#ece5d8]/20 bg-[#0a0f1e] px-3 py-2 text-sm text-white outline-none"
          />
        </label>
        <label className="mt-3 block text-xs text-white/55">
          最大人数（2〜8）
          <input
            type="number"
            min={2}
            max={8}
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(Number(e.target.value))}
            className="mt-1 w-full rounded-xl border border-[#ece5d8]/20 bg-[#0a0f1e] px-3 py-2 text-sm text-white outline-none"
          />
        </label>
        <label className="mt-3 block text-xs text-white/55">
          手数
          <select
            value={handMode}
            onChange={(e) => setHandMode(e.target.value as HandMode)}
            className="mt-1 w-full rounded-xl border border-[#ece5d8]/20 bg-[#0a0f1e] px-3 py-2 text-sm text-white outline-none"
          >
            <option value="seven">7手まで</option>
            <option value="unlimited">無制限（∞）</option>
          </select>
        </label>
        <p className="mt-2 text-[0.7rem] text-white/45">
          1手あたり30秒の個人タイマー（端末ローカル）。タイムアウトはミス1回分としてサーバーにのみ送信します。
        </p>
        <button
          type="button"
          disabled={creating || !nameCheck.ok}
          onClick={() => void onCreate()}
          className="mt-4 w-full rounded-xl border border-amber-500/40 bg-amber-950/35 py-2.5 text-sm font-medium text-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {creating ? "作成中…" : "部屋を作成して入室"}
        </button>
        {createError && (
          <p className="mt-2 text-xs text-rose-400">{createError}</p>
        )}
      </section>

      <section className="rounded-2xl border border-[#ece5d8]/20 bg-[#0d1324]/90 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[#ece5d8]">公開ルーム</h2>
          <button
            type="button"
            onClick={() => void refreshList()}
            className="text-xs text-sky-300/90 underline"
          >
            更新
          </button>
        </div>
        {loadingList && (
          <p className="mt-3 text-sm text-white/45">読み込み中…</p>
        )}
        {listError && (
          <p className="mt-3 text-xs text-rose-400">{listError}</p>
        )}
        {!loadingList && lobbies.length === 0 && !listError && (
          <p className="mt-3 text-sm text-white/45">
            公開中のルームはありません。
          </p>
        )}
        <ul className="mt-3 space-y-2">
          {lobbies.map(({ code, data }) => (
            <li key={code}>
              <button
                type="button"
                onClick={() => goPublicRoom(code)}
                className="flex w-full items-center justify-between rounded-xl border border-[#ece5d8]/15 bg-[#0a0f1e]/80 px-3 py-2 text-left text-sm transition hover:border-[#ece5d8]/35"
              >
                <span className="font-medium text-[#ece5d8]">
                  {data.roomName}
                </span>
                <span className="font-mono text-amber-200/90">{code}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
