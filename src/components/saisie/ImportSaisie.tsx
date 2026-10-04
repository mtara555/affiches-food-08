/**
 * Import d'un fichier Excel dans une campagne (saisie en masse).
 * Le fichier est d'abord analyse et affiche ; rien n'est ecrit avant
 * confirmation.
 */

import { useState } from 'react';
import type { TypeCampagne } from '../../config/constants';
import type { Article, SaisieElement } from '../../lib/types';
import { useDonnees } from '../../context/DonneesContext';
import { gabaritA7Pour, normaliserCode, trouverArticles } from '../../lib/articles';
import { ecrireClasseur, lireFeuille, nombre, sansEntete } from '../../lib/excel';
import { formaterPrix } from '../../rendu/commun';
import { messageErreur } from '../../lib/firebase';
import { notifier } from '../Notifications';


interface LigneAnalysee {
  readonly numero: number;
  readonly code: string;
  readonly libelle: string;
  readonly detail: string;
  readonly saisie: SaisieElement | null;
  readonly probleme: string;
}

interface Props {
  readonly type: TypeCampagne;
  readonly surAjouter: (elements: SaisieElement[]) => Promise<void>;
}

const COLONNES_A7 = ['Code', 'Prix', 'Unite', 'Gabarit (vide = auto)', 'Poids kg (B_FIL…)', 'Fidelite %'];
const COLONNES: Readonly<Record<TypeCampagne, string[]>> = {
  A7: COLONNES_A7,
  VRAC: COLONNES_A7,
  AFFICHE: ['Code', 'Prix barre', 'Prix promo', 'Fidelite %', 'Picto (nom)', 'Gabarit (nom)', 'Secteur (FOOD / NONFOOD)'],
  BALISAGE: ['Code', 'Gabarit (BOUL / PAT)', 'Designation FR', 'Designation AR', 'Ingredients FR', 'Ingredients AR'],
};

const EXEMPLES: Readonly<Record<TypeCampagne, (string | number)[]>> = {
  A7: ['2690012000000', '12,50', 'pièce', '', '', ''],
  VRAC: ['2690012000000', '12,50', 'kg', '', '', ''],
  AFFICHE: ['6111234567890', '29,90', '19,90', '10', '', 'PROMO ROUGE', 'FOOD'],
  BALISAGE: ['2690012000000', 'BOUL', '', '', '', ''],
};

export function ImportSaisie({ type, surAjouter }: Props) {
  const { parametres, gabaritsAffiche, gabaritsBalisage, pictos } = useDonnees();
  const [lignes, setLignes] = useState<LigneAnalysee[] | null>(null);
  const [nomFichier, setNomFichier] = useState('');
  const [analyse, setAnalyse] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  function trouverGabaritAffiche(nom: string): string {
    const n = nom.trim().toLowerCase();
    if (!n) return '';
    const g =
      gabaritsAffiche.find((x) => x.id.toLowerCase() === n || x.nom.toLowerCase() === n) ??
      gabaritsAffiche.find((x) => x.id.toLowerCase().includes(n) || x.nom.toLowerCase().includes(n));
    return g?.id ?? '';
  }

  function analyserLigne(r: string[], numero: number, articles: Map<string, Article>): LigneAnalysee {
    const code = normaliserCode(r[0] ?? '');
    const a = articles.get(code) ?? null;
    if (type === 'A7' || type === 'VRAC') {
      const prix = nombre(r[1]);
      if (!a) return { numero, code, libelle: '', detail: '', saisie: null, probleme: 'Code absent du catalogue' };
      if (!(prix > 0)) return { numero, code, libelle: a.designationFr, detail: '', saisie: null, probleme: 'Prix manquant' };
      const gab = (r[3] ?? '').trim().toUpperCase() || gabaritA7Pour(code, a, parametres.mapping);
      return {
        numero,
        code,
        libelle: a.designationFr,
        detail: `${formaterPrix(prix)} DH · ${gab}`,
        probleme: '',
        saisie: {
          code,
          designationFr: a.designationFr,
          designationAr: a.designationAr,
          ingredientsFr: a.ingredientsFr,
          ingredientsAr: a.ingredientsAr,
          origine: a.origine,
          prix: formaterPrix(prix),
          unite: (r[2] ?? '').trim() || 'pièce',
          gabarit: gab,
          grammage: (r[4] ?? '').trim(),
          fidelite: (r[5] ?? '').trim(),
        },
      };
    }
    if (type === 'AFFICHE') {
      const barre = nombre(r[1]);
      const promo = nombre(r[2]);
      if (!(promo > 0)) return { numero, code, libelle: a?.designationFr ?? '', detail: '', saisie: null, probleme: 'Prix promo manquant' };
      const nomPicto = (r[4] ?? '').trim().toLowerCase();
      const picto = nomPicto ? (pictos.find((p) => p.nom.toLowerCase() === nomPicto || p.id.toLowerCase() === nomPicto)?.id ?? '') : '';
      const gabarit = trouverGabaritAffiche(r[5] ?? '') || gabaritsAffiche[0]?.id || '';
      const secteur = /non/i.test(r[6] ?? '') ? 'nonfood' : 'food';
      return {
        numero,
        code,
        libelle: a?.designationFr ?? '(designation vide)',
        detail: `${barre ? `${formaterPrix(barre)} → ` : ''}${formaterPrix(promo)} DH · ${secteur === 'food' ? 'Food' : 'Non Food'}`,
        probleme: a ? (nomPicto && !picto ? 'Picto introuvable (ignore)' : '') : 'Absent du catalogue (designation vide)',
        saisie: {
          code,
          desFR: a?.designationFr ?? '',
          desAR: a?.designationAr ?? '',
          barre,
          promo,
          fidelite: nombre(r[3]),
          secteur,
          picto,
          gabarit,
        },
      };
    }
    const g = (r[1] ?? '').trim().toUpperCase();
    const gabarit = gabaritsBalisage.some((x) => x.id === g) ? g : 'BOUL';
    const desFR = (r[2] ?? '').trim() || a?.designationFr || '';
    const desAR = (r[3] ?? '').trim() || a?.designationAr || '';
    if (!desFR && !desAR) return { numero, code, libelle: '', detail: '', saisie: null, probleme: 'Ni article ni designation' };
    return {
      numero,
      code,
      libelle: desFR || desAR,
      detail: gabarit,
      probleme: code && !a ? 'Absent du catalogue (valeurs du fichier)' : '',
      saisie: {
        code,
        gabarit,
        desFR,
        desAR,
        ingFR: (r[4] ?? '').trim() || a?.ingredientsFr || '',
        ingAR: (r[5] ?? '').trim() || a?.ingredientsAr || '',
      },
    };
  }

  async function lireFichier(fichier: File) {
    setAnalyse(true);
    setNomFichier(fichier.name);
    try {
      const brutes = sansEntete(await lireFeuille(fichier)).filter((r) => r.some((c) => c));
      const articles = await trouverArticles(brutes.map((r) => r[0] ?? ''));
      setLignes(brutes.map((r, i) => analyserLigne(r, i + 2, articles)));
    } catch (e) {
      notifier(messageErreur(e), 'erreur');
      setLignes(null);
    } finally {
      setAnalyse(false);
    }
  }

  const valides = lignes?.filter((l) => l.saisie) ?? [];

  async function confirmer() {
    setEnvoi(true);
    try {
      await surAjouter(valides.map((l) => l.saisie as SaisieElement));
      notifier(`${valides.length} element(s) importe(s).`);
      setLignes(null);
    } catch (e) {
      notifier(messageErreur(e), 'erreur');
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <section className="carte carte--import">
      <div className="carte__entete">
        <h2 className="carte__titre">Import Excel</h2>
        <button
          type="button"
          className="bouton bouton--discret bouton--petit"
          onClick={() => void ecrireClasseur([COLONNES[type], EXEMPLES[type]], 'Saisie', `modele_import_${type.toLowerCase()}.xlsx`)}
        >
          Telecharger le modele
        </button>
      </div>
      <p className="carte__texte">
        Colonnes attendues (1re ligne = en-tete) : {COLONNES[type].map((c, i) => `${String.fromCharCode(65 + i)} ${c}`).join(' · ')}.
      </p>

      <label className={`bouton bouton--principal${analyse ? ' est-desactive' : ''}`} style={{ display: 'inline-flex', marginTop: 12 }}>
        {analyse ? 'Analyse…' : 'Choisir un fichier .xlsx / .csv'}
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          className="visually-hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void lireFichier(f);
          }}
        />
      </label>

      {lignes ? (
        <>
          <p className="carte__texte" style={{ marginTop: 12 }}>
            <strong>{nomFichier}</strong> — {lignes.length} ligne(s), {valides.length} importable(s)
            {lignes.length - valides.length ? `, ${lignes.length - valides.length} ignoree(s)` : ''}.
          </p>
          <div className="import-saisie__tableau">
            <table className="tableau">
              <thead>
                <tr>
                  <th scope="col">Ligne</th>
                  <th scope="col">Code</th>
                  <th scope="col">Article</th>
                  <th scope="col">Detail</th>
                  <th scope="col">Etat</th>
                </tr>
              </thead>
              <tbody>
                {lignes.slice(0, 300).map((l) => (
                  <tr key={l.numero} className={l.saisie ? undefined : 'import-saisie__ligne--erreur'}>
                    <td>{l.numero}</td>
                    <th scope="row">{l.code || '—'}</th>
                    <td>{l.libelle || '—'}</td>
                    <td>{l.detail}</td>
                    <td>
                      {l.saisie ? (
                        <span className={`etiquette ${l.probleme ? 'etiquette--alerte' : 'etiquette--ok'}`}>{l.probleme || 'OK'}</span>
                      ) : (
                        <span className="etiquette etiquette--inactive">{l.probleme}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="actions-formulaire">
            <button type="button" className="bouton bouton--principal" disabled={envoi || !valides.length} onClick={() => void confirmer()}>
              {envoi ? 'Import…' : `Ajouter ${valides.length} element(s) a la campagne`}
            </button>
            <button type="button" className="bouton bouton--discret" onClick={() => setLignes(null)}>
              Annuler
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}
