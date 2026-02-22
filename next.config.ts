import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["lamejs"],
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
