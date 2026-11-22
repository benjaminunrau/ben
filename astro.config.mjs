// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
// `astro dev` uses this port; the preview port (4322) is set in the package.json scripts.
export default defineConfig({
  server: { host: 'localhost', port: 4323 },
  vite: {
    // Fail instead of silently moving to another port when one is taken.
    server: { strictPort: true, allowedHosts: ['.trycloudflare.com'] },
    preview: { strictPort: true, allowedHosts: ['.trycloudflare.com'] },
  },
});
