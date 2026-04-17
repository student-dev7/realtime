import CHARACTERS from "@/data/characters.json";

export type GuessCharacter = (typeof CHARACTERS)[number];

export function normalizeForSearch(s: string) {
  const t = s.trim().replace(/\s+/g, "");
  const noLongVowel = t.replace(/ー/g, "");
  return noLongVowel.replace(/[ァ-ヶ]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}

export function getVer(c: GuessCharacter): number | null {
  const anyC = c as unknown as { ver?: unknown; version?: unknown };
  const v = anyC.ver ?? anyC.version;
  return typeof v === "number" ? v : null;
}

export function matchClass(ok: boolean) {
  return ok
    ? "border-emerald-500/70 bg-emerald-950/50 text-emerald-100 shadow-[0_0_20px_-6px_rgba(52,211,153,0.45)]"
    : "border-[#ece5d8]/20 bg-[#12182a]/95 text-[#ece5d8]/95";
}

export function pickRandomTarget<T>(list: T[]): T {
  const i = Math.floor(Math.random() * list.length);
  return list[i]!;
}
