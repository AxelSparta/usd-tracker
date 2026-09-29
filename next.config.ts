import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
