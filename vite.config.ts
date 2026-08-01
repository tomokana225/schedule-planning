import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

// https://vitejs.dev/config/
export default defineConfig({
  // GitHub Pages serves project sites under /<repo-name>/, so asset URLs
  // need that prefix in production builds. Local dev keeps the root path.
  base: process.env.GITHUB_PAGES ? '/schedule-planning/' : '/',
  plugins: [react()],
  define: {
    // Polyfill global for libraries that expect it
    global: 'window',
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
});