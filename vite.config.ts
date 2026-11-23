/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

declare const process: { env: Record<string, string | undefined> };

/**
 * Content-Security-Policy: the browser runs only this app's own files and talks to no other
 * server. GitHub Pages can't send headers, so it goes in a <meta> tag, and only in the build
 * (the dev server relies on inline scripts for hot reloading). `frame-ancestors` is not allowed
 * in a <meta> tag, so it is left out.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

function contentSecurityPolicy(): Plugin {
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
    ],
  };
}

export default defineConfig({
  // GitHub Pages serves the app from /<repo-name>/; the deploy workflow sets BASE_PATH.
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    react(),
    contentSecurityPolicy(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Money left over',
        short_name: 'Left over',
        description: 'Recurring expenses and income, and what is left over each month.',
        lang: 'en',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        theme_color: '#f3f5f2',
        background_color: '#f3f5f2',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Cache the whole app (including fonts and icons) so it opens without a connection.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
  },
});
