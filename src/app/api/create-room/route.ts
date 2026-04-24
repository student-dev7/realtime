import { NextResponse } from "next/server";
import { getUidFromVerifiedIdToken } from "@/lib/verifyIdTokenServer";
import { isAdminUid } from "@/lib/adminUids";
import { createRoomWithAdmin } from "@/lib/multiplayer/roomAdmin";
import type { HandMode } from "@/lib/multiplayer/types";
import { validateDisplayName } from "@/lib/validateDisplayName";

type Body = {
  idToken: string;
  displayName: string;
  roomName: string;
  isPublic: boolean;
  joinPassword: string;
  maxPlayers: number;
  handMode: HandMode;
};

export async function POST(req: Request) {
  let body: Partial<Body>;
  try {
    body = (await req.json()) as Partial<Body>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    idToken,
    displayName: rawName,
    roomName,
    isPublic,
    joinPassword,
    maxPlayers: rawMax,
    handMode,
  } = body;

  if (!idToken || typeof idToken !== "string") {
    return NextResponse.json({ error: "idToken が必要です" }, { status: 400 });
  }

  const uid = await getUidFromVerifiedIdToken(idToken);
  if (!uid) {
    return NextResponse.json({ error: "認証に失敗しました" }, { status: 401 });
  }

  const nameCheck = validateDisplayName(
    typeof rawName === "string" ? rawName : "",
    { ignoreBadSubstrings: isAdminUid(uid) }
  );
  if (!nameCheck.ok) {
    return NextResponse.json({ error: nameCheck.error }, { status: 400 });
  }

  if (handMode !== "seven" && handMode !== "unlimited") {
    return NextResponse.json({ error: "handMode が不正です" }, { status: 400 });
  }

  const mp =
    typeof rawMax === "number" && Number.isFinite(rawMax) ? rawMax : 4;
  const rn = typeof roomName === "string" ? roomName : "";
  const jp = typeof joinPassword === "string" ? joinPassword : "";
  const pub = isPublic === true;

  try {
    const code = await createRoomWithAdmin({
      uid,
      displayName: nameCheck.name,
      roomName: rn,
      isPublic: pub,
      joinPassword: jp,
      maxPlayers: mp,
      handMode,
    });
    return NextResponse.json({ code });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
