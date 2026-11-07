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

export type FournisseurIa = 'groq' | 'openai';

export interface ReglagesIa {
  /** Service utilise pour la traduction. */
  fournisseur: FournisseurIa;
  /** Cle API Groq (gsk_…), gratuite. */
  cleGroq: string;
  /** Cle API OpenAI (sk-…), payante a l'usage. */
  cleOpenai: string;
  modeleGroq: string;
  modeleOpenai: string;
}

export const MODELES_IA_DEFAUT: Readonly<Record<FournisseurIa, string>> = {
  groq: 'llama-3.3-70b-versatile',
  // Alias OpenAI du modele conversationnel GPT-5 (sans raisonnement : rapide, accepte temperature = 0).
  openai: 'gpt-5-chat-latest',
};

const texte = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/**
 * Reglages IA valides a partir d'un document Firestore, ancien ou nouveau :
 * l'ancien champ unique « modele » est range chez le bon fournisseur (gpt… = OpenAI, sinon Groq).
 */
export function normaliserReglagesIa(d: Record<string, unknown>): ReglagesIa {
  const ancien = texte(d.modele);
  const ancienOpenai = /^(gpt|chatgpt|o\d)/i.test(ancien);
  const cleGroq = texte(d.cleGroq);
  const cleOpenai = texte(d.cleOpenai);
  const fournisseur: FournisseurIa = d.fournisseur === 'openai' || d.fournisseur === 'groq' ? d.fournisseur : cleOpenai && !cleGroq ? 'openai' : 'groq';
  return {
    fournisseur,
    cleGroq,
    cleOpenai,
    modeleGroq: texte(d.modeleGroq) || (ancien && !ancienOpenai ? ancien : MODELES_IA_DEFAUT.groq),
    modeleOpenai: texte(d.modeleOpenai) || (ancien && ancienOpenai ? ancien : MODELES_IA_DEFAUT.openai),
  };
}

export async function chargerReglagesIa(): Promise<ReglagesIa> {
  try {
    const s = await getDoc(refIa());
    return normaliserReglagesIa(s.exists() ? (s.data() as Record<string, unknown>) : {});
  } catch {
    return normaliserReglagesIa({});
  }
}

export async function enregistrerReglagesIa(r: ReglagesIa): Promise<void> {
  await ecrire(refIa(), { ...r });
}
