/**
 * Parametres partages (document unique `parametres/general`)
 * et reglages IA (document `parametres/ia`, lisible par tout utilisateur actif).
 */

import { doc, getDoc } from 'firebase/firestore';
import { ecrire } from './ecriture';
import { db, COLLECTIONS } from './firebase';
import type { CouleursA7, Parametres, RegleMapping } from './types';
import { COULEURS_BALISAGE_DEFAUT } from '../rendu/balisage';
import { MAGASIN } from '../config/constants';

export const MAPPING_DEFAUT: RegleMapping[] = [
  { prefixe: '2658', gabarit: 'FROM', libelle: 'Fromages affines' },
  { prefixe: '265', gabarit: 'FROM', libelle: 'Fromages' },
  { prefixe: '2675', gabarit: 'PAT', libelle: 'Viennoiserie' },
  { prefixe: '267', gabarit: 'PAT', libelle: 'Patisserie' },
  { prefixe: '269', gabarit: 'BOUL', libelle: 'Boulangerie' },
  { prefixe: '266', gabarit: 'TRAIT', libelle: 'Traiteur' },
  { prefixe: '263', gabarit: 'B_VOL', libelle: 'Boucherie volaille' },
  { prefixe: '262', gabarit: 'B_AGN', libelle: 'Boucherie agneau' },
];

export const COULEURS_A7_DEFAUT: CouleursA7 = {
  designation: '#FFFFFF',
  designationNoBg: '#111111',
  prix: '#8B0000',
  prixNoBg: '#000000',
  unite: '#F5E6C8',
  uniteNoBg: '#333333',
  ingredientsFr: '#FFFFFF',
  ingredientsFrNoBg: '#000000',
  ingredientsAr: '#F5E6C8',
  ingredientsArNoBg: '#000000',
  allergen: '#FF0000',
};

export const PARAMETRES_DEFAUT: Parametres = {
  mapping: MAPPING_DEFAUT,
  couleursA7: COULEURS_A7_DEFAUT,
  couleursBalisage: COULEURS_BALISAGE_DEFAUT,
  seuilEconomieFoodDh: 5,
  seuilEconomieNonFoodPct: 10,
  enteteAffiche: MAGASIN,
  signatureActive: true,
  signatureTexte: 'Marjane08',
  piedDePage: true,
};

const refGeneral = () => doc(db, COLLECTIONS.PARAMETRES, 'general');
const refIa = () => doc(db, COLLECTIONS.PARAMETRES, 'ia');

export async function chargerParametres(): Promise<Parametres> {
  try {
    const s = await getDoc(refGeneral());
    if (!s.exists()) return PARAMETRES_DEFAUT;
    const d = s.data() as Partial<Parametres>;
    return {
      ...PARAMETRES_DEFAUT,
      ...d,
      couleursA7: { ...COULEURS_A7_DEFAUT, ...(d.couleursA7 ?? {}) },
      couleursBalisage: { ...COULEURS_BALISAGE_DEFAUT, ...(d.couleursBalisage ?? {}) },
      mapping: Array.isArray(d.mapping) ? d.mapping : MAPPING_DEFAUT,
    };
  } catch {
    return PARAMETRES_DEFAUT;
  }
}

export async function enregistrerParametres(p: Parametres): Promise<void> {
  await ecrire(refGeneral(), p);
}

/* -------------------------------------------------------------------------- */
/* Traduction IA                                                               */
/* -------------------------------------------------------------------------- */

export interface ReglagesIa {
  cleGroq: string;
  modele: string;
}

export const MODELE_IA_DEFAUT = 'llama-3.3-70b-versatile';

export async function chargerReglagesIa(): Promise<ReglagesIa> {
  try {
    const s = await getDoc(refIa());
    const d = (s.exists() ? s.data() : {}) as Partial<ReglagesIa>;
    return { cleGroq: d.cleGroq ?? '', modele: d.modele || MODELE_IA_DEFAUT };
  } catch {
    return { cleGroq: '', modele: MODELE_IA_DEFAUT };
  }
}

export async function enregistrerReglagesIa(r: ReglagesIa): Promise<void> {
  await ecrire(refIa(), { ...r });
}
