import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
// Set `site` to the production URL before deploying: canonical, OG and sitemap depend on it.
export default defineConfig({
  site: 'https://nittany-ai.example.invalid',
  output: 'static',
  integrations: [sitemap()],
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
});
