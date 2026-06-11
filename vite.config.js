import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Tras el build, inyecta en dist/sw.js la lista REAL de assets (con sus hashes)
// para que el service worker los precachee y la app funcione 100% offline.
function swPrecache() {
  return {
    name: 'sw-precache-inject',
    closeBundle() {
      const dist = path.resolve('dist')
      const swPath = path.join(dist, 'sw.js')
      if (!fs.existsSync(swPath)) return
      const files = []
      const walk = (dir, base = '') => {
        for (const f of fs.readdirSync(dir)) {
          const fp = path.join(dir, f)
          const url = base + '/' + f
          if (fs.statSync(fp).isDirectory()) walk(fp, url)
          else files.push(url)
        }
      }
      walk(dist)
      const list = Array.from(new Set(['/', ...files.filter(u => u !== '/sw.js' && !u.endsWith('.map'))]))
      const hash = Date.now().toString(36)
      let sw = fs.readFileSync(swPath, 'utf8')
      sw = sw.replace(/const CACHE = "[^"]*";/, `const CACHE = "utn-tracker-${hash}";`)
      sw = sw.replace(/const PRECACHE = \[[^\]]*\];/, `const PRECACHE = ${JSON.stringify(list)};`)
      fs.writeFileSync(swPath, sw)
      console.log(`[sw-precache] ${list.length} assets precacheados (cache utn-tracker-${hash})`)
    },
  }
}

export default defineConfig({
  plugins: [react(), swPrecache()],
  root: '.',
  build: {
    rollupOptions: {
      input: './index.html'
    }
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3001'
    }
  }
})
