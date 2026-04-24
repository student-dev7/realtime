import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          /**
           * Firebase / Identity Toolkit の「HTTP リファラ」制限付き API キーは、
           * Referer が送られない・過度に削られると拒否される。
           * Google 検索経由などでもオリジンが付くよう strict-origin-when-cross-origin に固定する。
           */
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
      {
        source: "/",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: "/play", destination: "/", permanent: false },
      { source: "/multi", destination: "/", permanent: false },
      {
        source: "/multi/room/:roomId",
        destination: "/room/:roomId",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
