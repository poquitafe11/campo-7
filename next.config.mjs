import withPWA from "@ducanh2912/next-pwa";

const pwaConfig = withPWA({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: false, // Desactivado para evitar pérdida de datos al reconectar
  swMinify: true,
  disable: false, // Habilitado siempre para pruebas
  workboxOptions: {
    disableDevLogs: true,
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
    transpilePackages: ['@genkit-ai/google-genai'],
    async rewrites() {
      return {
        beforeFiles: [
          {
            source: '/api/ai/:path*',
            destination: 'http://127.0.0.1:3400/:path*',
          },
        ],
      };
    },
};

export default pwaConfig(nextConfig);
