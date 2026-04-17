import { NextResponse } from "next/server";
import { cleanOldRooms, DEFAULT_ROOM_MAX_AGE_HOURS } from "@/lib/cleanOldRooms";

function getExpectedSecret(): string {
  return (
    process.env.CLEAN_ROOMS_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    ""
  );
}

function authorize(req: Request): boolean {
  const secret = getExpectedSecret();
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  const bearer =
    auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  return bearer === secret;
}

async function handle(req: Request) {
  if (!getExpectedSecret()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "CLEAN_ROOMS_SECRET または CRON_SECRET をサーバー環境変数に設定してください",
      },
      { status: 503 }
    );
  }

  if (!authorize(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let maxAgeHours: number | undefined;
  if (req.method === "POST") {
    try {
      const body = (await req.json()) as { maxAgeHours?: unknown };
      if (
        typeof body?.maxAgeHours === "number" &&
        Number.isFinite(body.maxAgeHours)
      ) {
        maxAgeHours = Math.min(168, Math.max(1, Math.floor(body.maxAgeHours)));
      }
    } catch {
      /* body なし可 */
    }
  }

  try {
    const { deleted } = await cleanOldRooms({ maxAgeHours });
    return NextResponse.json({
      ok: true,
      deleted,
      maxAgeHours: maxAgeHours ?? DEFAULT_ROOM_MAX_AGE_HOURS,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/** Vercel Cron など GET でも実行可（Authorization: Bearer と同じ秘密） */
export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
