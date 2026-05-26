import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "openai"],
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    // Bloc turbo supprimé car la syntaxe n'est pas supportée par votre version
  },
};

export default nextConfig;
