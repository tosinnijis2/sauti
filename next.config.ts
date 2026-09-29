import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com", pathname: "/*/image/upload/**" },
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/photo-**" }
    ],
    maximumRedirects: 0,
    dangerouslyAllowLocalIP: false,
  }
};

export default nextConfig;
