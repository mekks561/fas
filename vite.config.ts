import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import glsl from 'vite-plugin-glsl';
import wasmPack from 'vite-plugin-wasm-pack';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    glsl(),
    // wasmPack(['./src/wasm/physics-kernel']),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
    tsconfigPaths: true,
  },
  server: {
    port: 5175,
    strictPort: true,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2020',
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('playcanvas')) return 'vendor-playcanvas';
            if (id.includes('react-dom') || id.includes('/react/')) return 'vendor-react';
            if (id.includes('@radix-ui')) return 'vendor-radix';
            if (id.includes('zustand') || id.includes('lucide-react') || id.includes('clsx') || id.includes('tailwind-merge') || id.includes('class-variance-authority')) return 'vendor-misc';
          }
        },
      },
    },
  },
  assetsInclude: ['**/*.lua'],
});
