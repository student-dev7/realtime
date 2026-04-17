"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getFirestore } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import CHARACTERS from "@/data/characters.json";
import { GuessTileRow } from "@/components/GuessTileRow";
import { normalizeForSearch, type GuessCharacter } from "@/lib/guessUtils";
import {
  applyGuessResult,
  applyTimeoutPenalty,
  hostDeleteRoom,
  hostPlayAgain,
  hostStartGame,
  joinRoom,
  leaveLobby,
  subscribeRoom,
} from "@/lib/multiplayer/roomFirestore";
import type { MultiplayerRoomDoc } from "@/lib/multiplayer/types";
import {
  ensureAnonymousSession,
  getFirebaseAuth,
} from "@/lib/firebaseClient";
import { isAdminUid } from "@/lib/adminUids";
import { validateDisplayName } from "@/lib/validateDisplayName";
import { GameRulesModal } from "@/components/GameRulesModal";
import { PlayerNameModal } from "@/components/PlayerNameModal";

const PLAYER_NAME_KEY = "genshinguesser-player-name";

const NAME_REQUIRED_NOTICE = "名前を設定してください";

type Props = {
  roomCode: string;
  initialPassword: string;
};

export function MultiRoomClient(props: Props) {
  const { roomCode, initialPassword } = props;
  const list = CHARACTERS as GuessCharacter[];

  const [room, setRoom] = useState<MultiplayerRoomDoc | null>(null);
  const [roomExists, setRoomExists] = useState(true);
  const [myUid, setMyUid] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [joinPwd, setJoinPwd] = useState(initialPassword);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [nameGatePending, setNameGatePending] = useState<null | "join">(null);

  const [query, setQuery] = useState("");
  const [guesses, setGuesses] = useState<GuessCharacter[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [timerLeft, setTimerLeft] = useState(30);

  const timeoutLock = useRef(false);
  const pathname = usePathname();
  const router = useRouter();
  const inPlayRoute = Boolean(pathname?.endsWith("/play"));

  useEffect(() => {
    try {
      const s = localStorage.getItem(PLAYER_NAME_KEY);
      if (s) setPlayerName(s);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void ensureAnonymousSession();
    const auth = getFirebaseAuth();
    setMyUid(auth.currentUser?.uid ?? null);
    const unsub = onAuthStateChanged(auth, (u) => setMyUid(u?.uid ?? null));
    return () => unsub();
  }, []);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    void (async () => {
      await ensureAnonymousSession();
      const db = getFirestore(getFirebaseAuth().app);
      unsub = subscribeRoom(
        db,
        roomCode,
        (data) => {
          if (data === null) {
            setRoomExists(false);
            setRoom(null);
            return;
          }
          setRoomExists(true);
          setRoom(data);
        },
        (e) => setActionError(e.message)
      );
    })();
    return () => {
      unsub?.();
    };
  }, [roomCode]);

  /** 試合開始後はプレイ用 URL（/room/.../play）へ */
  useEffect(() => {
    if (!room) return;
    const q = typeof window !== "undefined" ? window.location.search : "";
    if (room.status === "playing" && pathname && !pathname.endsWith("/play")) {
      router.replace(`/room/${roomCode}/play${q}`);
    }
    if (room.status === "lobby" && pathname?.endsWith("/play")) {
      router.replace(`/room/${roomCode}${q}`);
    }
  }, [room?.status, roomCode, pathname, router]);

  const me = myUid && room ? room.playerStates[myUid] : undefined;
  const isHost = myUid != null && room?.hostUid === myUid;

  const onGoTop = useCallback(async () => {
    if (!room || !myUid) {
      router.push("/");
      return;
    }
    if (!isHost) {
      router.push("/");
      return;
    }
    setActionError(null);
    setBusy(true);
    try {
      await ensureAnonymousSession();
      const db = getFirestore(getFirebaseAuth().app);
      await hostDeleteRoom({ db, roomCode, hostUid: myUid });
      router.push("/");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [room, myUid, isHost, roomCode, router]);

  const targetChar = useMemo(() => {
    const name = room?.targetCharacterName;
    if (!name) return null;
    return list.find((c) => c.name === name) ?? null;
  }, [room?.targetCharacterName, list]);

  const myGuessCount = me?.guessCount ?? 0;

  const tryJoin = useCallback(
    async (nameFromModal?: string) => {
      if (!myUid || !room || room.status !== "lobby") return;
      const raw = nameFromModal ?? playerName;
      const nameCheck = validateDisplayName(raw, {
        ignoreBadSubstrings: isAdminUid(myUid),
      });
      if (!nameCheck.ok) {
        setJoinError(null);
        setNameGatePending("join");
        setNameModalOpen(true);
        return;
      }
      setJoinError(null);
      setBusy(true);
      try {
        const db = getFirestore(getFirebaseAuth().app);
        await joinRoom({
          db,
          roomCode,
          uid: myUid,
          displayName: nameCheck.name,
          joinPassword: joinPwd,
        });
        setPlayerName(nameCheck.name);
        try {
          localStorage.setItem(PLAYER_NAME_KEY, nameCheck.name);
        } catch {
          /* ignore */
        }
      } catch (e) {
        setJoinError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [myUid, room, roomCode, playerName, joinPwd]
  );

  const onNameModalClose = () => {
    setNameModalOpen(false);
    setNameGatePending(null);
  };

  const onPlayerNameSaved = (name: string) => {
    const pending = nameGatePending;
    setPlayerName(name);
    try {
      localStorage.setItem(PLAYER_NAME_KEY, name);
    } catch {
      /* ignore */
    }
    setNameModalOpen(false);
    setNameGatePending(null);
    if (!myUid) return;
    const v = validateDisplayName(name, {
      ignoreBadSubstrings: isAdminUid(myUid),
    });
    if (!v.ok) return;
    if (pending === "join") {
      void tryJoin(name);
    }
  };

  const onTimeout = useCallback(async () => {
    if (!myUid || !room || room.status !== "playing") return;
    const p = room.playerStates[myUid];
    if (!p || p.phase !== "playing" || p.rank != null) return;
    if (timeoutLock.current) return;
    timeoutLock.current = true;
    setActionError(null);
    try {
      const db = getFirestore(getFirebaseAuth().app);
      await applyTimeoutPenalty({ db, roomCode, uid: myUid });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      timeoutLock.current = false;
    }
  }, [myUid, room, roomCode]);

  useEffect(() => {
    if (!room || room.status !== "playing" || !myUid) return;
    if (!pathname?.endsWith("/play")) return;
    const p = room.playerStates[myUid];
    if (!p || p.phase !== "playing" || p.rank != null) return;

    let left = room.turnSeconds ?? 30;
    setTimerLeft(left);
    const id = window.setInterval(() => {
      left -= 1;
      setTimerLeft(left);
      if (left <= 0) {
        window.clearInterval(id);
        void onTimeout();
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [
    room?.sessionSeq,
    room?.status,
    myUid,
    myGuessCount,
    onTimeout,
    room?.turnSeconds,
    pathname,
  ]);

  useEffect(() => {
    setGuesses([]);
    setQuery("");
    setMessage(null);
  }, [room?.sessionSeq]);

  const iAmDone = me?.rank != null;

  const suggestions = useMemo(() => {
    const qRaw = query.trim();
    if (!qRaw) return [] as GuessCharacter[];
    const q = normalizeForSearch(qRaw);
    return list.filter((c) => {
      const nameNorm = normalizeForSearch(c.name);
      const anyC = c as unknown as { nameHira?: string };
      const nameHiraNorm = normalizeForSearch(anyC.nameHira ?? "");
      return (
        (nameNorm.includes(q) || nameHiraNorm.includes(q)) &&
        !guesses.some((g) => g.name === c.name)
      );
    });
  }, [query, guesses, list]);

  const submitPick = async (c: GuessCharacter) => {
    if (!room || !myUid || !targetChar || room.status !== "playing") return;
    if (iAmDone) return;
    if (guesses.some((g) => g.name === c.name)) {
      setMessage("すでに試したキャラです");
      return;
    }
    setMessage(null);
    setBusy(true);
    setActionError(null);
    try {
      const db = getFirestore(getFirebaseAuth().app);
      const correct = c.name === targetChar.name;
      await applyGuessResult({
        db,
        roomCode,
        uid: myUid,
        guessedName: c.name,
        kind: correct ? "correct" : "wrong",
      });
      setGuesses((g) => [c, ...g]);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onStart = async () => {
    if (!myUid || !isHost) return;
    setBusy(true);
    setActionError(null);
    try {
      const db = getFirestore(getFirebaseAuth().app);
      await hostStartGame({ db, roomCode, hostUid: myUid });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onAgain = async () => {
    if (!myUid || !isHost) return;
    setBusy(true);
    setActionError(null);
    try {
      const db = getFirestore(getFirebaseAuth().app);
      await hostPlayAgain({ db, roomCode, hostUid: myUid });
      setGuesses([]);
      setQuery("");
      setMessage(null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onLeave = async () => {
    if (!myUid) return;
    setBusy(true);
    try {
      const db = getFirestore(getFirebaseAuth().app);
      await leaveLobby({ db, roomCode, uid: myUid });
      window.location.href = "/";
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!roomExists) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-rose-300">ルームが見つかりません。</p>
        <Link href="/" className="text-sky-300 underline">
          トップへ
        </Link>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[#ece5d8]">
        接続中…
      </div>
    );
  }

  if (!myUid) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[#ece5d8]">
        ログイン準備中…
      </div>
    );
  }

  const showSuggest =
    query.trim().length > 0 &&
    suggestions.length > 0 &&
    room.status === "playing" &&
    inPlayRoute &&
    !iAmDone;

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 px-4 py-6 text-white">
      <GameRulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
      <PlayerNameModal
        open={nameModalOpen}
        onClose={onNameModalClose}
        initialName={playerName}
        onSaved={onPlayerNameSaved}
        notice={nameGatePending ? NAME_REQUIRED_NOTICE : undefined}
        title={nameGatePending ? "表示名を設定" : undefined}
        description={
          nameGatePending
            ? "2〜12文字。保存すると参加が続行されます。"
            : undefined
        }
      />

      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-[#ece5d8]/15 pb-3">
        <div>
          <p className="font-mono text-lg font-semibold text-amber-200/95">
            {roomCode}
          </p>
          <p className="text-sm text-[#ece5d8]">{room.roomName}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={() => setRulesOpen(true)}
            className="rounded-lg border border-[#ece5d8]/25 bg-[#0a0f1e]/90 px-2.5 py-1.5 text-xs font-medium text-[#ece5d8]/90 transition hover:border-[#ece5d8]/45"
          >
            ルール
          </button>
          <button
            type="button"
            onClick={() => {
              setNameGatePending(null);
              setNameModalOpen(true);
            }}
            className="rounded-lg border border-amber-500/35 bg-amber-950/30 px-2.5 py-1.5 text-xs font-medium text-amber-100/95 transition hover:border-amber-400/50"
          >
            名前変更
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onGoTop()}
            className="text-xs text-sky-300/90 underline disabled:opacity-50"
          >
            トップ
          </button>
        </div>
      </header>

      {actionError && (
        <p className="text-sm text-rose-400">{actionError}</p>
      )}

      {/* ロビー */}
      {room.status === "lobby" && !me && myUid && (
        <section className="space-y-3 rounded-2xl border border-amber-500/25 bg-[#0d1324]/90 p-4">
          <h2 className="text-sm font-semibold text-[#ece5d8]">ルームに参加</h2>
          <label className="block text-xs text-white/55">
            表示名
            <input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#ece5d8]/20 bg-[#0a0f1e] px-3 py-2 text-sm text-white outline-none"
            />
          </label>
          {room.joinPassword ? (
            <label className="block text-xs text-white/55">
              合言葉
              <input
                value={joinPwd}
                onChange={(e) => setJoinPwd(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#ece5d8]/20 bg-[#0a0f1e] px-3 py-2 text-sm text-white outline-none"
              />
            </label>
          ) : null}
          {joinError && (
            <p className="text-xs text-rose-400">{joinError}</p>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => void tryJoin()}
            className="w-full rounded-xl border border-emerald-500/40 bg-emerald-950/40 py-2.5 text-sm font-medium text-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            参加する
          </button>
        </section>
      )}

      {room.status === "lobby" && me && (
        <section className="space-y-3 rounded-2xl border border-[#ece5d8]/20 bg-[#0d1324]/90 p-4">
          <h2 className="text-sm font-semibold text-[#ece5d8]">参加者</h2>
          <ul className="space-y-1 text-sm">
            {Object.entries(room.playerStates).map(([uid, p]) => (
              <li key={uid}>
                {p.displayName}
                {uid === room.hostUid ? "（ホスト）" : ""}
              </li>
            ))}
          </ul>
          {isHost && (
            <button
              type="button"
              disabled={busy || Object.keys(room.playerStates).length < 2}
              onClick={() => void onStart()}
              className="w-full rounded-xl border border-emerald-500/40 bg-emerald-950/40 py-2.5 text-sm font-medium text-emerald-100 disabled:opacity-40"
            >
              ゲーム開始
            </button>
          )}
          {!isHost && (
            <p className="text-xs text-white/50">ホストの開始を待っています…</p>
          )}
          {!isHost && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onLeave()}
              className="text-xs text-white/45 underline"
            >
              退室
            </button>
          )}
        </section>
      )}

      {/* 対局中（プレイ URL のみ） */}
      {room.status === "playing" && targetChar && inPlayRoute && (
        <>
          <section className="rounded-2xl border border-amber-500/25 bg-[#0d1324]/90 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-[#ece5d8]">残り時間（この手）</span>
              <span
                className={`font-mono tabular-nums ${
                  timerLeft <= 10 ? "text-rose-300" : "text-amber-200"
                }`}
              >
                {iAmDone ? "—" : `${timerLeft}s / ${room.turnSeconds ?? 30}s`}
              </span>
            </div>
            <p className="mt-2 text-[0.7rem] text-white/45">
              タイマーは端末ローカル。確定（タップ）またはタイムアウト時のみサーバーへ送信します。
            </p>
          </section>

          <section className="rounded-2xl border border-[#ece5d8]/20 bg-[#0d1324]/90 p-3">
            <h3 className="text-xs font-medium text-[#ece5d8]/80">
              みんなの残り手数
            </h3>
            <ul className="mt-2 space-y-1 text-sm">
              {Object.entries(room.playerStates).map(([uid, p]) => (
                <li
                  key={uid}
                  className="flex justify-between gap-2 text-white/85"
                >
                  <span>
                    {p.displayName}
                    {uid === myUid ? "（あなた）" : ""}
                  </span>
                  <span className="font-mono tabular-nums text-amber-200/90">
                    {room.handMode === "unlimited" || p.remainingAttempts < 0
                      ? "∞"
                      : p.remainingAttempts}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {!iAmDone && (
            <section className="rounded-2xl border border-[#ece5d8]/20 bg-[#0d1324]/90 p-4">
              <label className="text-xs text-[#ece5d8]/80">キャラ名で検索</label>
              <input
                value={query}
                disabled={busy}
                onChange={(e) => setQuery(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#ece5d8]/20 bg-[#12182a]/90 px-3 py-2 text-sm text-white outline-none"
                placeholder="例: フリーナ"
                autoComplete="off"
              />
              {showSuggest && (
                <ul className="mt-2 max-h-48 overflow-auto rounded-xl border border-[#ece5d8]/20 bg-[#12182a] py-1">
                  {suggestions.map((c) => (
                    <li key={c.name}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void submitPick(c)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-white/10"
                      >
                        {c.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {message && (
                <p className="mt-2 text-xs text-amber-300">{message}</p>
              )}
            </section>
          )}

          {guesses.length > 0 && targetChar && (
            <section className="space-y-3">
              <h3 className="text-xs text-[#ece5d8]/70">あなたの回答（相手には非表示）</h3>
              {guesses.map((g, idx) => (
                <div
                  key={`${g.name}-${idx}`}
                  className="rounded-2xl border border-[#ece5d8]/15 bg-[#0d1324]/80 p-3"
                >
                  <GuessTileRow guess={g} target={targetChar} />
                </div>
              ))}
            </section>
          )}
        </>
      )}

      {/* 終了 */}
      {room.status === "finished" && (
        <section className="rounded-2xl border border-emerald-500/30 bg-emerald-950/25 p-4">
          <h2 className="text-lg font-semibold text-[#ece5d8]">結果</h2>
          <ol className="mt-3 space-y-2">
            {Object.entries(room.playerStates)
              .map(([uid, p]) => ({ uid, ...p }))
              .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
              .map((p) => (
                <li
                  key={p.uid}
                  className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/10 pb-2 text-sm"
                >
                  <span>
                    <span className="font-mono text-amber-200/90">
                      {p.rank}位
                    </span>{" "}
                    {p.displayName}
                  </span>
                  <span className="text-xs text-white/55">
                    手数 {p.guessCount}
                    {p.clearTimeMs != null
                      ? ` / タイム ${(p.clearTimeMs / 1000).toFixed(1)}s`
                      : ""}
                  </span>
                </li>
              ))}
          </ol>
          {isHost && (
            <button
              type="button"
              disabled={busy || Object.keys(room.playerStates).length < 2}
              onClick={() => void onAgain()}
              className="mt-4 w-full rounded-xl border border-amber-500/40 bg-amber-950/35 py-2.5 text-sm font-medium text-amber-100"
            >
              もう一度プレイ
            </button>
          )}
        </section>
      )}
    </div>
  );
}
