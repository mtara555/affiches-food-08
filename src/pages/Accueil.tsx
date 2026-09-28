/**
 * Tableau de bord provisoire : suit l'avancement de la reconstruction.
 * Il sera remplace par le vrai tableau de bord a l'etape 7.
 */

import { AppShell } from '../components/AppShell';
import { useAuth } from '../context/AuthContext';
import { LIBELLE_ROLE } from '../config/constants';
import { afficherIdentifiant } from '../lib/auth';

/** L'ancienne application reste dans son propre depot, inchangee. */
const ANCIENNE = 'https://mtarabet72.github.io/G-n-rateur-A4-A7_marjane08_6-265/';

type Etat = 'fait' | 'en-cours' | 'a-venir';

const ETAPES: readonly { code: string; libelle: string; etat: Etat }[] = [
  { code: '0', libelle: 'Nouveau depot : structure React / Vite et deploiement automatique GitHub Pages', etat: 'fait' },
  { code: '1', libelle: 'Firebase : projet, connexion, roles, premier administrateur', etat: 'fait' },
  { code: '2', libelle: 'Catalogue articles partage + reprise des donnees de l’ancienne application', etat: 'en-cours' },
  { code: '3', libelle: 'Gabarits A7, affiches, balisage et bibliotheque de pictos', etat: 'a-venir' },
  { code: '4', libelle: 'Campagnes, saisie et impression des etiquettes A7', etat: 'a-venir' },
  { code: '5', libelle: 'Affiches promo A3 / A4 / A5', etat: 'a-venir' },
  { code: '6', libelle: 'Balisage BOUL / PAT', etat: 'a-venir' },
  { code: '7', libelle: 'Utilisateurs, journal, tableau de bord — mise en production', etat: 'a-venir' },
];

const LIBELLE: Readonly<Record<Etat, string>> = { fait: 'Termine', 'en-cours': 'En cours', 'a-venir': 'A venir' };

export function Accueil() {
  const { utilisateur } = useAuth();
  return (
    <AppShell
      titre={`Bonjour ${utilisateur?.nom ?? ''}`}
      sousTitre="Nouvelle version en construction"
      actions={<a className="bouton bouton--principal" href={ANCIENNE}>Application actuelle</a>}
    >
      <section className="carte carte--session">
        <h2 className="carte__titre">Session</h2>
        <p className="carte__texte">
          Connecte en tant que <strong>{utilisateur?.nom}</strong> ({afficherIdentifiant(utilisateur?.email ?? '')}) —
          role <strong>{utilisateur ? LIBELLE_ROLE[utilisateur.role] : ''}</strong>. La connexion Firebase fonctionne.
        </p>
      </section>

      <section className="carte">
        <h2 className="carte__titre">Avancement de la reconstruction</h2>
        <ol className="etapes">
          {ETAPES.map((e) => (
            <li key={e.code} className={`etape etape--${e.etat}`}>
              <span className="etape__code">{e.code}</span>
              <span className="etape__libelle">{e.libelle}</span>
              <span className="etape__etat">{LIBELLE[e.etat]}</span>
            </li>
          ))}
        </ol>
      </section>
    </AppShell>
  );
}
