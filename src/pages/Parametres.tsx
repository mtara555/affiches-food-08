import { useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { notifier } from '../components/Notifications';
import { Couleur } from '../components/gabarits/Reglages';
import { useAuth } from '../context/AuthContext';
import { useDonnees } from '../context/DonneesContext';
import {
  chargerReglagesIa,
  enregistrerParametres,
  enregistrerReglagesIa,
  MODELE_IA_DEFAUT,
  PARAMETRES_DEFAUT,
  type ReglagesIa,
} from '../lib/parametres';
import { oublierReglagesIa, traduireEnArabe } from '../lib/traduction';
import { lireSauvegarde, reprendre, type ResumeSauvegarde } from '../lib/migration';
import type { CouleursA7, CouleursBalisage, Parametres as TypeParametres } from '../lib/types';
import { messageErreur } from '../lib/firebase';
import { tracer } from '../lib/journal';
import '../pages/Gabarits.css';

const COULEURS_A7: readonly { cle: keyof CouleursA7; libelle: string }[] = [
  { cle: 'designation', libelle: 'Designations (sur fond image)' },
  { cle: 'designationNoBg', libelle: 'Designations (fond dessine)' },
  { cle: 'prix', libelle: 'Prix (sur fond image)' },
  { cle: 'prixNoBg', libelle: 'Prix (fond dessine)' },
  { cle: 'unite', libelle: 'Unite (sur fond image)' },
  { cle: 'uniteNoBg', libelle: 'Unite (fond dessine)' },
  { cle: 'allergen', libelle: 'Allergenes' },
];

const COULEURS_BALISAGE: readonly { cle: keyof CouleursBalisage; libelle: string }[] = [
  { cle: 'desFR', libelle: 'Designation FR' },
  { cle: 'desAR', libelle: 'Designation AR' },
  { cle: 'ingFR', libelle: 'Ingredients FR' },
  { cle: 'ingAR', libelle: 'Ingredients AR' },
];

export function Parametres() {
  const { utilisateur } = useAuth();
  const { parametres, gabaritsA7, recharger } = useDonnees();
  const [p, setP] = useState<TypeParametres>(parametres);
  const [ia, setIa] = useState<ReglagesIa>({ cleGroq: '', modele: MODELE_IA_DEFAUT });
  const [voirCle, setVoirCle] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [sauvegarde, setSauvegarde] = useState<{ fichier: File; resume: ResumeSauvegarde; donnees: Parameters<typeof reprendre>[0] } | null>(null);
  const [etape, setEtape] = useState<string | null>(null);

  useEffect(() => setP(parametres), [parametres]);
  useEffect(() => {
    void chargerReglagesIa().then(setIa);
  }, []);

  async function enregistrer() {
    setEnvoi(true);
    try {
      const mapping = p.mapping.filter((m) => m.prefixe.trim() && m.gabarit);
      await enregistrerParametres({ ...p, mapping });
      tracer('modification', 'parametres', `Parametres enregistres (seuils ${p.seuilEconomieFoodDh} DH / ${p.seuilEconomieNonFoodPct} %, ${mapping.length} prefixes)`);
      notifier('Parametres enregistres.');
      await recharger();
    } catch (e) {
      notifier(messageErreur(e), 'erreur');
    } finally {
      setEnvoi(false);
    }
  }

  async function enregistrerIa() {
    try {
      await enregistrerReglagesIa(ia);
      oublierReglagesIa();
      tracer('modification', 'parametres', 'Reglages de traduction IA modifies');
      notifier('Reglages IA enregistres.');
    } catch (e) {
      notifier(messageErreur(e), 'erreur');
    }
  }

  async function testerIa() {
    try {
      await enregistrerReglagesIa(ia);
      oublierReglagesIa();
      const r = await traduireEnArabe('FROMAGE FONDU 8 PORTIONS');
      notifier(`Test reussi : ${r}`);
    } catch (e) {
      notifier(e instanceof Error ? e.message : 'Test impossible.', 'erreur');
    }
  }

  async function lancerReprise() {
    if (!sauvegarde || !utilisateur) return;
    if (!window.confirm('Reprendre les donnees ? Les articles de meme code et les gabarits de meme nom seront remplaces.')) return;
    try {
      await reprendre(sauvegarde.donnees, utilisateur.nom, setEtape);
      tracer('creation', 'parametres', `Reprise de l'ancienne application (${sauvegarde.fichier.name} : ${sauvegarde.resume.articles} articles)`);
      notifier('Reprise terminee.');
      setSauvegarde(null);
      await recharger();
    } catch (e) {
      notifier(messageErreur(e), 'erreur');
    } finally {
      setEtape(null);
    }
  }

  const majMapping = (i: number, champ: 'prefixe' | 'gabarit' | 'libelle', v: string) =>
    setP((x) => ({ ...x, mapping: x.mapping.map((m, j) => (j === i ? { ...m, [champ]: v } : m)) }));

  return (
    <AppShell
      titre="Parametres"
      sousTitre="Regles communes a tous les postes"
      actions={
        <button type="button" className="bouton bouton--principal" disabled={envoi} onClick={() => void enregistrer()}>
          {envoi ? 'Enregistrement…' : 'Enregistrer les parametres'}
        </button>
      }
    >
      <section className="carte">
        <h2 className="carte__titre">Regles d&apos;economie (affiches)</h2>
        <div className="grille">
          <div className="champ">
            <label htmlFor="s-food">Food : bandeau « وفر » a partir de (DH)</label>
            <input id="s-food" type="number" min={0} step={0.5} value={p.seuilEconomieFoodDh} onChange={(e) => setP({ ...p, seuilEconomieFoodDh: Number(e.target.value) || 0 })} />
          </div>
          <div className="champ">
            <label htmlFor="s-nf">Non Food : a partir de (% du prix barre)</label>
            <input id="s-nf" type="number" min={0} max={100} step={1} value={p.seuilEconomieNonFoodPct} onChange={(e) => setP({ ...p, seuilEconomieNonFoodPct: Number(e.target.value) || 0 })} />
          </div>
          <div className="champ">
            <label htmlFor="entete">En-tete des affiches sans image</label>
            <input id="entete" type="text" value={p.enteteAffiche} onChange={(e) => setP({ ...p, enteteAffiche: e.target.value })} />
          </div>
        </div>
      </section>

      <section className="carte">
        <h2 className="carte__titre">Choix automatique du gabarit A7 par prefixe de code</h2>
        <p className="carte__texte carte__texte--discret">
          Le prefixe le plus long l&apos;emporte. Un gabarit impose sur la fiche article reste prioritaire.
        </p>
        <table className="tableau">
          <thead>
            <tr>
              <th scope="col">Prefixe</th>
              <th scope="col">Gabarit</th>
              <th scope="col">Libelle</th>
              <th scope="col"><span className="visually-hidden">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {p.mapping.map((m, i) => (
              <tr key={i}>
                <td><input className="recherche" style={{ minWidth: 0, width: 110 }} value={m.prefixe} inputMode="numeric" onChange={(e) => majMapping(i, 'prefixe', e.target.value.trim())} /></td>
                <td>
                  <select className="recherche" style={{ minWidth: 0 }} value={m.gabarit} onChange={(e) => majMapping(i, 'gabarit', e.target.value)}>
                    {gabaritsA7.map((g) => <option key={g.id} value={g.id}>{g.id}</option>)}
                  </select>
                </td>
                <td><input className="recherche" style={{ minWidth: 0, width: '100%' }} value={m.libelle} onChange={(e) => majMapping(i, 'libelle', e.target.value)} /></td>
                <td className="colonne-actions">
                  <button type="button" className="bouton bouton--danger bouton--petit" onClick={() => setP((x) => ({ ...x, mapping: x.mapping.filter((_, j) => j !== i) }))}>Retirer</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="actions-formulaire">
          <button type="button" className="bouton bouton--discret" onClick={() => setP((x) => ({ ...x, mapping: [...x.mapping, { prefixe: '', gabarit: 'PAT', libelle: '' }] }))}>Ajouter un prefixe</button>
          <button type="button" className="bouton bouton--discret" onClick={() => setP((x) => ({ ...x, mapping: PARAMETRES_DEFAUT.mapping }))}>Mapping par defaut</button>
        </div>
      </section>

      <section className="carte">
        <h2 className="carte__titre">Etiquettes A7 — couleurs globales et impression</h2>
        {COULEURS_A7.map((c) => (
          <Couleur
            key={c.cle}
            libelle={c.libelle}
            valeur={p.couleursA7[c.cle]}
            defaut={PARAMETRES_DEFAUT.couleursA7[c.cle]}
            surChange={(v) => setP((x) => ({ ...x, couleursA7: { ...x.couleursA7, [c.cle]: v ?? PARAMETRES_DEFAUT.couleursA7[c.cle] } }))}
          />
        ))}
        <div className="options">
          <label className="case">
            <input type="checkbox" checked={p.signatureActive} onChange={(e) => setP({ ...p, signatureActive: e.target.checked })} />
            Signature sur les etiquettes imprimees
          </label>
          <input className="recherche" style={{ marginLeft: 0, minWidth: 160 }} value={p.signatureTexte} disabled={!p.signatureActive} onChange={(e) => setP({ ...p, signatureTexte: e.target.value.slice(0, 20) })} />
          <label className="case">
            <input type="checkbox" checked={p.piedDePage} onChange={(e) => setP({ ...p, piedDePage: e.target.checked })} />
            Pied de page (date, numero de page) sur les PDF A7
          </label>
        </div>
      </section>

      <section className="carte">
        <h2 className="carte__titre">Balisage — couleurs du texte</h2>
        {COULEURS_BALISAGE.map((c) => (
          <Couleur
            key={c.cle}
            libelle={c.libelle}
            valeur={p.couleursBalisage[c.cle]}
            defaut={PARAMETRES_DEFAUT.couleursBalisage[c.cle]}
            surChange={(v) => setP((x) => ({ ...x, couleursBalisage: { ...x.couleursBalisage, [c.cle]: v ?? PARAMETRES_DEFAUT.couleursBalisage[c.cle] } }))}
          />
        ))}
      </section>

      <section className="carte">
        <h2 className="carte__titre">Traduction arabe par IA (Groq, gratuit)</h2>
        <p className="carte__texte">
          Creez une cle gratuite sur <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer">console.groq.com/keys</a>.
          Elle est partagee avec tous les utilisateurs connectes de l&apos;application.
        </p>
        <div className="grille" style={{ marginTop: 12 }}>
          <div className="champ">
            <label htmlFor="cle">Cle API Groq</label>
            <input id="cle" type={voirCle ? 'text' : 'password'} placeholder="gsk_…" value={ia.cleGroq} onChange={(e) => setIa({ ...ia, cleGroq: e.target.value.trim() })} autoComplete="off" />
          </div>
          <div className="champ">
            <label htmlFor="modele">Modele</label>
            <input id="modele" type="text" value={ia.modele} onChange={(e) => setIa({ ...ia, modele: e.target.value.trim() || MODELE_IA_DEFAUT })} />
          </div>
        </div>
        <div className="actions-formulaire">
          <button type="button" className="bouton bouton--principal" onClick={() => void enregistrerIa()}>Enregistrer la cle</button>
          <button type="button" className="bouton bouton--discret" onClick={() => void testerIa()} disabled={!ia.cleGroq}>Tester</button>
          <button type="button" className="bouton bouton--discret" onClick={() => setVoirCle((v) => !v)}>{voirCle ? 'Masquer' : 'Afficher'}</button>
        </div>
      </section>

      <section className="carte carte--import">
        <h2 className="carte__titre">Reprise des donnees de l&apos;ancienne application</h2>
        <p className="carte__texte">
          Ouvrez l&apos;<a href="https://mtarabet72.github.io/G-n-rateur-A4-A7_marjane08_6-265/" target="_blank" rel="noreferrer">ancienne application</a>
          {' '}(sur chaque poste qui y a des donnees), cliquez sur « Sauvegarder tout »
          pour obtenir <code>Marjane_backup_AAAA-MM-JJ.json</code>, puis choisissez ce fichier ici.
        </p>
        <label className={`bouton bouton--discret${etape ? ' est-desactive' : ''}`} style={{ display: 'inline-flex', marginTop: 12 }}>
          Choisir la sauvegarde .json
          <input
            type="file"
            accept=".json,application/json"
            className="visually-hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              try {
                const r = await lireSauvegarde(f);
                setSauvegarde({ fichier: f, ...r });
              } catch (err) {
                notifier(messageErreur(err), 'erreur');
              }
            }}
          />
        </label>
        {sauvegarde ? (
          <>
            <ul className="carte__texte" style={{ marginTop: 12 }}>
              <li>{sauvegarde.resume.articles} article(s)</li>
              <li>{sauvegarde.resume.fondsA7} fond(s) A7 et {sauvegarde.resume.layoutsA7} mise(s) en page</li>
              <li>{sauvegarde.resume.mapping} prefixe(s) de mapping</li>
              <li>{sauvegarde.resume.gabaritsA4} gabarit(s) A4 et {sauvegarde.resume.pictos} picto(s)</li>
              <li>{sauvegarde.resume.gabaritsBalisage} gabarit(s) de balisage</li>
              <li>Cle IA : {sauvegarde.resume.cleIa ? 'oui' : 'non'}</li>
            </ul>
            <div className="actions-formulaire">
              <button type="button" className="bouton bouton--principal" disabled={Boolean(etape)} onClick={() => void lancerReprise()}>
                {etape ?? 'Lancer la reprise'}
              </button>
              <button type="button" className="bouton bouton--discret" disabled={Boolean(etape)} onClick={() => setSauvegarde(null)}>Annuler</button>
            </div>
          </>
        ) : null}
      </section>
    </AppShell>
  );
}
