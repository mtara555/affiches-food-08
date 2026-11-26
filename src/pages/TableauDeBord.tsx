import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { GraphiqueCampagnes } from '../components/stats/GraphiqueCampagnes';
import { RapportPdf } from '../components/stats/RapportPdf';
import { useAuth } from '../context/AuthContext';
import { useDonnees } from '../context/DonneesContext';
import { listerCampagnes } from '../lib/campagnes';
import { compterArticles } from '../lib/articles';
import {
  ETENDUE_PERIODE,
  LIBELLE_PERIODE,
  parOperateur,
  regrouper,
  totalComptes,
  type Periode,
} from '../lib/statistiques';
import type { Campagne } from '../lib/types';
import { TYPES_CAMPAGNE, TYPES_ORDONNES } from '../config/constants';
import { messageErreur } from '../lib/firebase';
import './Campagnes.css';

const PERIODES: readonly Periode[] = ['jour', 'semaine', 'mois', 'annee'];
const nombre = (n: number) => n.toLocaleString('fr-FR');

const dateCourte = (d: Date | null) => (d ? d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');

export function TableauDeBord() {
  const { utilisateur, estAdmin } = useAuth();
  const { gabaritsA7, gabaritsAffiche, pictos, erreur: erreurDonnees } = useDonnees();
  const [campagnes, setCampagnes] = useState<Campagne[]>([]);
  const [articles, setArticles] = useState<number | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [actualisation, setActualisation] = useState(0);
  const [voirTableau, setVoirTableau] = useState(false);
  const [periode, setPeriode] = useState<Periode>(() => {
    try {
      const p = localStorage.getItem('tdb-periode') as Periode | null;
      return p && PERIODES.includes(p) ? p : 'semaine';
    } catch {
      return 'semaine';
    }
  });

  useEffect(() => {
    let actif = true;
    setChargement(true);
    // Campagnes archivees comprises : elles comptent dans les statistiques et les rapports.
    listerCampagnes({ archivees: true, max: 2000 })
      .then((liste) => {
        if (actif) setCampagnes(liste);
      })
      .catch((e) => {
        if (actif) setErreur(messageErreur(e));
      })
      .finally(() => {
        if (actif) setChargement(false);
      });
    compterArticles().then(setArticles).catch(() => setArticles(null));
    return () => {
      actif = false;
    };
  }, [actualisation]);

  function choisirPeriode(p: Periode) {
    setPeriode(p);
    try {
      localStorage.setItem('tdb-periode', p);
    } catch {
      /* preference non memorisee */
    }
  }

  /** Campagnes visibles dans les listes (les archivees n'y figurent pas). */
  const actives = useMemo(() => campagnes.filter((c) => c.statut !== 'archivee'), [campagnes]);

  const intervalles = useMemo(() => regrouper(periode, campagnes), [periode, campagnes]);
  const totalPeriode = useMemo(
    () => intervalles.reduce((s, i) => s + totalComptes(i.comptes), 0),
    [intervalles],
  );
  const operateurs = useMemo(
    () =>
      intervalles.length > 0
        ? parOperateur(campagnes, intervalles[0]!.debut, intervalles[intervalles.length - 1]!.fin)
        : [],
    [campagnes, intervalles],
  );
  const maxOperateur = Math.max(1, ...operateurs.map((o) => o.elements));

  const stats = useMemo(() => {
    const semaine = Date.now() - 7 * 24 * 3600 * 1000;
    const recentes = actives.filter((c) => (c.majLe?.getTime() ?? 0) >= semaine);
    const parType = Object.fromEntries(
      TYPES_ORDONNES.map((t) => [t, actives.filter((c) => c.type === t).reduce((s, c) => s + c.nbElements, 0)]),
    ) as Record<string, number>;
    return {
      semaine: recentes.reduce((s, c) => s + c.nbElements, 0),
      aImprimer: actives.filter((c) => c.statut === 'brouillon' && c.nbElements > 0).length,
      parType,
    };
  }, [actives]);

  const fondsA7 = gabaritsA7.filter((g) => g.image).length;
  const aConfigurer = estAdmin && (fondsA7 === 0 || articles === 0);

  return (
    <AppShell
      titre={`Bonjour ${utilisateur?.nom ?? ''}`}
      sousTitre="Vue d'ensemble de la decoration — etiquettes, affiches et balisage"
      actions={
        <>
          <button
            type="button"
            className="bouton bouton--discret"
            onClick={() => setActualisation((n) => n + 1)}
            disabled={chargement}
            title="Relire les campagnes depuis le serveur"
          >
            {chargement ? 'Chargement…' : 'Actualiser'}
          </button>
          <Link to="/campagnes" className="bouton bouton--principal">Nouvelle campagne</Link>
        </>
      }
    >
      {erreur || erreurDonnees ? <p className="bandeau bandeau--erreur">{erreur ?? erreurDonnees}</p> : null}

      {aConfigurer ? (
        <section className="carte carte--import">
          <h2 className="carte__titre">Mise en route</h2>
          <ol className="carte__texte" style={{ paddingLeft: 18, margin: 0 }}>
            <li>Parametres → « Reprise des donnees » : importez la sauvegarde JSON de l&apos;ancienne application (articles, fonds, pictos).</li>
            <li>Ou Catalogue → « Importer Excel » pour la base articles.</li>
            <li>Gabarits &amp; pictos : verifiez les fonds A7 ({fondsA7} / {gabaritsA7.length}) et les gabarits d&apos;affiche.</li>
            <li>Utilisateurs : creez les comptes des operateurs.</li>
          </ol>
        </section>
      ) : null}

      <div className="tuiles">
        <div className="tuile">
          <span className="tuile__libelle">Elements saisis (7 jours)</span>
          <span className="tuile__valeur">{stats.semaine}</span>
        </div>
        <div className="tuile">
          <span className="tuile__libelle">Campagnes a imprimer</span>
          <span className="tuile__valeur">{stats.aImprimer}</span>
        </div>
        <div className="tuile">
          <span className="tuile__libelle">Articles au catalogue</span>
          <span className="tuile__valeur">{articles === null ? '—' : articles.toLocaleString('fr-FR')}</span>
        </div>
        <div className="tuile">
          <span className="tuile__libelle">Gabarits</span>
          <span className="tuile__valeur">{gabaritsA7.length + gabaritsAffiche.length}</span>
          <span className="tuile__detail">{fondsA7} fonds A7 · {gabaritsAffiche.length} affiches · {pictos.length} pictos</span>
        </div>
      </div>

      <div className="tuiles">
        {TYPES_ORDONNES.map((t) => (
          <Link key={t} to="/campagnes" className="tuile tuile--lien" style={{ '--couleur-type': TYPES_CAMPAGNE[t].couleur } as React.CSSProperties}>
            <span className="badge-type">{TYPES_CAMPAGNE[t].court}</span>
            <span className="tuile__libelle">{TYPES_CAMPAGNE[t].libelle}</span>
            <span className="tuile__detail">{stats.parType[t] ?? 0} element(s) dans les campagnes en cours</span>
          </Link>
        ))}
      </div>

      {/* --- Elements saisis par periode ------------------------------------ */}
      <section className="carte">
        <div className="carte__entete-stats">
          <div>
            <h2 className="carte__titre">Elements saisis — par type de campagne</h2>
            <p className="carte__texte carte__texte--discret">
              Par {LIBELLE_PERIODE[periode].toLowerCase()}, {ETENDUE_PERIODE[periode]} — rattaches a la date de creation de la campagne.
            </p>
          </div>
          <div className="segments" role="group" aria-label="Periode">
            {PERIODES.map((p) => (
              <button
                key={p}
                type="button"
                className={p === periode ? 'segments__bouton est-actif' : 'segments__bouton'}
                aria-pressed={p === periode}
                onClick={() => choisirPeriode(p)}
              >
                {LIBELLE_PERIODE[p]}
              </button>
            ))}
          </div>
        </div>

        <div className="legende">
          {TYPES_ORDONNES.map((t) => (
            <span key={t}>
              <i style={{ background: TYPES_CAMPAGNE[t].couleur }} /> {TYPES_CAMPAGNE[t].court} (
              {nombre(intervalles.reduce((s, i) => s + i.comptes[t], 0))})
            </span>
          ))}
          <span>Total {chargement ? '…' : nombre(totalPeriode)}</span>
        </div>

        {chargement ? <p className="carte__texte carte__texte--discret">Chargement…</p> : <GraphiqueCampagnes intervalles={intervalles} />}

        <button
          type="button"
          className="bouton bouton--discret bouton--petit"
          onClick={() => setVoirTableau((v) => !v)}
          aria-expanded={voirTableau}
        >
          {voirTableau ? 'Masquer le tableau' : 'Voir le tableau'}
        </button>

        {voirTableau ? (
          <div className="tableau-defilant">
            <table className="tableau tableau--stats">
              <thead>
                <tr>
                  <th scope="col">{LIBELLE_PERIODE[periode]}</th>
                  {TYPES_ORDONNES.map((t) => (
                    <th key={t} scope="col">{TYPES_CAMPAGNE[t].court}</th>
                  ))}
                  <th scope="col">Total</th>
                </tr>
              </thead>
              <tbody>
                {[...intervalles].reverse().map((i) => (
                  <tr key={i.cle}>
                    <th scope="row">{i.libelleLong}</th>
                    {TYPES_ORDONNES.map((t) => (
                      <td key={t}>{i.comptes[t]}</td>
                    ))}
                    <td>
                      <strong>{totalComptes(i.comptes)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {/* --- Rapport PDF (jour, semaine, mois, trimestre, annee) ------------ */}
      <RapportPdf campagnes={campagnes} chargement={chargement} />

      {/* --- Elements par operateur ------------------------------------------ */}
      <section className="carte">
        <h2 className="carte__titre">Elements par operateur</h2>
        <p className="carte__texte carte__texte--discret">{ETENDUE_PERIODE[periode]}, selon la periode choisie ci-dessus.</p>
        {chargement ? (
          <p className="carte__texte carte__texte--discret">Chargement…</p>
        ) : operateurs.length === 0 ? (
          <p className="carte__texte carte__texte--discret">Aucune campagne sur cette periode.</p>
        ) : (
          <ul className="barres">
            {operateurs.map((o) => (
              <li key={o.nom} title={`${o.nom} : ${o.elements} element(s) dans ${o.nbCampagnes} campagne(s)`}>
                <span className="barres__nom">{o.nom}</span>
                <span className="barres__piste">
                  <span className="barres__remplissage" style={{ width: `${(o.elements / maxOperateur) * 100}%`, display: 'block' }} />
                </span>
                <span className="barres__valeur">{nombre(o.elements)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="carte">
        <h2 className="carte__titre">Dernieres campagnes</h2>
        {actives.length === 0 ? (
          <p className="carte__texte carte__texte--discret">Aucune campagne. Creez-en une depuis l&apos;ecran Campagnes.</p>
        ) : (
          <table className="tableau">
            <thead>
              <tr>
                <th scope="col">Campagne</th>
                <th scope="col">Type</th>
                <th scope="col">Elements</th>
                <th scope="col">Mise a jour</th>
                <th scope="col"><span className="visually-hidden">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {actives.slice(0, 8).map((c) => (
                <tr key={c.id}>
                  <th scope="row" className="colonne-nom"><Link to={`/saisie/${c.id}`}>{c.nom}</Link></th>
                  <td><span className="badge-type" style={{ '--couleur-type': TYPES_CAMPAGNE[c.type].couleur } as React.CSSProperties}>{TYPES_CAMPAGNE[c.type].court}</span></td>
                  <td>{c.nbElements}</td>
                  <td>{dateCourte(c.majLe)}</td>
                  <td className="colonne-actions">
                    <Link to={`/impression/${c.id}`} className="bouton bouton--discret bouton--petit">Imprimer</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </AppShell>
  );
}
