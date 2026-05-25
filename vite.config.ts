import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Rename pdf.worker.min-*.mjs → pdf.worker.min-*.js after build
// so Apache/XServer serves it with the correct MIME type for JS workers
const renamePdfWorkerPlugin: Plugin = {
  name: 'rename-pdf-worker',
  enforce: 'post',
  apply: 'build',
  closeBundle() {
    const assetsDir = path.resolve('dist', 'assets')
    if (!fs.existsSync(assetsDir)) return
    for (const file of fs.readdirSync(assetsDir)) {
      if (file.startsWith('pdf.worker') && file.endsWith('.mjs')) {
        fs.renameSync(
          path.join(assetsDir, file),
          path.join(assetsDir, file.replace('.mjs', '.js'))
        )
      }
    }
  },
}

export default defineConfig({
  plugins: [react(), renamePdfWorkerPlugin],
  base: './',
  optimizeDeps: {
    exclude: ['pdfjs-dist'],
  },
})
