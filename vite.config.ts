import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    port: 5173,
    // FIX: Eliminate 403 Forbidden / Error 1033 when accessing via hostname.
    // In Vite 5, allowedHosts is not supported; 'true' was previously used in error.
    // We use strictPort: false to allow fallback ports if 5173 is busy.
    strictPort: false,
    // FIX: Only apply Cloudflare-specific HMR settings when explicitly requested.
    // This prevents infinite reload loops on localhost.
    hmr: process.env.VITE_TUNNEL === 'true' ? {
      host: "app.iaoms.dev",
      protocol: "wss",
      clientPort: 443,
    } : true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    // componentTagger only in dev — skip to avoid slowing down dev server init
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Performance: split vendor chunks so browser can cache them independently
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React libraries
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // UI components
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', 'lucide-react'],
          // Backend & data fetching
          'data-vendor': ['@supabase/supabase-js', '@tanstack/react-query'],
          // Heavy libraries - lazy loaded, but separate chunks when loaded
          'pdf-vendor': ['pdfjs-dist'],
          'office-vendor': ['xlsx', 'mammoth'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  // Dev performance: pre-bundle large deps to prevent multiple reloads at startup
  optimizeDeps: {
    include: [
      "@tanstack/react-query",
      "@supabase/supabase-js",
      "lucide-react",
      "recharts",
      "date-fns",
      "react-icons",
    ],
  },
}));
