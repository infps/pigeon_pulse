import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "prisma"],
  images:{
    remotePatterns:[
      new URL('https://pub-a39a3b5950f34f50bb2158b6cf756558.r2.dev/**'),
      ...(process.env.R2_PUBLIC_URL ? [new URL(`${process.env.R2_PUBLIC_URL}/**`)] : []),
    ]
  }
};

export default nextConfig;
