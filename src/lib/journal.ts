/**
 * Journal d'activite
 *
 * Qui fait quoi, quand, depuis quel appareil : connexions, saisies,
 * impressions, catalogue, gabarits, parametres.
 * Regles Firestore : creation par tout utilisateur actif (en son nom),
 * lecture reservee aux administrateurs, aucune modification ni suppression.
 * L'ecriture ne bloque jamais le travail de l'utilisateur.
 */

import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db, COLLECTIONS } from './firebase';

export type ActionJournal = 'creation' | 'modification' | 'suppression' | 'export' | 'connexion';

export type RessourceJournal =
  | 'session'
  | 'elements'
  | 'articles'
  | 'campagnes'
  | 'gabarits'
  | 'parametres'
  | 'utilisateurs'
  | 'impression';

export const LIBELLE_RESSOURCE: Readonly<Record<string, string>> = {
  session: 'Connexion',
  elements: 'Saisie',
  articles: 'Catalogue',
  campagnes: 'Campagnes',
  gabarits: 'Gabarits',
  parametres: 'Parametres',
  utilisateurs: 'Utilisateurs',
  impression: 'Impression',
};

export const LIBELLE_ACTION: Readonly<Record<ActionJournal, string>> = {
  creation: 'Ajout',
  modification: 'Modification',
  suppression: 'Suppression',
  export: 'Impression / export',
  connexion: 'Connexion',
};

export interface EntreeJournal {
  readonly id: string;
  readonly date: Date;
  readonly action: ActionJournal;
  readonly ressource: string;
  readonly userId: string;
  readonly utilisateur: string;
  readonly appareil: string;
  readonly detail: string;
}

interface Auteur {
  readonly id: string;
  readonly nom: string;
}

let auteur: Auteur | null = null;
const CLE_NOM_APPAREIL = 'affiches-food.nom-appareil';

export function nomAppareilLocal(): string {
  try {
    return localStorage.getItem(CLE_NOM_APPAREIL) ?? '';
  } catch {
    return '';
  }
}

export function definirNomAppareilLocal(nom: string): void {
  try {
    if (nom.trim()) localStorage.setItem(CLE_NOM_APPAREIL, nom.trim().slice(0, 60));
    else localStorage.removeItem(CLE_NOM_APPAREIL);
  } catch {
    /* stockage indisponible */
  }
}

export function definirAuteur(u: Auteur | null): void {
  auteur = u;
}

function decrireAppareil(): string {
  const ua = navigator.userAgent;
  const type = /Mobi|Android|iPhone/i.test(ua) ? 'Telephone' : /iPad|Tablet/i.test(ua) ? 'Tablette' : 'Ordinateur';
  const systeme =
    /Windows/i.test(ua) ? 'Windows' : /Android/i.test(ua) ? 'Android' : /iPhone|iPad|Mac OS/i.test(ua) ? 'Apple' : /Linux/i.test(ua) ? 'Linux' : '';
  const navigateur = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : '';
  const nom = nomAppareilLocal();
  return [nom ? `« ${nom} »` : '', [type, systeme, navigateur].filter(Boolean).join(' · ')]
    .filter(Boolean)
    .join(' — ');
}

export async function journaliser(action: ActionJournal, ressource: RessourceJournal, detail: string): Promise<void> {
  if (!auteur) return;
  try {
    await addDoc(collection(db, COLLECTIONS.JOURNAL), {
      date: serverTimestamp(),
      action,
      ressource,
      userId: auteur.id,
      utilisateur: auteur.nom.slice(0, 120),
      appareil: decrireAppareil().slice(0, 250),
      detail: detail.slice(0, 2000),
    });
  } catch (e) {
    console.warn('[journal] ecriture impossible', e);
  }
}

/** Version « on n'attend pas ». */
export function tracer(action: ActionJournal, ressource: RessourceJournal, detail: string): void {
  void journaliser(action, ressource, detail);
}

/** Lignes depuis une date (2 000 au plus, les plus recentes d'abord). */
export async function lireJournal(depuis: Date): Promise<EntreeJournal[]> {
  const q = query(
    collection(db, COLLECTIONS.JOURNAL),
    where('date', '>=', Timestamp.fromDate(depuis)),
    orderBy('date', 'desc'),
    limit(2000),
  );
  const res = await getDocs(q);
  return res.docs.map((d) => {
    const v = d.data() as Record<string, unknown>;
    const date = v.date instanceof Timestamp ? v.date.toDate() : new Date();
    return {
      id: d.id,
      date,
      action: (v.action as ActionJournal) ?? 'modification',
      ressource: String(v.ressource ?? ''),
      userId: String(v.userId ?? ''),
      utilisateur: String(v.utilisateur ?? ''),
      appareil: String(v.appareil ?? ''),
      detail: String(v.detail ?? ''),
    };
  });
}
