import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  logLevel: 'error',
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@/components/ui', replacement: path.resolve('./src/shared/ui') },
      { find: '@', replacement: path.resolve('./src') },
    ],
  },
});
