import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Logos de monedas que devuelve CoinGecko
    remotePatterns: [
      { protocol: "https", hostname: "coin-images.coingecko.com" },
      { protocol: "https", hostname: "assets.coingecko.com" },
    ],
  },
  async redirects() {
    return [
      {
        source: "/new-transaction",
        destination: "/dolar/nueva",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
