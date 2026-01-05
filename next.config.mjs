/** @type {import('next').NextConfig} */
const nextConfig = {
    // Required to enable genkit to work in the app
    transpilePackages: ['@genkit-ai/google-genai'],
    async rewrites() {
      return {
        // We need to proxy the Genkit API to avoid CORS issues.
        // This is not needed in production if the app and the API are on the same domain.
        beforeFiles: [
          {
            source: '/api/ai/:path*',
            destination: 'http://127.0.0.1:3400/:path*',
          },
        ],
      };
    },
};

export default nextConfig;
