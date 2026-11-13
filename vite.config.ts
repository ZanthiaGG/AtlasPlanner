import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served from https://zanthiagg.github.io/AtlasPlanner/ on GitHub Pages.
// `base` must match the repo name or every asset 404s.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/AtlasPlanner/',
  plugins: [react()],
  build: {
    target: 'es2022',
    // The tree JSON is fetched at runtime, not bundled, so the JS stays tiny.
    assetsInlineLimit: 4096,
  },
})
