/**
 * Gabarits (A7, affiches, balisage) et bibliotheque de pictos.
 *
 * Tant qu'un administrateur n'a rien enregistre, les gabarits par defaut
 * (valeurs du modele PowerPoint, fonds dessines) sont utilises : l'application
 * est utilisable des la premiere connexion.
 */

import { collection, doc, getDocs, limit, query } from 'firebase/firestore';
import { ecrire, supprimer } from './ecriture';
import { db, COLLECTIONS } from './firebase';
import type { GabaritA7, GabaritAffiche, GabaritBalisage, Picto } from './types';
import { GABARITS_A7 } from '../config/constants';
import { gabaritsAfficheParDefaut } from '../rendu/affiche';
import { gabaritsBalisageParDefaut } from '../rendu/balisage';

const NOMS_A7: Readonly<Record<string, string>> = {
  PAT: 'Patisserie',
  PAT_M: 'Patisserie (variante)',
  BOUL: 'Boulangerie',
  B_AGN: 'Boucherie agneau',
  B_FIL: 'Boucherie filet (fidelite)',
  B_FIL_MN: 'Boucherie filet MN (fidelite)',
  B_BCK: 'Boucherie',
  B_VOL: 'Boucherie volaille',
  'B_VOL-MN': 'Boucherie volaille MN',
  FROM: 'Fromagerie',
  TRAIT: 'Traiteur',
  FROM_CAN: 'Fromage a la coupe (fidelite)',
  GLACE: 'Glaces',
};

export function gabaritsA7ParDefaut(): GabaritA7[] {
  return GABARITS_A7.map((id, i) => ({ id, nom: NOMS_A7[id] ?? id, image: null, layout: {}, ordre: i + 1 }));
}

async function lireTout<T extends { id: string; ordre?: number }>(nom: string): Promise<T[]> {
  const res = await getDocs(collection(db, nom));
  return res.docs
    .map((d) => ({ ...(d.data() as Omit<T, 'id'>), id: d.id }) as T)
    .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0) || a.id.localeCompare(b.id));
}

/** Fusionne les gabarits enregistres avec ceux par defaut (les enregistres priment). */
function fusionner<T extends { id: string; ordre: number }>(defaut: T[], enregistres: T[]): T[] {
  const map = new Map(defaut.map((g) => [g.id, g]));
  for (const g of enregistres) map.set(g.id, { ...(map.get(g.id) ?? {}), ...g });
  return [...map.values()].sort((a, b) => a.ordre - b.ordre || a.id.localeCompare(b.id));
}

export async function listerGabaritsA7(): Promise<GabaritA7[]> {
  return fusionner(gabaritsA7ParDefaut(), await lireTout<GabaritA7>(COLLECTIONS.GABARITS_A7));
}

export async function listerGabaritsAffiche(): Promise<GabaritAffiche[]> {
  const enregistres = await lireTout<GabaritAffiche>(COLLECTIONS.GABARITS_AFFICHE);
  // Des qu'un gabarit d'affiche a ete enregistre, la liste Firestore fait foi
  // (l'administrateur a pu supprimer des gabarits par defaut).
  return enregistres.length ? enregistres : gabaritsAfficheParDefaut();
}

/** Vrai si au moins un gabarit d'affiche est deja enregistre dans Firestore. */
export async function gabaritsAfficheEnregistres(): Promise<boolean> {
  const res = await getDocs(query(collection(db, COLLECTIONS.GABARITS_AFFICHE), limit(1)));
  return !res.empty;
}

export async function listerGabaritsBalisage(): Promise<GabaritBalisage[]> {
  return fusionner(gabaritsBalisageParDefaut(), await lireTout<GabaritBalisage>(COLLECTIONS.GABARITS_BALISAGE));
}

export async function listerPictos(): Promise<Picto[]> {
  const res = await getDocs(collection(db, COLLECTIONS.PICTOS));
  return res.docs
    .map((d) => ({ ...(d.data() as Omit<Picto, 'id'>), id: d.id }))
    .sort((a, b) => a.nom.localeCompare(b.nom));
}

/** Retire l'identifiant (porte par le chemin du document). */
function sansId<T extends { id: string }>(g: T): Omit<T, 'id'> {
  const { id: _id, ...reste } = g;
  void _id;
  return reste;
}

export const enregistrerGabaritA7 = (g: GabaritA7) => ecrire(doc(db, COLLECTIONS.GABARITS_A7, g.id), sansId(g));
export const enregistrerGabaritAffiche = (g: GabaritAffiche) =>
  ecrire(doc(db, COLLECTIONS.GABARITS_AFFICHE, g.id), sansId(g));
export const enregistrerGabaritBalisage = (g: GabaritBalisage) =>
  ecrire(doc(db, COLLECTIONS.GABARITS_BALISAGE, g.id), sansId(g));
export const enregistrerPicto = (p: Picto) => ecrire(doc(db, COLLECTIONS.PICTOS, p.id), sansId(p));

export const supprimerGabaritA7 = (id: string) => supprimer(doc(db, COLLECTIONS.GABARITS_A7, id));
export const supprimerGabaritAffiche = (id: string) => supprimer(doc(db, COLLECTIONS.GABARITS_AFFICHE, id));
export const supprimerGabaritBalisage = (id: string) => supprimer(doc(db, COLLECTIONS.GABARITS_BALISAGE, id));
export const supprimerPicto = (id: string) => supprimer(doc(db, COLLECTIONS.PICTOS, id));

/** Identifiant de document sur a partir d'un nom (« Promo Été » -> « PROMO_ETE »). */
export function identifiantDepuisNom(nom: string): string {
  return (
    nom
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || `G_${Date.now()}`
  );
}
