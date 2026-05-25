import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',   // 相対パス → サブディレクトリ配置・ファイル直接開きでも動作
  optimizeDeps: {
    exclude: ['pdfjs-dist'],
  },
})
