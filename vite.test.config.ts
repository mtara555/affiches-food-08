// Configuration du banc d'essai : Firebase remplace par une base en memoire.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const faux = (f: string) => fileURLToPath(new URL(`./test/faux-firebase/${f}.ts`, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'firebase/app': faux('app'),
      'firebase/auth': faux('auth'),
      'firebase/firestore': faux('firestore'),
      'virtual:pwa-register/react': fileURLToPath(new URL('./test/faux-pwa.ts', import.meta.url)),
    },
  },
  define: {
    'import.meta.env.VITE_FIREBASE_API_KEY': JSON.stringify('test'),
    'import.meta.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify('test'),
  },
  server: { port: 5198 },
});
