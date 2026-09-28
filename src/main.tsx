import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from './App';
import './styles/global.css';
import './styles/composants.css';

/**
 * HashRouter : GitHub Pages ne sait pas rediriger les URL profondes vers
 * index.html. Le routage par fragment (#/campagnes) fonctionne sans serveur.
 */
const conteneur = document.getElementById('root');
if (!conteneur) throw new Error('Element #root introuvable dans index.html.');

createRoot(conteneur).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
