import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { notifier } from '../components/Notifications';
import { useAuth } from '../context/AuthContext';
import {
  creerCampagne,
  dupliquerCampagne,
  listerCampagnes,
  modifierCampagne,
  supprimerCampagne,
} from '../lib/campagnes';
import type { Campagne } from '../lib/types';
import {
  FORMATS,
  FORMATS_ORDONNES,
  TYPES_CAMPAGNE,
  TYPES_ORDONNES,
  VRAC_DEFAUT,
  type FormatAffiche,
  type ParametresVrac,
  type TypeCampagne,
} from '../config/constants';
import { ReglagesVrac } from '../components/saisie/ReglagesVrac';
import { messageErreur } from '../lib/firebase';
import { tracer } from '../lib/journal';
import './Campagnes.css';

const dateCourte = (d: Date | null) =>
  d ? d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

function nomParDefaut(type: TypeCampagne): string {
  const d = new Date();
  const jour = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  return `${TYPES_CAMPAGNE[type].court} ${jour}`;
}

export function Campagnes() {
  const { utilisateur, estAdmin } = useAuth();
  const naviguer = useNavigate();
  const [campagnes, setCampagnes] = useState<Campagne[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [filtre, setFiltre] = useState<TypeCampagne | 'TOUS'>('TOUS');
  const [archivees, setArchivees] = useState(false);

  const [type, setType] = useState<TypeCampagne>('A7');
  const [nom, setNom] = useState('');
  const [format, setFormat] = useState<FormatAffiche>('A4');
  const [vrac, setVrac] = useState<ParametresVrac>(VRAC_DEFAUT);
  const [creation, setCreation] = useState(false);

  const charger = useCallback(async () => {
    setErreur(null);
    try {
      setCampagnes(await listerCampagnes({ archivees: true }));
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  const visibles = useMemo(
    () =>
      campagnes.filter(
        (c) => (filtre === 'TOUS' || c.type === filtre) && (archivees ? c.statut === 'archivee' : c.statut !== 'archivee'),
      ),
    [campagnes, filtre, archivees],
  );

  async function creer(e: FormEvent) {
    e.preventDefault();
    if (!utilisateur) return;
    const n = nom.trim() || nomParDefaut(type);
    setCreation(true);
    try {
      const id = await creerCampagne(n, type, format, { id: utilisateur.id, nom: utilisateur.nom }, type === 'VRAC' ? vrac : undefined);
      tracer('creation', 'campagnes', `Campagne « ${n} » (${TYPES_CAMPAGNE[type].libelle}${type === 'VRAC' ? ` ${vrac.largeurMm} × ${vrac.hauteurMm} mm, ${vrac.avecIngredients ? 'avec' : 'sans'} ingredients` : ''})`);
      naviguer(`/saisie/${id}`);
    } catch (err) {
      notifier(messageErreur(err), 'erreur');
      setCreation(false);
    }
  }

  const peutGerer = (c: Campagne) => estAdmin || c.creePar === utilisateur?.id;

  async function dupliquer(c: Campagne) {
    if (!utilisateur) return;
    const n = window.prompt('Nom de la nouvelle campagne :', `${c.nom} (copie)`);
    if (!n?.trim()) return;
    try {
      const id = await dupliquerCampagne(c, n.trim(), { id: utilisateur.id, nom: utilisateur.nom });
      tracer('creation', 'campagnes', `Campagne « ${n} » dupliquee depuis « ${c.nom} »`);
      naviguer(`/saisie/${id}`);
    } catch (err) {
      notifier(messageErreur(err), 'erreur');
    }
  }

  async function archiver(c: Campagne) {
    try {
      await modifierCampagne(c.id, { statut: c.statut === 'archivee' ? 'brouillon' : 'archivee' });
      await charger();
    } catch (err) {
      notifier(messageErreur(err), 'erreur');
    }
  }

  async function supprimer(c: Campagne) {
    if (!window.confirm(`Supprimer definitivement « ${c.nom} » et ses ${c.nbElements} element(s) ?`)) return;
    try {
      await supprimerCampagne(c.id);
      tracer('suppression', 'campagnes', `Campagne « ${c.nom} » supprimee (${c.nbElements} elements)`);
      notifier('Campagne supprimee.');
      await charger();
    } catch (err) {
      notifier(messageErreur(err), 'erreur');
    }
  }

  return (
    <AppShell titre="Campagnes" sousTitre="Un lot d'etiquettes, d'affiches ou de balisage a imprimer ensemble">
      {erreur ? <p className="bandeau bandeau--erreur">{erreur}</p> : null}

      <section className="carte">
        <h2 className="carte__titre">Nouvelle campagne</h2>
        <form onSubmit={creer}>
          <div className="choix-types">
            {TYPES_ORDONNES.map((t) => {
              const d = TYPES_CAMPAGNE[t];
              return (
                <button
                  key={t}
                  type="button"
                  className={`choix-type${type === t ? ' est-choisi' : ''}`}
                  style={{ '--couleur-type': d.couleur } as React.CSSProperties}
                  onClick={() => setType(t)}
                >
                  <span className="choix-type__titre">{d.libelle}</span>
                  <span className="choix-type__texte">{d.description}</span>
                </button>
              );
            })}
          </div>
          {type === 'VRAC' ? <ReglagesVrac valeur={vrac} surChange={setVrac} idPrefixe="creation-vrac" /> : null}
          <div className="formulaire-ligne">
            <div className="champ champ--extensible">
              <label htmlFor="nom-campagne">Nom</label>
              <input id="nom-campagne" type="text" placeholder={nomParDefaut(type)} value={nom} onChange={(e) => setNom(e.target.value)} maxLength={80} />
            </div>
            {type === 'AFFICHE' ? (
              <div className="champ">
                <label htmlFor="format">Format</label>
                <select id="format" value={format} onChange={(e) => setFormat(e.target.value as FormatAffiche)}>
                  {FORMATS_ORDONNES.map((f) => (
                    <option key={f} value={f}>{FORMATS[f].libelle}</option>
                  ))}
                </select>
              </div>
            ) : null}
            <button type="submit" className="bouton bouton--principal" disabled={creation}>
              {creation ? 'Creation…' : 'Creer et commencer la saisie'}
            </button>
          </div>
        </form>
      </section>

      <section className="carte">
        <div className="carte__entete">
          <h2 className="carte__titre">{archivees ? 'Campagnes archivees' : 'Campagnes en cours'}</h2>
          <div className="segments">
            {(['TOUS', ...TYPES_ORDONNES] as const).map((t) => (
              <button key={t} type="button" className={`segments__bouton${filtre === t ? ' est-actif' : ''}`} onClick={() => setFiltre(t)}>
                {t === 'TOUS' ? 'Toutes' : TYPES_CAMPAGNE[t].court}
              </button>
            ))}
          </div>
          <label className="case" style={{ marginLeft: 'auto', paddingBottom: 0 }}>
            <input type="checkbox" checked={archivees} onChange={(e) => setArchivees(e.target.checked)} />
            Archivees
          </label>
        </div>

        {chargement ? (
          <p className="carte__texte carte__texte--discret">Chargement…</p>
        ) : visibles.length === 0 ? (
          <p className="carte__texte carte__texte--discret">Aucune campagne.</p>
        ) : (
          <table className="tableau">
            <thead>
              <tr>
                <th scope="col">Campagne</th>
                <th scope="col">Type</th>
                <th scope="col">Elements</th>
                <th scope="col">Creee par</th>
                <th scope="col">Mise a jour</th>
                <th scope="col"><span className="visually-hidden">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((c) => (
                <tr key={c.id}>
                  <th scope="row" className="colonne-nom">
                    <Link to={`/saisie/${c.id}`}>{c.nom}</Link>
                    {c.statut === 'imprimee' ? <span className="etiquette etiquette--ok">imprimee</span> : null}
                  </th>
                  <td>
                    <span className="badge-type" style={{ '--couleur-type': TYPES_CAMPAGNE[c.type].couleur } as React.CSSProperties}>
                      {TYPES_CAMPAGNE[c.type].court}
                      {c.type === 'AFFICHE' ? ` ${c.format}` : ''}
                      {c.type === 'VRAC' ? ` ${c.largeurMm}×${c.hauteurMm}` : ''}
                    </span>
                  </td>
                  <td>{c.nbElements}</td>
                  <td>{c.creeParNom || '—'}</td>
                  <td>{dateCourte(c.majLe)}</td>
                  <td className="colonne-actions">
                    <Link to={`/saisie/${c.id}`} className="bouton bouton--discret bouton--petit">Saisir</Link>
                    <Link to={`/impression/${c.id}`} className="bouton bouton--principal bouton--petit">Imprimer</Link>
                    <button type="button" className="bouton bouton--discret bouton--petit" onClick={() => void dupliquer(c)}>Dupliquer</button>
                    {peutGerer(c) ? (
                      <>
                        <button type="button" className="bouton bouton--discret bouton--petit" onClick={() => void archiver(c)}>
                          {c.statut === 'archivee' ? 'Restaurer' : 'Archiver'}
                        </button>
                        <button type="button" className="bouton bouton--danger bouton--petit" onClick={() => void supprimer(c)}>Supprimer</button>
                      </>
                    ) : null}
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
