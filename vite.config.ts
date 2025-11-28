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
      // Polyfill process object to prevent "ReferenceError: process is not defined"
      'process.env': {},
      // Inject the API key specifically
      'process.env.API_KEY': JSON.stringify(env.API_KEY || ''),
    },
  };
});