import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // IMPORTANT: Replace 'YOUR_REPO_NAME' with the exact name of your GitHub repository
  // Example: base: '/billiards-club/',
  base: '/YOUR_REPO_NAME/',
})