import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { useAuth } from '../context/AuthContext';
import { useDonnees } from '../context/DonneesContext';
import { listerCampagnes } from '../lib/campagnes';
import { compterArticles } from '../lib/articles';
import type { Campagne } from '../lib/types';
import { TYPES_CAMPAGNE, TYPES_ORDONNES } from '../config/constants';
import { messageErreur } from '../lib/firebase';
import './Campagnes.css';

const dateCourte = (d: Date | null) => (d ? d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');

export function TableauDeBord() {
  const { utilisateur, estAdmin } = useAuth();
  const { gabaritsA7, gabaritsAffiche, pictos, erreur: erreurDonnees } = useDonnees();
  const [campagnes, setCampagnes] = useState<Campagne[]>([]);
  const [articles, setArticles] = useState<number | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    listerCampagnes({ max: 300 })
      .then(setCampagnes)
      .catch((e) => setErreur(messageErreur(e)));
    compterArticles().then(setArticles).catch(() => setArticles(null));
  }, []);

  const stats = useMemo(() => {
    const semaine = Date.now() - 7 * 24 * 3600 * 1000;
    const recentes = campagnes.filter((c) => (c.majLe?.getTime() ?? 0) >= semaine);
    const parType = Object.fromEntries(
      TYPES_ORDONNES.map((t) => [t, campagnes.filter((c) => c.type === t).reduce((s, c) => s + c.nbElements, 0)]),
    ) as Record<string, number>;
    return {
      semaine: recentes.reduce((s, c) => s + c.nbElements, 0),
      aImprimer: campagnes.filter((c) => c.statut === 'brouillon' && c.nbElements > 0).length,
      parType,
    };
  }, [campagnes]);

  const fondsA7 = gabaritsA7.filter((g) => g.image).length;
  const aConfigurer = estAdmin && (fondsA7 === 0 || articles === 0);

  return (
    <AppShell
      titre={`Bonjour ${utilisateur?.nom ?? ''}`}
      sousTitre="Vue d'ensemble de la decoration — etiquettes, affiches et balisage"
      actions={<Link to="/campagnes" className="bouton bouton--principal">Nouvelle campagne</Link>}
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

      <section className="carte">
        <h2 className="carte__titre">Dernieres campagnes</h2>
        {campagnes.length === 0 ? (
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
              {campagnes.slice(0, 8).map((c) => (
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
