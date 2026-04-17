/**
 * Firestore `rooms` コレクション全体の上限。
 * 超えると新規作成 API が `createdAt` の古い順に削除してから部屋を追加する。
 */
export const MAX_TOTAL_ROOMS = 400;
