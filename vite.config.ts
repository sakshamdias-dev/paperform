import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('mathlive')) return 'vendor-mathlive';
          if (id.includes('react-quill-new') || id.includes('quill')) return 'vendor-quill';
          if (id.includes('jspdf') || id.includes('html2canvas')) return 'vendor-pdf';
          if (id.includes('katex')) return 'vendor-katex';
          if (id.includes('@supabase')) return 'vendor-supabase';
          if (id.includes('@dnd-kit') || id.includes('react-rnd') || id.includes('react-image-crop')) return 'vendor-editor-ui';
          return 'vendor';
        }
      }
    }
  },
})
