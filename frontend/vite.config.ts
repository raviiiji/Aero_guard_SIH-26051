import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    // Increase warning threshold slightly since we have heavy 3D/chart libs
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three-vendor';
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) return 'react-vendor';
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) return 'charts-vendor';
          if (id.includes('node_modules/leaflet') || id.includes('node_modules/react-leaflet')) return 'map-vendor';
          if (id.includes('node_modules/lucide-react')) return 'icons-vendor';
        },
      },
    },
  },
});
