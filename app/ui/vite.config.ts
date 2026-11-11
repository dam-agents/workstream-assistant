/// <reference types="vitest/config" />
// Builds the UI into one self-contained HTML file, ../app.template.html: the artifact frame loads a single
// file and can reach nothing else. build.py then fills in __SNAPSHOT__ and __VERSION__ (see ../README.md).
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const out = fileURLToPath(new URL('./dist', import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile(), {
    name: 'write-template',
    apply: 'build',
    async closeBundle() {
      const { copyFile } = await import('node:fs/promises');
      await copyFile(`${out}/index.html`, fileURLToPath(new URL('../app.template.html', import.meta.url)));
    },
  }],
  build: { outDir: out, emptyOutDir: true },
  // `npm run dev`: the page talks to the API server on :5555 through this proxy (see src/dev.ts).
  server: { proxy: { '/api': 'http://127.0.0.1:5555' } },
  test: { environment: 'jsdom', globals: true },
});
