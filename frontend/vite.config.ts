import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    // Split heavy third-party deps into their own chunks so the browser can
    // cache them independently of the app code (vendor code changes much less
    // frequently than feature code).
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('react-router')) return 'react-vendor'
          if (id.includes('/react-dom/') || id.includes('/react/')) return 'react-vendor'
          if (id.includes('@tanstack') || id.includes('/axios/')) return 'query-vendor'
          if (
            id.includes('react-hook-form') ||
            id.includes('@hookform') ||
            id.includes('/zod/')
          ) {
            return 'form-vendor'
          }
          if (id.includes('radix-ui') || id.includes('lucide-react') || id.includes('/sonner/')) {
            return 'ui-vendor'
          }
        },
      },
    },
  },
})
