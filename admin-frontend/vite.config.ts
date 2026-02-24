import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Vite config for admin frontend; builds into ../public so Express can serve it as before.
export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname),
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
  build: {
    outDir: path.resolve(__dirname, '../public'),
    emptyOutDir: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

