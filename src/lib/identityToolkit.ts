import { getFirebaseWebConfig } from "./firebaseWebConfig";

/**
 * Identity Toolkit REST（Web API キー）で uid を得る。
 * Next.js API ルートでは **使わないこと**（Vercel からの呼び出しは HTTP リファラ制限で失敗し得る）。
 * サーバー側は `verifyIdTokenServer.ts` の `getUidFromVerifiedIdToken` を使う。
 */
export async function getUidFromIdToken(idToken: string): Promise<string | null> {
  const { apiKey } = getFirebaseWebConfig();
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    }
  );
  if (!res.ok) {
    return null;
  }
  const data = (await res.json()) as { users?: { localId?: string }[] };
  const uid = data.users?.[0]?.localId;
  return typeof uid === "string" ? uid : null;
}
