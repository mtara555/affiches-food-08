import { useCallback, useEffect, useRef, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { ChampTexte } from '../components/ChampTexte';
import { notifier } from '../components/Notifications';
import { useAuth } from '../context/AuthContext';
import { useDonnees } from '../context/DonneesContext';
import {
  chargerCatalogue,
  appliquerGabarits,
  enregistrerArticle,
  importerArticles,
  rechercherArticles,
  supprimerArticle,
  tousLesArticles,
  trouverArticle,
} from '../lib/articles';
import { ecrireClasseur, lireFeuille, sansEntete } from '../lib/excel';
import { analyserAffectations, lireAffectations, type AnalyseGabarits } from '../lib/import-gabarits';
import { ARTICLE_VIDE, type Article, type ArticleSaisi } from '../lib/types';
import { messageErreur } from '../lib/firebase';
import { tracer } from '../lib/journal';
import { detecterAllergenes } from '../rendu/allergenes';
import { traduireEnArabe } from '../lib/traduction';

const ENTETE = ['Code', 'Designation FR', 'Designation AR', 'Ingredients FR', 'Ingredients AR', 'Origine', 'Col J', 'Gabarit A7'];

export function Catalogue() {
  const { utilisateur, estAdmin } = useAuth();
  const { gabaritsA7 } = useDonnees();
  const [recherche, setRecherche] = useState('');
  const [resultats, setResultats] = useState<Article[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [fiche, setFiche] = useState<ArticleSaisi | null>(null);
  const [ficheNouvelle, setFicheNouvelle] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [import_, setImport] = useState<{ articles: ArticleSaisi[]; nom: string } | null>(null);
  const [progression, setProgression] = useState<string | null>(null);
  const minuterie = useRef<number>();
  const [impGab, setImpGab] = useState<{ nom: string; analyse: AnalyseGabarits & { final: Map<string, string> }; retirer: boolean; fichier: Awaited<ReturnType<typeof lireFeuille>> } | null>(null);

  const PAR_PAGE = 50;
  const articles = resultats.slice(page * PAR_PAGE, (page + 1) * PAR_PAGE);
  const pages = Math.max(1, Math.ceil(resultats.length / PAR_PAGE));

  const charger = useCallback(async (texte: string) => {
    setErreur(null);
    try {
      const r = await rechercherArticles(texte);
      setResultats(r);
      setPage(0);
      setTotal((await chargerCatalogue()).size);
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setChargement(false);
    }
  }, []);

  // Premier chargement : synchronisation des lots modifies depuis la derniere visite.
  useEffect(() => {
    chargerCatalogue((fait, tot) => setProgression(tot ? `Synchronisation du catalogue : ${fait} / ${tot} lot(s)…` : null))
      .then(() => setProgression(null))
      .catch((e) => setErreur(messageErreur(e)));
  }, []);

  useEffect(() => {
    window.clearTimeout(minuterie.current);
    minuterie.current = window.setTimeout(() => void charger(recherche), 250);
    return () => window.clearTimeout(minuterie.current);
  }, [recherche, charger]);

  async function enregistrer() {
    if (!fiche || !utilisateur) return;
    if (!fiche.code.trim() || !fiche.designationFr.trim()) {
      notifier('Code et designation FR sont obligatoires.', 'erreur');
      return;
    }
    setEnvoi(true);
    try {
      if (ficheNouvelle && (await trouverArticle(fiche.code))) {
        if (!window.confirm('Ce code existe deja. Remplacer la fiche existante ?')) return;
      }
      await enregistrerArticle(fiche, utilisateur.nom);
      tracer(ficheNouvelle ? 'creation' : 'modification', 'articles', `${fiche.code} — ${fiche.designationFr}`);
      notifier('Article enregistre.');
      setFiche(null);
      void charger(recherche);
    } catch (e) {
      notifier(messageErreur(e), 'erreur');
    } finally {
      setEnvoi(false);
    }
  }

  async function supprimer(a: Article) {
    if (!window.confirm(`Supprimer l'article ${a.code} — ${a.designationFr} ?`)) return;
    try {
      await supprimerArticle(a.code);
      tracer('suppression', 'articles', `${a.code} — ${a.designationFr}`);
      void charger(recherche);
    } catch (e) {
      notifier(messageErreur(e), 'erreur');
    }
  }

  async function lireImport(f: File) {
    try {
      const lignes = sansEntete(await lireFeuille(f));
      const liste: ArticleSaisi[] = lignes
        .filter((r) => (r[0] ?? '').trim())
        .map((r) => ({
          code: (r[0] ?? '').trim(),
          designationFr: r[1] ?? '',
          designationAr: r[2] ?? '',
          ingredientsFr: r[3] ?? '',
          ingredientsAr: r[4] ?? '',
          origine: r[5] ?? '',
          colJ: r[6] ?? '',
          gabaritA7: r[7] ?? '',
        }));
      setImport({ articles: liste, nom: f.name });
    } catch (e) {
      notifier(messageErreur(e), 'erreur');
    }
  }

  function analyserFichierGabarits(lignes: Awaited<ReturnType<typeof lireFeuille>>, nom: string, retirer: boolean) {
    void (async () => {
      const lecture = lireAffectations(lignes);
      const cat = await chargerCatalogue();
      const analyse = analyserAffectations(lecture.affectations, cat, gabaritsA7, retirer);
      setImpGab({ nom, analyse, retirer, fichier: lignes });
    })();
  }

  async function lireImportGabarits(f: File) {
    try {
      const lignes = await lireFeuille(f);
      analyserFichierGabarits(lignes, f.name, false);
    } catch (e) {
      notifier(messageErreur(e), 'erreur');
    }
  }

  async function confirmerImportGabarits() {
    if (!impGab || !utilisateur) return;
    try {
      const n = await appliquerGabarits(impGab.analyse.final, utilisateur.nom, (f, t) => setProgression(`Gabarits : ${f} / ${t}…`));
      tracer('modification', 'articles', `Import gabarits A7 « ${impGab.nom} » : ${n} article(s) modifie(s)`);
      notifier(`${n} gabarit(s) mis a jour.`);
      setImpGab(null);
      void charger(recherche);
    } catch (e) {
      notifier(messageErreur(e), 'erreur');
    } finally {
      setProgression(null);
    }
  }

  async function exporterRejets() {
    if (!impGab) return;
    const a = impGab.analyse;
    await ecrireClasseur(
      [
        ['Ligne', 'Code', 'Gabarit', 'Motif'],
        ...a.introuvables.map((r) => [r.ligne, r.code, r.gabaritBrut, 'Code introuvable dans le catalogue']),
        ...a.invalides.map((r) => [r.ligne, r.code, r.gabaritBrut, r.code ? 'Gabarit inconnu' : 'Code vide']),
      ],
      'Rejets',
      `Rejets_import_gabarits_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  }

  async function confirmerImport(traduire: boolean) {
    if (!import_ || !utilisateur) return;
    const liste = [...import_.articles];
    try {
      if (traduire) {
        const aTraduire = liste.filter((a) => a.designationFr && !a.designationAr);
        for (let i = 0; i < aTraduire.length; i++) {
          const a = aTraduire[i] as ArticleSaisi;
          setProgression(`Traduction ${i + 1} / ${aTraduire.length}…`);
          try {
            const ar = await traduireEnArabe(a.designationFr);
            liste[liste.indexOf(a)] = { ...a, designationAr: ar };
          } catch (e) {
            notifier(`Traduction interrompue : ${e instanceof Error ? e.message : ''}`, 'erreur');
            break;
          }
          await new Promise((r) => window.setTimeout(r, 350));
        }
      }
      await importerArticles(liste, utilisateur.nom, (f, t) => setProgression(`Enregistrement ${f} / ${t}…`));
      tracer('creation', 'articles', `Import Excel « ${import_.nom} » : ${liste.length} article(s)`);
      notifier(`${liste.length} article(s) importe(s).`);
      setImport(null);
      void charger(recherche);
    } catch (e) {
      notifier(messageErreur(e), 'erreur');
    } finally {
      setProgression(null);
    }
  }

  async function exporter() {
    try {
      setProgression('Preparation du fichier…');
      const tous = await tousLesArticles();
      await ecrireClasseur(
        [ENTETE, ...tous.map((a) => [a.code, a.designationFr, a.designationAr, a.ingredientsFr, a.ingredientsAr, a.origine, a.colJ, a.gabaritA7])],
        'Catalogue',
        `Catalogue_articles_${new Date().toISOString().slice(0, 10)}.xlsx`,
      );
      tracer('export', 'articles', `Export Excel du catalogue (${tous.length} articles)`);
    } catch (e) {
      notifier(messageErreur(e), 'erreur');
    } finally {
      setProgression(null);
    }
  }

  const modifier = (champ: keyof ArticleSaisi) => (v: string) => setFiche((f) => (f ? { ...f, [champ]: v } : f));

  return (
    <AppShell
      titre="Catalogue articles"
      sousTitre={total !== null ? `${total.toLocaleString('fr-FR')} article(s) — base unique partagee A7 / affiches / balisage` : 'Base unique partagee'}
      actions={
        <>
          {estAdmin ? (
            <>
              <label className="bouton bouton--discret">
                Importer Excel
                <input type="file" accept=".xlsx,.xls,.csv" className="visually-hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void lireImport(f); }} />
              </label>
              <label className="bouton bouton--discret">
                Import gabarits A7
                <input type="file" accept=".xlsx,.xls,.csv" className="visually-hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void lireImportGabarits(f); }} />
              </label>
              <button type="button" className="bouton bouton--discret" onClick={() => void exporter()}>Exporter Excel</button>
            </>
          ) : null}
          <button type="button" className="bouton bouton--principal" onClick={() => { setFiche({ ...ARTICLE_VIDE }); setFicheNouvelle(true); }}>
            Nouvel article
          </button>
        </>
      }
    >
      {erreur ? <p className="bandeau bandeau--erreur">{erreur}</p> : null}
      {progression ? <p className="bandeau bandeau--alerte">{progression}</p> : null}

      {impGab ? (
        <section className="carte carte--import">
          <h2 className="carte__titre">Import des gabarits A7 « {impGab.nom} »</h2>
          <p className="carte__texte">
            <strong>{impGab.analyse.aModifier.length}</strong> article(s) a modifier · {impGab.analyse.inchangees} deja a jour ·{' '}
            <strong>{impGab.analyse.introuvables.length}</strong> code(s) introuvable(s) · <strong>{impGab.analyse.invalides.length}</strong> ligne(s) invalide(s) (gabarit inconnu ou code vide)
            {impGab.analyse.doublons ? ` · ${impGab.analyse.doublons} doublon(s) (derniere ligne retenue)` : ''}
            {impGab.analyse.videsIgnores ? ` · ${impGab.analyse.videsIgnores} gabarit(s) vide(s) ignore(s)` : ''}.
          </p>
          <label className="carte__texte">
            <input
              type="checkbox"
              checked={impGab.retirer}
              onChange={(e) => analyserFichierGabarits(impGab.fichier, impGab.nom, e.target.checked)}
            />{' '}
            Un gabarit vide dans le fichier retire le gabarit impose (retour en automatique)
          </label>
          {impGab.analyse.aModifier.length ? (
            <table className="tableau">
              <thead>
                <tr><th scope="col">Code</th><th scope="col">Designation</th><th scope="col">Avant</th><th scope="col">Apres</th></tr>
              </thead>
              <tbody>
                {impGab.analyse.aModifier.slice(0, 10).map((m) => (
                  <tr key={m.code}><th scope="row" className="colonne-code">{m.code}</th><td>{m.designation}</td><td>{m.avant || 'auto'}</td><td>{m.apres || 'auto'}</td></tr>
                ))}
              </tbody>
            </table>
          ) : null}
          {impGab.analyse.aModifier.length > 10 ? <p className="carte__texte carte__texte--discret">… et {impGab.analyse.aModifier.length - 10} autre(s).</p> : null}
          <div className="actions-formulaire">
            <button type="button" className="bouton bouton--principal" disabled={Boolean(progression) || impGab.analyse.aModifier.length === 0} onClick={() => void confirmerImportGabarits()}>
              Appliquer {impGab.analyse.aModifier.length} modification(s)
            </button>
            {impGab.analyse.introuvables.length + impGab.analyse.invalides.length > 0 ? (
              <button type="button" className="bouton bouton--discret" onClick={() => void exporterRejets()}>Exporter les lignes rejetees</button>
            ) : null}
            <button type="button" className="bouton bouton--discret" onClick={() => setImpGab(null)}>Annuler</button>
          </div>
        </section>
      ) : null}

      {import_ ? (
        <section className="carte carte--import">
          <h2 className="carte__titre">Import « {import_.nom} »</h2>
          <p className="carte__texte">
            {import_.articles.length} article(s) lus. Les codes existants seront remplaces, les nouveaux ajoutes.
            {' '}{import_.articles.filter((a) => a.designationFr && !a.designationAr).length} sans designation arabe.
          </p>
          <p className="carte__texte carte__texte--discret">Colonnes : {ENTETE.map((c, i) => `${String.fromCharCode(65 + i)} ${c}`).join(' · ')}</p>
          <div className="actions-formulaire">
            <button type="button" className="bouton bouton--principal" disabled={Boolean(progression)} onClick={() => void confirmerImport(false)}>Importer</button>
            <button type="button" className="bouton bouton--discret" disabled={Boolean(progression)} onClick={() => void confirmerImport(true)}>Importer + traduire l&apos;arabe manquant (IA)</button>
            <button type="button" className="bouton bouton--discret" onClick={() => setImport(null)}>Annuler</button>
          </div>
        </section>
      ) : null}

      <section className="carte">
        <div className="barre-filtres">
          <input
            type="search"
            className="recherche"
            placeholder="Code (debut) ou mots de la designation : « lait 1l », « croissant »…"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
        </div>
        {chargement && !articles.length ? (
          <p className="carte__texte carte__texte--discret">Chargement…</p>
        ) : articles.length === 0 ? (
          <p className="carte__texte carte__texte--discret">Aucun article{recherche ? ' pour cette recherche' : ''}.</p>
        ) : (
          <table className="tableau tableau--articles">
            <thead>
              <tr>
                <th scope="col">Code</th>
                <th scope="col">Designation</th>
                <th scope="col">Allergenes</th>
                <th scope="col">Origine</th>
                <th scope="col">Gabarit A7</th>
                <th scope="col"><span className="visually-hidden">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {articles.map((a) => {
                const alg = detecterAllergenes(a.ingredientsFr);
                return (
                  <tr key={a.code}>
                    <th scope="row" className="colonne-code">{a.code}</th>
                    <td>
                      <strong>{a.designationFr || '—'}</strong>
                      {a.designationAr ? <span className="reference texte-arabe" dir="rtl">{a.designationAr}</span> : <span className="reference">arabe manquant</span>}
                    </td>
                    <td>
                      <div className="pastilles">
                        {alg.slice(0, 4).map((x) => <span key={x} className="pastille pastille--allergene">{x}</span>)}
                        {alg.length > 4 ? <span className="pastille">+{alg.length - 4}</span> : null}
                      </div>
                    </td>
                    <td>{a.origine || '—'}</td>
                    <td>{a.gabaritA7 || 'auto'}</td>
                    <td className="colonne-actions">
                      <button type="button" className="bouton bouton--discret bouton--petit" onClick={() => { setFiche({ ...a }); setFicheNouvelle(false); }}>Modifier</button>
                      {estAdmin ? <button type="button" className="bouton bouton--danger bouton--petit" onClick={() => void supprimer(a)}>Supprimer</button> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <div className="pagination">
          <button type="button" className="bouton bouton--discret bouton--petit" disabled={page === 0} onClick={() => setPage(page - 1)}>‹ Precedent</button>
          <span className="pagination__position">
            Page {page + 1} / {pages} — {resultats.length.toLocaleString('fr-FR')} resultat(s)
          </span>
          <button type="button" className="bouton bouton--discret bouton--petit" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Suivant ›</button>
        </div>
      </section>

      {fiche ? (
        <div className="modale" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setFiche(null); }}>
          <div className="modale__carte modale__carte--large">
            <h2 className="modale__titre">{ficheNouvelle ? 'Nouvel article' : `Article ${fiche.code}`}</h2>
            <div className="grille">
              <div className="champ">
                <label htmlFor="f-code">Code article</label>
                <input id="f-code" type="text" value={fiche.code} disabled={!ficheNouvelle} onChange={(e) => modifier('code')(e.target.value)} />
              </div>
              <div className="champ">
                <label htmlFor="f-gab">Gabarit A7 impose</label>
                <select id="f-gab" value={fiche.gabaritA7} onChange={(e) => modifier('gabaritA7')(e.target.value)}>
                  <option value="">Automatique (prefixe / designation)</option>
                  {gabaritsA7.map((g) => <option key={g.id} value={g.id}>{g.id} — {g.nom}</option>)}
                </select>
              </div>
              <ChampTexte id="f-desfr" libelle="Designation FR" valeur={fiche.designationFr} surChange={modifier('designationFr')} maxLength={80} />
              <ChampTexte id="f-desar" libelle="Designation AR" valeur={fiche.designationAr} surChange={modifier('designationAr')} arabe sourceTraduction={fiche.designationFr} maxLength={80} />
              <ChampTexte id="f-ingfr" libelle="Ingredients FR" valeur={fiche.ingredientsFr} surChange={modifier('ingredientsFr')} multiligne aide="Les allergenes sont detectes automatiquement et imprimes en rouge gras." />
              <ChampTexte id="f-ingar" libelle="Ingredients AR" valeur={fiche.ingredientsAr} surChange={modifier('ingredientsAr')} multiligne arabe sourceTraduction={fiche.ingredientsFr} nature="ingredients" />
              <ChampTexte id="f-orig" libelle="Origine (pays, drapeau A7)" valeur={fiche.origine} surChange={modifier('origine')} placeholder="France, Maroc…" />
              <ChampTexte id="f-colj" libelle="Information complementaire (col. J)" valeur={fiche.colJ} surChange={modifier('colJ')} />
            </div>
            <div className="actions-formulaire">
              <button type="button" className="bouton bouton--principal" disabled={envoi} onClick={() => void enregistrer()}>{envoi ? 'Enregistrement…' : 'Enregistrer'}</button>
              <button type="button" className="bouton bouton--discret" onClick={() => setFiche(null)}>Annuler</button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
