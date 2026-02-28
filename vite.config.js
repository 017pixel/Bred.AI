import { defineConfig } from 'vite'

export default defineConfig({
  base: '/Bred.AI/',
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      input: {
        main: 'index.html'
      },
      output: {
        manualChunks: undefined
      }
    }
  }
})
