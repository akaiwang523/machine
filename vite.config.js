import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // ▼▼▼ 修改這一行，前後都要有斜線 ▼▼▼
  base: '/machine/',
})
