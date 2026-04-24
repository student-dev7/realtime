import { getAuth } from "firebase-admin/auth";
import { getFirebaseAdminApp } from "@/lib/firebaseAdmin";

/**
 * Next.js API ルート用の ID トークン検証。
 * `identityToolkit` の REST（Web API キー）とは異なり、サービスアカウントで検証するため
 * Google Cloud の「HTTP リファラ」制限の影響を受けない。
 */
export async function getUidFromVerifiedIdToken(
  idToken: string
): Promise<string | null> {
  if (!idToken || typeof idToken !== "string") return null;
  try {
    const decoded = await getAuth(getFirebaseAdminApp()).verifyIdToken(
      idToken
    );
    return decoded.uid;
  } catch {
    return null;
  }
}
