import { Navigate, Route, Routes } from 'react-router-dom';
import { FournisseurAuth } from './context/AuthContext';
import { RouteProtegee } from './components/RouteProtegee';
import { Notifications } from './components/Notifications';
import { MiseAJour } from './components/MiseAJour';
import { Connexion } from './pages/Connexion';
import { Accueil } from './pages/Accueil';
import { MonCompte } from './pages/MonCompte';

export function App() {
  return (
    <FournisseurAuth>
      <Routes>
        <Route path="/connexion" element={<Connexion />} />
        <Route path="/" element={<RouteProtegee><Accueil /></RouteProtegee>} />
        <Route path="/mon-compte" element={<RouteProtegee><MonCompte /></RouteProtegee>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Notifications />
      <MiseAJour />
    </FournisseurAuth>
  );
}
