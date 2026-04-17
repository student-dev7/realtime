/** I,O,0,1 を除き誤入力を減らす（仕様の例 XJ79L 互換の英数字集合） */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRoomCode(): string {
  let s = "";
  for (let i = 0; i < 5; i++) {
    s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]!;
  }
  return s;
}

/** 入力を 5 文字の部屋番号に正規化（大文字・英数字のみ） */
export function normalizeRoomCodeInput(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 5);
}

export function isValidRoomCode(code: string): boolean {
  return /^[A-Z0-9]{5}$/.test(code);
}
