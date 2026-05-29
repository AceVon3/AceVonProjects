/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // The data/ files are read at runtime via process.cwd() paths
    // (better-sqlite3 + fs.readFileSync), which @vercel/nft cannot trace
    // statically. Force them into the serverless bundles for the two
    // dynamic routes that read them, or production 500s at request time
    // (the failure is invisible at build). Scoped under `experimental`
    // because this is next@14.2.x — the top-level form lands in Next 15.
    outputFileTracingIncludes: {
      "/api/filings": ["./data/filings.db", "./data/last_updated.txt"],
      "/methodology": ["./data/last_updated.txt"],
    },
  },
};

export default nextConfig;
