"use client";

import { useEffect } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function GameRulesModal(props: Props) {
  const { open, onClose } = props;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-rules-modal-title"
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[#ece5d8]/25 bg-[#12182a] p-6 shadow-2xl">
        <h2
          id="game-rules-modal-title"
          className="text-lg font-semibold text-[#ece5d8]"
        >
          ルール
        </h2>
        <ul className="mt-4 space-y-3 text-sm leading-relaxed text-white/85">
          <li className="flex gap-2">
            <span className="shrink-0 text-[#ece5d8]/50" aria-hidden>
              ・
            </span>
            <span>全7手以内に正解を導き出せ！</span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 text-[#ece5d8]/50" aria-hidden>
              ・
            </span>
            <span>
              要素が一致すると
              <span className="font-bold text-emerald-300">【黄緑色】</span>
              に発光します。
            </span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 text-[#ece5d8]/50" aria-hidden>
              ・
            </span>
            <span>
              各行の「予想Ver」はその予想キャラの実装バージョンです。正解より古い／新しい場合は
              <span className="font-bold text-sky-300">【↑ / ↓】</span>
              が付きます。
            </span>
          </li>
        </ul>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#ece5d8]/35 bg-[#ece5d8]/10 px-4 py-2 text-sm font-medium text-[#ece5d8] transition hover:bg-[#ece5d8]/20"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
