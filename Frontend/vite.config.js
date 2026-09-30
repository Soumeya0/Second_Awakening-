import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backend = process.env.VITE_BACKEND || 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': backend, '/audio': backend } },
});
