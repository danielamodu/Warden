import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // @tailwindcss/vite processes Tailwind directly and needs no PostCSS
  // config of its own — but Vite otherwise walks up parent directories
  // looking for one, which can pick up an unrelated postcss.config.mjs that
  // lives outside this project (confirmed: one exists at the Desktop level,
  // referencing a `@tailwindcss/postcss` package this project doesn't
  // install). An empty inline config disables that upward search entirely.
  css: {
    postcss: {},
  },
  // Neither the public XRPL testnet JSON-RPC endpoint nor (confirmed by the
  // task brief) the TEE extension proxy send CORS headers, so a browser
  // fetch straight to them is blocked (confirmed empirically —
  // "blocked by CORS policy: ... No 'Access-Control-Allow-Origin' header").
  // This is the standard, expected Vite dev-server proxy workaround for
  // local development; chain/xrpl.ts and chain/teeProxy.ts route through
  // these relative paths only when import.meta.env.DEV. A real deployment
  // still needs a small server-side proxy or CORS-enabled endpoint for both
  // — that's an infra-side fix outside this app's scope, called out in the
  // final report rather than worked around further here.
  server: {
    proxy: {
      '/xrpl-rpc': {
        target: 'https://s.altnet.rippletest.net:51234',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/xrpl-rpc/, ''),
      },
      '/tee-proxy': {
        // Was still pointing at the old local-Docker/cloudflared tunnel,
        // which no longer resolves (DNS failure, live-confirmed) since the
        // TEE was migrated to AWS — kept in sync with chain/config.ts's
        // TEE_EXTENSION_PROXY_URL fallback; see that file for verification
        // details.
        target: process.env.VITE_TEE_EXTENSION_PROXY_URL || 'https://100-63-86-147.sslip.io',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tee-proxy/, ''),
      },
    },
  },
});
