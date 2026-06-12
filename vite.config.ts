/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  // served from the custom-domain root (dicer.mykrosr.com — see CNAME)
  base: '/',
  build: {
    target: 'es2022',
    // the single large chunk is Rapier's inlined WASM — expected
    chunkSizeWarningLimit: 3000,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
