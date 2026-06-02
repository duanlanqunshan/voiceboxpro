import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { changelogPlugin } from './plugins/changelog';

export default defineConfig({
  plugins: [tailwindcss(), react(), changelogPlugin(path.resolve(__dirname, '..'))],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (id.includes('@tauri-apps')) {
            return 'tauri';
          }

          if (
            id.includes('@tanstack/react-router') ||
            id.includes('@tanstack/react-query')
          ) {
            return 'tanstack';
          }

          if (
            id.includes('@radix-ui') ||
            id.includes('lucide-react') ||
            id.includes('framer-motion') ||
            id.includes('motion')
          ) {
            return 'ui';
          }

          if (
            id.includes('wavesurfer.js') ||
            id.includes('react-sound-visualizer') ||
            id.includes('@dnd-kit')
          ) {
            return 'media';
          }

          return 'vendor';
        },
      },
    },
  },
});
