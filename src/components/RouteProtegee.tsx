/**
 * Protection des routes — commodite d'interface, pas une mesure de securite :
 * la securite reelle est appliquee par les regles Firestore.
 */

import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LIBELLE_ROLE, type Role } from '../config/constants';
import './RouteProtegee.css';

interface Props {
  readonly children: ReactNode;
  readonly roles?: readonly Role[];
}

export function RouteProtegee({ children, roles }: Props) {
  const { utilisateur, enCoursDeVerification, deconnexion } = useAuth();
  const emplacement = useLocation();

  if (enCoursDeVerification) {
    return (
      <div className="chargement">
        <span className="chargement__indicateur" aria-hidden="true" />
        <p>Verification de la session…</p>
      </div>
    );
  }

  if (!utilisateur) {
    return <Navigate to="/connexion" replace state={{ origine: emplacement.pathname }} />;
  }

  if (utilisateur.role === 'aucun') {
    return (
      <div className="acces-refuse">
        <div className="acces-refuse__carte">
          <h1>Compte sans acces</h1>
          <p>
            Le compte <strong>{utilisateur.nom}</strong> n&apos;a pas de role actif. Un administrateur
            doit l&apos;activer dans l&apos;ecran « Utilisateurs » (ou creer le document
            <code> utilisateurs/{utilisateur.id}</code> dans Firestore pour le premier administrateur).
          </p>
          <p style={{ marginTop: 16 }}>
            <button type="button" className="bouton bouton--discret" onClick={() => void deconnexion()}>
              Se deconnecter
            </button>
          </p>
        </div>
      </div>
    );
  }

  if (roles && !roles.includes(utilisateur.role)) {
    return (
      <div className="acces-refuse">
        <div className="acces-refuse__carte">
          <h1>Acces reserve</h1>
          <p>
            Cet ecran est reserve aux administrateurs. Votre role actuel est « {LIBELLE_ROLE[utilisateur.role]} ».
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
