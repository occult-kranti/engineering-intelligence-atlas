import devServer from "@hono/vite-dev-server"
import path from "path"
const __dirname = import.meta.dirname
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => ({
  // One portable static bundle: GitHub Pages subpaths, Capacitor and file://.
  // Hash routing keeps every atlas route relative to this document.
  base: './',
  plugins: [
    {
      name: "kimi-preview-host",
      config(config) {
        const hosts = config.server?.allowedHosts;
        if (hosts === true || hosts?.includes("3000.proxy.internal")) return;
        return { server: { allowedHosts: ["3000.proxy.internal"] } };
      },
    },
    ...(command === 'serve' && mode !== 'static'
      ? [devServer({ entry: "api/boot.ts", exclude: [/^\/(?!api\/).*$/] })]
      : []),
    inspectAttr(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      base: './',
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Engineering Intelligence Atlas',
        short_name: 'Eng Atlas',
        description:
          'A static, evidence-first dashboard of verified engineering roles, resources, the agent-skill ecosystem, hiring records, and defensive reverse-engineering sources.',
        theme_color: '#211d17',
        background_color: '#f2ede2',
        display: 'standalone',
        start_url: './',
        icons: [
          { src: './icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: './icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: './icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          { src: './icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        // Precache static assets only — HTML is never precached.
        globPatterns: ['**/*.{js,css,svg,png,woff,woff2}'],
        navigateFallback: null,
        runtimeCaching: [
          {
            // Documents are always network-first.
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-network-first',
              networkTimeoutSeconds: 5,
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@contracts": path.resolve(__dirname, "./contracts"),
      "@db": path.resolve(__dirname, "./db"),
      "db": path.resolve(__dirname, "./db"),
    },
  },
  envDir: path.resolve(__dirname),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
}));
