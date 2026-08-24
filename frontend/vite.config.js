import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['wolf-crm.wolfgroupindia.com', '8081-01kzdyn8ygnsq2ad0xxrmzrnm9.cloudspaces.litng.ai'],
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://api2:8000',
        changeOrigin: true
      }
    }
  }
})

