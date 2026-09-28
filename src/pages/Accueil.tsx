/**
 * Etape 0 — page d'accueil provisoire : confirme que la nouvelle structure
 * est deployee et suit l'avancement de la reconstruction.
 */

import { APP_NAME, APP_VERSION, MAGASIN } from '../config/constants';
import logo from '../assets/img/logo-marjane.jpg';
import './Accueil.css';

/** L'ancienne application reste dans son propre depot, inchangee. */
const ANCIENNE = 'https://mtarabet72.github.io/G-n-rateur-A4-A7_marjane08_6-265/';

type Etat = 'fait' | 'en-cours' | 'a-venir';

const ETAPES: readonly { code: string; libelle: string; etat: Etat }[] = [
  { code: '0', libelle: 'Nouveau depot : structure React / Vite et deploiement automatique GitHub Pages', etat: 'en-cours' },
  { code: '1', libelle: 'Firebase : projet, connexion, roles, premier administrateur', etat: 'a-venir' },
  { code: '2', libelle: 'Catalogue articles partage + reprise des donnees de l’ancienne application', etat: 'a-venir' },
  { code: '3', libelle: 'Gabarits A7, affiches, balisage et bibliotheque de pictos', etat: 'a-venir' },
  { code: '4', libelle: 'Campagnes, saisie et impression des etiquettes A7', etat: 'a-venir' },
  { code: '5', libelle: 'Affiches promo A3 / A4 / A5', etat: 'a-venir' },
  { code: '6', libelle: 'Balisage BOUL / PAT', etat: 'a-venir' },
  { code: '7', libelle: 'Utilisateurs, journal, tableau de bord — mise en production', etat: 'a-venir' },
];

const LIBELLE: Readonly<Record<Etat, string>> = { fait: 'Termine', 'en-cours': 'En cours', 'a-venir': 'A venir' };

export function Accueil() {
  return (
    <div className="accueil">
      <div className="accueil__carte">
        <div className="accueil__entete">
          <img className="accueil__logo" src={logo} alt="" aria-hidden="true" />
          <div>
            <h1 className="accueil__titre">{APP_NAME}</h1>
            <p className="accueil__version">v{APP_VERSION} · {MAGASIN}</p>
          </div>
        </div>

        <p className="carte__texte">
          Nouvelle version en construction. En attendant, l&apos;application actuelle reste disponible
          avec toutes ses donnees :
        </p>
        <a className="bouton bouton--principal accueil__lien" href={ANCIENNE}>
          Ouvrir l&apos;application actuelle (Etiquettes A7 / A4 / Balisage)
        </a>

        <h2 className="carte__titre accueil__sous-titre">Avancement de la reconstruction</h2>
        <ol className="etapes">
          {ETAPES.map((e) => (
            <li key={e.code} className={`etape etape--${e.etat}`}>
              <span className="etape__code">{e.code}</span>
              <span className="etape__libelle">{e.libelle}</span>
              <span className="etape__etat">{LIBELLE[e.etat]}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
