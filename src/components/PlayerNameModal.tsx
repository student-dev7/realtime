"use client";

import { useEffect, useState } from "react";
import { validateDisplayName } from "@/lib/validateDisplayName";

type Props = {
  open: boolean;
  onClose: () => void;
  /** 保存済みの表示名（開いたときの初期値） */
  initialName: string;
  onSaved: (name: string) => void;
  /** 見出し（未設定時の警告などで上書き） */
  title?: string;
  /** 説明文（未設定時の案内など） */
  description?: string;
  /** 強調メッセージ（名前未設定で入室等を押したとき） */
  notice?: string;
};

export function PlayerNameModal(props: Props) {
  const {
    open,
    onClose,
    initialName,
    onSaved,
    title = "表示名の変更",
    description = "2〜12文字。ルームで表示されます。",
    notice,
  } = props;
  const [draft, setDraft] = useState(initialName);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(initialName);
    setTouched(false);
  }, [open, initialName]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const preview = validateDisplayName(draft);
  const hint = touched && !preview.ok ? preview.error : null;

  const save = () => {
    setTouched(true);
    const v = validateDisplayName(draft);
    if (!v.ok) return;
    onSaved(v.name);
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="player-name-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-[#ece5d8]/25 bg-[#12182a] p-6 shadow-2xl">
        {notice ? (
          <p
            className="rounded-xl border border-amber-500/35 bg-amber-950/40 px-3 py-2 text-sm font-medium text-amber-100/95"
            role="alert"
          >
            {notice}
          </p>
        ) : null}
        <h2
          id="player-name-modal-title"
          className={`text-lg font-semibold text-[#ece5d8] ${notice ? "mt-4" : ""}`}
        >
          {title}
        </h2>
        <p className="mt-1 text-sm text-white/55">{description}</p>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => setTouched(true)}
          maxLength={24}
          className="mt-4 w-full rounded-xl border border-[#ece5d8]/20 bg-[#0a0f1e] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#ece5d8]/45 focus:ring-2 focus:ring-[#ece5d8]/15"
          placeholder="例: 旅人"
          autoComplete="off"
        />
        {hint && <p className="mt-2 text-xs text-rose-400">{hint}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm text-white/70 transition hover:bg-white/10"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={save}
            className="rounded-xl border border-[#ece5d8]/35 bg-[#ece5d8]/10 px-4 py-2 text-sm font-medium text-[#ece5d8] transition hover:bg-[#ece5d8]/20"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
