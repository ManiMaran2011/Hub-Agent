/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
  // Webhook route needs the raw request body to verify GitHub's HMAC
  // signature, so body parsing is disabled there and done manually.
  // (App Router route handlers already give us the raw stream by default;
  // this is a reminder for anyone porting the route to the pages/ dir.)
};

export default nextConfig;
