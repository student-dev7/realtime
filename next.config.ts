import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
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
