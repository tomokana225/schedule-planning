import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    define: {
      // Polyfill global for libraries that expect it
      global: 'window',
      // Inject the API key specifically. 
      // We do not define 'process.env': {} here to avoid overwriting the window.process polyfill in index.html
      'process.env.API_KEY': JSON.stringify(env.API_KEY || ''),
    },
  };
});