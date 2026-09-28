import { Navigate, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { FournisseurAuth } from './context/AuthContext';
import { FournisseurDonnees } from './context/DonneesContext';
import { RouteProtegee } from './components/RouteProtegee';
import { Notifications } from './components/Notifications';
import { MiseAJour } from './components/MiseAJour';
import { Connexion } from './pages/Connexion';
import { Accueil } from './pages/Accueil';
import { MonCompte } from './pages/MonCompte';
import { Catalogue } from './pages/Catalogue';
import { Parametres } from './pages/Parametres';
import { Gabarits } from './pages/Gabarits';

function Protege({ children, admin }: { children: ReactNode; admin?: boolean }) {
  return <RouteProtegee roles={admin ? ['administrateur'] : undefined}>{children}</RouteProtegee>;
}

export function App() {
  return (
    <FournisseurAuth>
      <FournisseurDonnees>
        <Routes>
          <Route path="/connexion" element={<Connexion />} />
          <Route path="/" element={<Protege><Accueil /></Protege>} />
          <Route path="/catalogue" element={<Protege><Catalogue /></Protege>} />
          <Route path="/gabarits" element={<Protege admin><Gabarits /></Protege>} />
          <Route path="/parametres" element={<Protege admin><Parametres /></Protege>} />
          <Route path="/mon-compte" element={<Protege><MonCompte /></Protege>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Notifications />
        <MiseAJour />
      </FournisseurDonnees>
    </FournisseurAuth>
  );
}
