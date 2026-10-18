/**
 * Import Excel « gabarit A7 impose » : lecture du fichier (code + nom de gabarit)
 * et analyse avant validation. Aucune ecriture ici : voir appliquerGabarits()
 * dans articles.ts.
 */

import { GABARITS_A7 } from '../config/constants';
import { normaliserCode } from './articles';
import type { Article } from './types';
import type { Ligne } from './excel';

export interface AffectationGabarit {
  readonly ligne: number; // numero de ligne Excel (1 = premiere ligne du fichier)
  readonly code: string;
  readonly gabaritBrut: string;
}

export interface LectureGabarits {
  readonly affectations: AffectationGabarit[];
  readonly colonneCode: number;
  readonly colonneGabarit: number;
  readonly avecEntete: boolean;
}

export interface Modification {
  readonly code: string;
  readonly designation: string;
  readonly avant: string; // '' = automatique
  readonly apres: string; // '' = retrait du gabarit impose
}

export interface AnalyseGabarits {
  readonly aModifier: Modification[];
  readonly inchangees: number;
  readonly introuvables: AffectationGabarit[];
  readonly invalides: AffectationGabarit[];
  readonly videsIgnores: number;
  readonly doublons: number;
}

const cle = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Code lu dans Excel : « 6111234567890.0 » -> « 6111234567890 ». */
function codePropre(brut: string): string {
  const c = normaliserCode(brut);
  return /^\d+\.0+$/.test(c) ? c.replace(/\.0+$/, '') : c;
}

/** Detecte les colonnes par leur en-tete ; sans en-tete : colonne A = code, B = gabarit. */
export function lireAffectations(lignes: Ligne[]): LectureGabarits {
  const entete = lignes[0] ?? [];
  const cles = entete.map(cle);
  let iCode = cles.findIndex((c) => ['code', 'codearticle', 'ean', 'codebarre', 'codebarres', 'article', 'codeean'].includes(c));
  let iGab = cles.findIndex((c) => c.includes('gabarit') || c === 'modele' || c === 'template');
  let avecEntete = iCode >= 0 && iGab >= 0;
  if (!avecEntete) {
    // Pas d'en-tete reconnu : si la 1re cellule n'est pas numerique, on suppose tout de meme une ligne de titres.
    iCode = 0;
    iGab = 1;
    avecEntete = Boolean(entete[0]) && !/^\d/.test(entete[0] ?? '');
  }
  const debut = avecEntete ? 1 : 0;
  const affectations: AffectationGabarit[] = [];
  for (let i = debut; i < lignes.length; i++) {
    const r = lignes[i] ?? [];
    const code = codePropre(r[iCode] ?? '');
    const gab = (r[iGab] ?? '').trim();
    if (!code && !gab) continue; // ligne vide
    affectations.push({ ligne: i + 1, code, gabaritBrut: gab });
  }
  return { affectations, colonneCode: iCode, colonneGabarit: iGab, avecEntete };
}

/**
 * Compare le fichier au catalogue. `gabarits` = gabarits A7 connus (id + nom) ;
 * un gabarit est reconnu par son identifiant (PAT, B_FIL…) ou par son nom,
 * sans tenir compte des majuscules, accents, espaces, tirets ou soulignes.
 */
export function analyserAffectations(
  affectations: readonly AffectationGabarit[],
  catalogue: ReadonlyMap<string, Article>,
  gabarits: readonly { id: string; nom: string }[],
  retirerSiVide: boolean,
): AnalyseGabarits & { final: Map<string, string> } {
  const index = new Map<string, string>();
  for (const id of GABARITS_A7) index.set(cle(id), id);
  for (const g of gabarits) {
    if (!GABARITS_A7.includes(g.id)) continue;
    index.set(cle(g.id), g.id);
    if (g.nom) index.set(cle(g.nom), g.id);
  }

  const final = new Map<string, string>(); // code -> gabarit (derniere ligne gagne)
  const introuvables: AffectationGabarit[] = [];
  const invalides: AffectationGabarit[] = [];
  let videsIgnores = 0;
  let doublons = 0;

  for (const a of affectations) {
    if (!a.code) {
      invalides.push(a);
      continue;
    }
    if (!catalogue.has(a.code)) {
      introuvables.push(a);
      continue;
    }
    let id = '';
    if (a.gabaritBrut) {
      const trouve = index.get(cle(a.gabaritBrut));
      if (!trouve) {
        invalides.push(a);
        continue;
      }
      id = trouve;
    } else if (!retirerSiVide) {
      videsIgnores++;
      continue;
    }
    if (final.has(a.code)) doublons++;
    final.set(a.code, id);
  }

  const aModifier: Modification[] = [];
  let inchangees = 0;
  for (const [code, apres] of final) {
    const art = catalogue.get(code) as Article;
    const avant = (art.gabaritA7 ?? '').trim().toUpperCase();
    if (avant === apres) inchangees++;
    else aModifier.push({ code, designation: art.designationFr, avant, apres });
  }
  return { aModifier, inchangees, introuvables, invalides, videsIgnores, doublons, final };
}
