// @ts-check
import node from '@astrojs/node';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, envField } from 'astro/config';

// @astrojs/vercel has no preview server, so Playwright builds with the Node adapter instead.
const e2e = process.env.E2E === '1';

export default defineConfig({
  site: 'https://cliplink.app',
  output: 'server',
  adapter: e2e ? node({ mode: 'standalone' }) : vercel(),
  integrations: [react()],
  env: {
    schema: {
      DATABASE_URL: envField.string({ context: 'server', access: 'secret' }),
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
