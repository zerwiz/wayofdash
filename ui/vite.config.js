// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { dataApiPlugin } from './vite-plugin-data-api.js';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), dataApiPlugin()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  // Do not exclude lucide-react: excluding it forces the browser to load the package
  // barrel + every icon module (1000+ requests); URLs like .../fingerprint.js are often
  // blocked by privacy extensions. Default pre-bundle tree-shakes to icons you import.
  server: {
    port: 5173,
    host: true,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          lucide: ['lucide-react'],
        },
      },
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify('1.0.0'),
  },
});
