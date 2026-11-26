import { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { APP_FULL_NAME, LIBELLE_ROLE, TYPES_CAMPAGNE, TYPES_ORDONNES } from '../../config/constants';
import { tracer } from '../../lib/journal';
import { genererRapportPdf } from '../../lib/rapport-pdf';
import {
  LIBELLE_PERIODE_RAPPORT,
  calculerPlage,
  compter,
  type PeriodeRapport,
} from '../../lib/statistiques';
import type { Campagne } from '../../lib/types';
import './RapportPdf.css';

const TYPES: readonly PeriodeRapport[] = ['jour', 'semaine', 'mois', 'trimestre', 'annee'];
const CLE_TYPE = 'tdb-rapport-type';

const nombre = (n: number) => n.toLocaleString('fr-FR');
const deux = (n: number) => String(n).padStart(2, '0');
const versChamp = (d: Date) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;

function depuisChamp(v: string): Date {
  const [a, m, j] = v.split('-').map(Number);
  if (!a || !m || !j) return new Date();
  return new Date(a, m - 1, j);
}

interface Props {
  readonly campagnes: readonly Campagne[];
  readonly chargement: boolean;
}

/** Choix de la periode et telechargement du rapport PDF. */
export function RapportPdf({ campagnes, chargement }: Props) {
  const { utilisateur } = useAuth();

  const [type, setType] = useState<PeriodeRapport>(() => {
    try {
      const t = localStorage.getItem(CLE_TYPE) as PeriodeRapport | null;
      return t && TYPES.includes(t) ? t : 'mois';
    } catch {
      return 'mois';
    }
  });
  const aujourdhui = useMemo(() => versChamp(new Date()), []);
  const [dateRef, setDateRef] = useState(aujourdhui);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const plage = useMemo(() => calculerPlage(type, depuisChamp(dateRef)), [type, dateRef]);
  const total = useMemo(() => compter(campagnes, plage.debut, plage.fin), [campagnes, plage]);
  const peutAvancer = plage.fin.getTime() <= Date.now();

  function choisirType(t: PeriodeRapport) {
    setType(t);
    try {
      localStorage.setItem(CLE_TYPE, t);
    } catch {
      /* preference non memorisee */
    }
  }

  async function telecharger() {
    if (!utilisateur) return;
    setEnCours(true);
    setErreur(null);
    try {
      const fichier = await genererRapportPdf({
        plage,
        campagnes,
        nomUtilisateur: utilisateur.nom,
        libelleRole: LIBELLE_ROLE[utilisateur.role],
        nomApplication: APP_FULL_NAME,
      });
      tracer('export', 'impression', `Rapport PDF : ${plage.libelle} — ${total.total} element(s), ${total.nbCampagnes} campagne(s) (${fichier})`);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Generation du rapport impossible.');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <section className="carte rapport">
      <h2 className="carte__titre">Rapport PDF</h2>
      <p className="carte__texte carte__texte--discret">
        Choisir la periode, puis telecharger le rapport : chiffres cles, histogramme par type, detail,
        operateurs et liste des campagnes.
      </p>

      <div className="rapport__commandes">
        <div className="segments" role="group" aria-label="Periode du rapport">
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              className={t === type ? 'segments__bouton est-actif' : 'segments__bouton'}
              aria-pressed={t === type}
              onClick={() => choisirType(t)}
            >
              {LIBELLE_PERIODE_RAPPORT[t]}
            </button>
          ))}
        </div>

        <div className="rapport__navigation">
          <button
            type="button"
            className="bouton bouton--discret bouton--petit"
            onClick={() => setDateRef(versChamp(plage.precedente.debut))}
            aria-label="Periode precedente"
          >
            ‹
          </button>
          <input
            type="date"
            className="rapport__date"
            value={dateRef}
            max={aujourdhui}
            onChange={(e) => e.target.value && setDateRef(e.target.value)}
            aria-label="Date comprise dans la periode"
          />
          <button
            type="button"
            className="bouton bouton--discret bouton--petit"
            onClick={() => setDateRef(versChamp(plage.fin))}
            disabled={!peutAvancer}
            aria-label="Periode suivante"
          >
            ›
          </button>
        </div>
      </div>

      <p className="rapport__resume" aria-live="polite">
        <strong>{plage.libelle}</strong>
        <span>
          {chargement
            ? 'Chargement…'
            : `${nombre(total.total)} element(s) dans ${nombre(total.nbCampagnes)} campagne(s) — ${TYPES_ORDONNES.map(
                (t) => `${TYPES_CAMPAGNE[t].court} ${nombre(total.comptes[t])}`,
              ).join(' · ')}`}
        </span>
      </p>

      {erreur ? (
        <p className="bandeau bandeau--erreur" role="alert">
          {erreur}
        </p>
      ) : null}

      <button type="button" className="bouton bouton--principal" onClick={telecharger} disabled={enCours || chargement || !utilisateur}>
        {enCours ? 'Generation du PDF…' : 'Telecharger le rapport PDF'}
      </button>
    </section>
  );
}
