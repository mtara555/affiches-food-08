import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { FournisseurAuth } from './context/AuthContext';
import { FournisseurDonnees } from './context/DonneesContext';
import { RouteProtegee } from './components/RouteProtegee';
import { Notifications } from './components/Notifications';
import { MiseAJour } from './components/MiseAJour';
import { Connexion } from './pages/Connexion';
import { TableauDeBord } from './pages/TableauDeBord';
import { Campagnes } from './pages/Campagnes';
import { Saisie } from './pages/Saisie';
import { Impression } from './pages/Impression';
import { Catalogue } from './pages/Catalogue';
import { Gabarits } from './pages/Gabarits';
import { Parametres } from './pages/Parametres';
import { Utilisateurs } from './pages/Utilisateurs';
import { Journal } from './pages/Journal';
import { MonCompte } from './pages/MonCompte';
import type { Role } from './config/constants';

const ADMIN: readonly Role[] = ['administrateur'];

function Protege({ children, admin }: { children: ReactNode; admin?: boolean }) {
  return <RouteProtegee roles={admin ? ADMIN : undefined}>{children}</RouteProtegee>;
}

export function App() {
  return (
    <FournisseurAuth>
      <FournisseurDonnees>
        <Routes>
          <Route path="/connexion" element={<Connexion />} />
          <Route path="/" element={<Protege><TableauDeBord /></Protege>} />
          <Route path="/campagnes" element={<Protege><Campagnes /></Protege>} />
          <Route path="/saisie/:campagneId" element={<Protege><Saisie /></Protege>} />
          <Route path="/impression/:campagneId" element={<Protege><Impression /></Protege>} />
          <Route path="/catalogue" element={<Protege><Catalogue /></Protege>} />
          <Route path="/gabarits" element={<Protege admin><Gabarits /></Protege>} />
          <Route path="/parametres" element={<Protege admin><Parametres /></Protege>} />
          <Route path="/utilisateurs" element={<Protege admin><Utilisateurs /></Protege>} />
          <Route path="/journal" element={<Protege admin><Journal /></Protege>} />
          <Route path="/mon-compte" element={<Protege><MonCompte /></Protege>} />
          <Route path="/saisie" element={<Navigate to="/campagnes" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Notifications />
        <MiseAJour />
      </FournisseurDonnees>
    </FournisseurAuth>
  );
}
