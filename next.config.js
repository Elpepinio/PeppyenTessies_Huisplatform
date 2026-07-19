/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdfjs-dist (gebruikt door Bonnetjes voor PDF-facturen) probeert in de
  // browser-bundel soms de Node-only module "canvas" te vinden, terwijl die
  // daar niet nodig is (de browser heeft z'n eigen canvas-API). Zonder deze
  // regel kan de build daarop struikelen.
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = { ...config.resolve.fallback, canvas: false };
    }
    return config;
  },
};

module.exports = nextConfig;
