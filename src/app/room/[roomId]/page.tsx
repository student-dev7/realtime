"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { MultiRoomClient } from "./MultiRoomClient";

function RoomInner() {
  const params = useParams();
  const sp = useSearchParams();
  const raw = String(params.roomId ?? "");
  const roomCode = raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 5);
  const initialPassword = sp.get("pwd") ?? "";

  if (roomCode.length !== 5) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center text-sm text-rose-300">
        部屋番号が不正です（5文字の英数字）。
      </div>
    );
  }

  return (
    <MultiRoomClient roomCode={roomCode} initialPassword={initialPassword} />
  );
}

export default function RoomPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-[#ece5d8]">
          読み込み中…
        </div>
      }
    >
      <RoomInner />
    </Suspense>
  );
}
