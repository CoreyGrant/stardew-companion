import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const BASE = '/';

export default defineConfig({
  plugins: [react()],
  base: BASE,
  build: {
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        entryFileNames: 'app.js',
        chunkFileNames: 'app.js',
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name ?? '';
          if (name.endsWith('.css')) return 'app.css';
          if (/\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(name)) return 'images/[name][extname]';
          return '[name][extname]';
        },
      },
    },
  },
});
