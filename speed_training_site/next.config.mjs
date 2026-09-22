/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "d11n7da8rpqbjy.cloudfront.net" },
      { protocol: "https", hostname: "kartrausers.s3.amazonaws.com" },
    ],
  },
};

export default nextConfig;
