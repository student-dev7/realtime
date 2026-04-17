import type { Metadata } from "next";
import { HomeLobbyClient } from "./HomeLobbyClient";

const HOME_TITLE = "ルームで対戦";
const HOME_DESCRIPTION =
  "5桁の部屋番号で集まり、リアルタイムで対戦しよう。参加者が2人以上そろったら、ホストが「ゲーム開始」でプレイ画面に移ります。";

export const metadata: Metadata = {
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: `${HOME_TITLE} | 原神ゲッサー`,
    description: HOME_DESCRIPTION,
    url: "/",
  },
};

/**
 * トップ `/` はマルチ用ロビー（ルームで対戦・入室・作成）のみ。
 */
export default function HomePage() {
  return <HomeLobbyClient />;
}
