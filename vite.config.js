import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En dev, on proxifie /api vers `vercel dev` (port 3000) si lancé,
// sinon les fonctions serverless ne tournent qu'en déploiement.
// Pour tester l'IA en local : `vercel dev` (recommandé) ou déployer.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
