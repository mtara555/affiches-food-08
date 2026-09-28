/**
 * Catalogue articles — stockage « par lots » adapte au plan gratuit Firebase
 *
 * La base compte plus de 57 000 articles. Un document Firestore par article
 * couterait 57 000 ecritures a chaque import (limite gratuite : 20 000 par
 * jour) et des milliers de lectures par jour. Les articles sont donc ranges
 * dans 64 « lots » :
 *
 *   catalogue/lot_00 … lot_63   { d: JSON {code: [champs…]}, v: version, n: nombre }
 *   catalogue/_meta             { versions: {lot_00: v, …}, total }
 *
 * Chaque poste garde une copie des lots dans son navigateur (IndexedDB) et ne
 * telecharge que les lots modifies depuis sa derniere visite (1 lecture pour
 * _meta + les lots changes). Recherche et scan sont instantanes, hors ligne.
 *
 * Modifier un article = 1 transaction (lot + _meta). Importer 57 000 articles
 * = 64 transactions.
 */

import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db, COLLECTIONS } from './firebase';
import type { Article, ArticleSaisi, RegleMapping } from './types';
import { GABARITS_A7 } from '../config/constants';

export const NB_LOTS = 64;

/** [designationFr, designationAr, ingredientsFr, ingredientsAr, origine, colJ, gabaritA7, majLe(ms), majPar] */
type Ligne = [string, string, string, string, string, string, string, number, string];
type ContenuLot = Record<string, Ligne>;

interface Meta {
  versions: Record<string, number>;
  total: number;
}

const refMeta = () => doc(db, COLLECTIONS.CATALOGUE, '_meta');
const refLot = (id: string) => doc(db, COLLECTIONS.CATALOGUE, id);

/** Normalise un code saisi ou scanne. */
export function normaliserCode(code: string): string {
  return code.trim().replace(/\s+/g, '').replace(/\//g, '-');
}

/** Lot d'un code (hachage FNV-1a, stable). */
export function lotDe(code: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < code.length; i++) {
    h ^= code.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `lot_${String(h % NB_LOTS).padStart(2, '0')}`;
}

function versLigne(a: ArticleSaisi, auteur: string): Ligne {
  return [
    a.designationFr.trim(),
    a.designationAr.trim(),
    a.ingredientsFr.trim(),
    a.ingredientsAr.trim(),
    a.origine.trim(),
    a.colJ.trim(),
    a.gabaritA7.trim().toUpperCase(),
    Date.now(),
    auteur,
  ];
}

function versArticle(code: string, l: Partial<Ligne>): Article {
  return {
    code,
    designationFr: l[0] ?? '',
    designationAr: l[1] ?? '',
    ingredientsFr: l[2] ?? '',
    ingredientsAr: l[3] ?? '',
    origine: l[4] ?? '',
    colJ: l[5] ?? '',
    gabaritA7: l[6] ?? '',
    majLe: l[7] ? new Date(l[7]) : null,
    majPar: l[8] ?? '',
  };
}

function lireLot(d: unknown): ContenuLot {
  if (typeof d !== 'string' || !d) return {};
  try {
    return JSON.parse(d) as ContenuLot;
  } catch {
    return {};
  }
}

/* -------------------------------------------------------------------------- */
/* Copie locale (IndexedDB)                                                    */
/* -------------------------------------------------------------------------- */

interface LotLocal {
  id: string;
  v: number;
  contenu: ContenuLot;
}

let baseLocale: Promise<IDBDatabase | null> | null = null;

function ouvrirBase(): Promise<IDBDatabase | null> {
  baseLocale ??= new Promise((resoudre) => {
    try {
      const req = indexedDB.open('affiches-food-catalogue', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('lots', { keyPath: 'id' });
      req.onsuccess = () => resoudre(req.result);
      req.onerror = () => resoudre(null);
    } catch {
      resoudre(null);
    }
  });
  return baseLocale;
}

async function lotsLocaux(): Promise<Map<string, LotLocal>> {
  const b = await ouvrirBase();
  if (!b) return new Map();
  return new Promise((resoudre) => {
    const req = b.transaction('lots', 'readonly').objectStore('lots').getAll();
    req.onsuccess = () => resoudre(new Map((req.result as LotLocal[]).map((l) => [l.id, l])));
    req.onerror = () => resoudre(new Map());
  });
}

async function memoriserLot(l: LotLocal): Promise<void> {
  const b = await ouvrirBase();
  if (!b) return;
  await new Promise<void>((resoudre) => {
    const tx = b.transaction('lots', 'readwrite');
    tx.objectStore('lots').put(l);
    tx.oncomplete = () => resoudre();
    tx.onerror = () => resoudre();
  });
}

/* -------------------------------------------------------------------------- */
/* Catalogue en memoire                                                        */
/* -------------------------------------------------------------------------- */

let catalogue: Map<string, Article> | null = null;
let chargement: Promise<Map<string, Article>> | null = null;

export type Progression = (fait: number, total: number) => void;

/**
 * Charge le catalogue : copie locale + lots modifies depuis la derniere visite.
 * Hors ligne, la copie locale suffit.
 */
export function chargerCatalogue(progression?: Progression, forcer = false): Promise<Map<string, Article>> {
  if (catalogue && !forcer) return Promise.resolve(catalogue);
  if (chargement && !forcer) return chargement;
  chargement = (async () => {
    const locaux = await lotsLocaux();
    let meta: Meta | null = null;
    try {
      const s = await getDoc(refMeta());
      meta = s.exists() ? (s.data() as Meta) : { versions: {}, total: 0 };
    } catch {
      meta = null; // hors ligne : on garde la copie locale
    }
    if (meta) {
      const aCharger = Object.entries(meta.versions).filter(([id, v]) => locaux.get(id)?.v !== v);
      let fait = 0;
      progression?.(0, aCharger.length);
      // Par paquets de 8 lectures en parallele.
      for (let i = 0; i < aCharger.length; i += 8) {
        await Promise.all(
          aCharger.slice(i, i + 8).map(async ([id]) => {
            const s = await getDoc(refLot(id));
            const d = s.data() as { d?: string; v?: number } | undefined;
            const l: LotLocal = { id, v: d?.v ?? 0, contenu: lireLot(d?.d) };
            locaux.set(id, l);
            await memoriserLot(l);
            progression?.(++fait, aCharger.length);
          }),
        );
      }
      // Lots supprimes cote serveur : ignores.
      for (const id of [...locaux.keys()]) if (!(id in meta.versions)) locaux.delete(id);
    }
    const map = new Map<string, Article>();
    for (const l of locaux.values()) {
      for (const [code, ligne] of Object.entries(l.contenu)) map.set(code, versArticle(code, ligne));
    }
    catalogue = map;
    return map;
  })().finally(() => {
    chargement = null;
  });
  return chargement;
}

/** Met a jour la copie locale et la memoire apres une ecriture. */
async function appliquerLocal(id: string, v: number, contenu: ContenuLot) {
  await memoriserLot({ id, v, contenu });
  if (!catalogue) return;
  for (const [code, a] of [...catalogue]) if (lotDe(code) === id && !(code in contenu)) catalogue.delete(a.code);
  for (const [code, ligne] of Object.entries(contenu)) catalogue.set(code, versArticle(code, ligne));
}

/* -------------------------------------------------------------------------- */
/* Lecture                                                                     */
/* -------------------------------------------------------------------------- */

export async function trouverArticle(code: string): Promise<Article | null> {
  const c = normaliserCode(code);
  if (!c) return null;
  return (await chargerCatalogue()).get(c) ?? null;
}

export async function trouverArticles(codes: readonly string[]): Promise<Map<string, Article>> {
  const cat = await chargerCatalogue();
  const res = new Map<string, Article>();
  for (const code of codes) {
    const c = normaliserCode(code);
    const a = c ? cat.get(c) : undefined;
    if (a) res.set(c, a);
  }
  return res;
}

export async function compterArticles(): Promise<number> {
  return (await chargerCatalogue()).size;
}

export async function tousLesArticles(): Promise<Article[]> {
  return [...(await chargerCatalogue()).values()].sort((a, b) => a.code.localeCompare(b.code));
}

function sansAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
}

/**
 * Recherche locale : code (debut), ou mots contenus dans la designation FR / AR.
 * « lait 1l » trouve « LAIT DEMI ECREME 1L ».
 */
export async function rechercherArticles(recherche: string): Promise<Article[]> {
  const cat = await chargerCatalogue();
  const r = recherche.trim();
  const tous = [...cat.values()];
  if (!r) return tous.sort((a, b) => a.code.localeCompare(b.code));
  if (/^\d+$/.test(r)) return tous.filter((a) => a.code.startsWith(r)).sort((a, b) => a.code.localeCompare(b.code));
  const mots = sansAccents(r).split(/\s+/).filter(Boolean);
  return tous
    .filter((a) => {
      const t = `${sansAccents(a.designationFr)} ${a.designationAr} ${a.code}`;
      return mots.every((m) => t.includes(m));
    })
    .sort((a, b) => a.designationFr.localeCompare(b.designationFr));
}

/* -------------------------------------------------------------------------- */
/* Ecriture                                                                    */
/* -------------------------------------------------------------------------- */

/** Modifie un lot dans une transaction (lot + _meta) et met a jour la copie locale. */
async function modifierLot(id: string, modification: (contenu: ContenuLot) => void): Promise<void> {
  const resultat = await runTransaction(db, async (tx) => {
    const [sMeta, sLot] = await Promise.all([tx.get(refMeta()), tx.get(refLot(id))]);
    const meta = (sMeta.exists() ? sMeta.data() : { versions: {}, total: 0 }) as Meta;
    const lot = sLot.data() as { d?: string; v?: number; n?: number } | undefined;
    const contenu = lireLot(lot?.d);
    const avant = Object.keys(contenu).length;
    modification(contenu);
    const apres = Object.keys(contenu).length;
    const v = (lot?.v ?? 0) + 1;
    const d = JSON.stringify(contenu);
    if (d.length > 1_000_000) throw new Error('Lot du catalogue trop volumineux : contactez le developpeur.');
    tx.set(refLot(id), { d, v, n: apres, majLe: serverTimestamp() });
    tx.set(refMeta(), {
      versions: { ...meta.versions, [id]: v },
      total: Math.max(0, (meta.total ?? 0) + apres - avant),
      majLe: serverTimestamp(),
    });
    return { v, contenu };
  });
  await appliquerLocal(id, resultat.v, resultat.contenu);
}

export async function enregistrerArticle(a: ArticleSaisi, auteur: string): Promise<void> {
  const code = normaliserCode(a.code);
  if (!code) throw new Error('Le code article est obligatoire.');
  await modifierLot(lotDe(code), (c) => {
    c[code] = versLigne({ ...a, code }, auteur);
  });
}

export async function supprimerArticle(code: string): Promise<void> {
  await modifierLot(lotDe(code), (c) => {
    delete c[code];
  });
}

/**
 * Import en masse : les articles sont regroupes par lot (64 transactions au
 * plus, quel que soit le nombre d'articles). Les codes existants sont remplaces.
 */
export async function importerArticles(
  articles: readonly ArticleSaisi[],
  auteur: string,
  progression?: Progression,
): Promise<number> {
  const parLot = new Map<string, ArticleSaisi[]>();
  for (const a of articles) {
    const code = normaliserCode(a.code);
    if (!code) continue;
    const id = lotDe(code);
    const l = parLot.get(id) ?? [];
    l.push({ ...a, code });
    parLot.set(id, l);
  }
  let fait = 0;
  let lots = 0;
  for (const [id, liste] of parLot) {
    await modifierLot(id, (c) => {
      for (const a of liste) c[a.code] = versLigne(a, auteur);
    });
    fait += liste.length;
    lots++;
    progression?.(fait, articles.length);
  }
  void lots;
  return fait;
}

/* -------------------------------------------------------------------------- */
/* Choix du gabarit A7                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Ordre de priorite (identique a l'ancienne application) :
 *  1. gabarit impose sur la fiche article (ancienne colonne H) ;
 *  2. prefixe de code le plus long du mapping ;
 *  3. mot-cle de la designation ;
 *  4. PAT.
 */
export function gabaritA7Pour(
  code: string,
  article: Pick<Article, 'gabaritA7' | 'designationFr'> | null,
  mapping: readonly RegleMapping[],
): string {
  const impose = (article?.gabaritA7 ?? '').trim().toUpperCase();
  if (impose && GABARITS_A7.includes(impose)) return impose;
  const tri = [...mapping].sort((a, b) => b.prefixe.length - a.prefixe.length);
  for (const m of tri) if (m.prefixe && code.startsWith(m.prefixe)) return m.gabarit;
  const d = (article?.designationFr ?? '').toUpperCase();
  if (/FROMAGE|BRIE|CAMEMBERT|CHEVRE|ROULE|EMMENTAL|GOUDA|RACLETTE|FETA|EDAM/.test(d)) return 'FROM';
  if (/BAGUETTE|PAIN|CIABATTA|BOULANG/.test(d)) return 'BOUL';
  if (/CROISSANT|TARTE|ECLAIR|FLAN|PATISS|GATEAU|CAKE|MUFFIN|BRIOCHE/.test(d)) return 'PAT';
  if (/POULET|DINDE|VOLAILLE/.test(d)) return 'B_VOL';
  if (/AGNEAU|MOUTON/.test(d)) return 'B_AGN';
  if (/FILET/.test(d)) return 'B_FIL';
  if (/TRAITEUR|SALADE|QUICHE|LASAGNE/.test(d)) return 'TRAIT';
  return 'PAT';
}
