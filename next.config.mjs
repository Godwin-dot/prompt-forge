/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "@libsql/client", "@prisma/adapter-libsql"],
  },
};

export default nextConfig;
