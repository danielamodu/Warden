import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // We intentionally use the Tailwind CDN script (see index.html), not a
  // build-time Tailwind/PostCSS pipeline. Vite otherwise walks up parent
  // directories looking for a postcss config file, which can pick up an
  // unrelated one outside this project; an empty inline config disables
  // that search entirely.
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
        target: process.env.VITE_TEE_EXTENSION_PROXY_URL || 'https://exciting-acre-intersection-tvs.trycloudflare.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tee-proxy/, ''),
      },
    },
  },
});
