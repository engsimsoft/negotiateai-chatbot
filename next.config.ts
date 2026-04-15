import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SIMPLY_DEV_MODE: process.env.SIMPLY_DEV_MODE || "",
  },
  serverExternalPackages: ["lamejs", "pdf-parse"],
  outputFileTracingIncludes: {
    "/api/cron/briefing": [
      "./node_modules/.pnpm/lamejs@1.2.1/node_modules/lamejs/lame.all.js",
    ],
  },
  images: {
    remotePatterns: [
      {
        hostname: "avatar.vercel.sh",
      },
      {
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
};

export default nextConfig;
