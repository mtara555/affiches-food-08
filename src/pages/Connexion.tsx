import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { estConfigure } from '../lib/firebase';
import { APP_NAME, APP_VERSION, MAGASIN } from '../config/constants';
import { definirNomAppareilLocal, nomAppareilLocal } from '../lib/journal';
import logo from '../assets/img/logo-marjane.jpg';
import './Connexion.css';

export function Connexion() {
  const { utilisateur, connexion } = useAuth();
  const emplacement = useLocation();
  const [identifiant, setIdentifiant] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [nomAppareil, setNomAppareil] = useState(nomAppareilLocal);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  if (utilisateur) {
    const destination = (emplacement.state as { origine?: string } | null)?.origine ?? '/';
    return <Navigate to={destination} replace />;
  }

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      definirNomAppareilLocal(nomAppareil);
      await connexion(identifiant, motDePasse);
    } catch (probleme) {
      setErreur(probleme instanceof Error ? probleme.message : 'La connexion a echoue.');
      setEnCours(false);
    }
  }

  const desactive = enCours || !estConfigure;

  return (
    <div className="connexion">
      <div className="connexion__carte">
        <div className="connexion__entete">
          <img className="connexion__marque" src={logo} alt="" aria-hidden="true" />
          <div>
            <h1 className="connexion__titre">{APP_NAME}</h1>
            <p className="connexion__version">v{APP_VERSION} · {MAGASIN}</p>
          </div>
        </div>

        <p className="connexion__accroche">
          Etiquettes A7, affiches promo A3 / A4 / A5 et balisage BOUL / PAT — rayons Food et Non Food.
        </p>

        {!estConfigure ? (
          <p className="connexion__alerte">
            La connexion au serveur n&apos;est pas configuree : renseignez les variables Firebase
            (fichier <code>.env.local</code> ou variables GitHub, voir README).
          </p>
        ) : null}

        <form onSubmit={soumettre} className="connexion__formulaire" noValidate>
          <div className="champ">
            <label htmlFor="identifiant">Identifiant ou adresse e-mail</label>
            <input
              id="identifiant"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={identifiant}
              onChange={(e) => setIdentifiant(e.target.value)}
              disabled={desactive}
            />
          </div>
          <div className="champ">
            <label htmlFor="motDePasse">Mot de passe</label>
            <input
              id="motDePasse"
              type="password"
              autoComplete="current-password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              disabled={desactive}
            />
          </div>
          <div className="champ">
            <label htmlFor="nomAppareil">Nom de cet appareil (facultatif)</label>
            <input
              id="nomAppareil"
              type="text"
              placeholder="PC Decoration, Tel. Karim…"
              maxLength={60}
              value={nomAppareil}
              onChange={(e) => setNomAppareil(e.target.value)}
              disabled={desactive}
            />
          </div>
          {erreur ? (
            <p className="connexion__erreur" role="alert">
              {erreur}
            </p>
          ) : null}
          <button type="submit" className="connexion__bouton" disabled={desactive || !identifiant || !motDePasse}>
            {enCours ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        <p className="connexion__aide">Les comptes sont crees par un administrateur (ecran Utilisateurs).</p>
      </div>
    </div>
  );
}
