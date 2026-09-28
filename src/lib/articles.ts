/**
 * Catalogue articles (collection `articles`, identifiant = code article)
 *
 * Quotas du plan gratuit (50 000 lectures / jour) : on ne charge jamais tout
 * le catalogue. Recherche par code (1 lecture), pages de 50, et recherche par
 * debut de designation (index Firestore simple sur `designationFrMaj`).
 */

import {
  collection,
  deleteDoc,
  doc,
  documentId,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  Timestamp,
  where,
  writeBatch,
  type DocumentSnapshot,
  type QueryConstraint,
} from 'firebase/firestore';
import { db, COLLECTIONS } from './firebase';
import type { Article, ArticleSaisi, RegleMapping } from './types';
import { GABARITS_A7 } from '../config/constants';

const col = () => collection(db, COLLECTIONS.ARTICLES);

function versArticle(s: DocumentSnapshot): Article {
  const d = (s.data() ?? {}) as Record<string, unknown>;
  const texte = (k: string) => String(d[k] ?? '');
  return {
    code: s.id,
    designationFr: texte('designationFr'),
    designationAr: texte('designationAr'),
    ingredientsFr: texte('ingredientsFr'),
    ingredientsAr: texte('ingredientsAr'),
    origine: texte('origine'),
    colJ: texte('colJ'),
    gabaritA7: texte('gabaritA7'),
    majLe: d.majLe instanceof Timestamp ? d.majLe.toDate() : null,
    majPar: texte('majPar'),
  };
}

/** Normalise un code saisi ou scanne. */
export function normaliserCode(code: string): string {
  return code.trim().replace(/\s+/g, '').replace(/\//g, '-');
}

export async function trouverArticle(code: string): Promise<Article | null> {
  const c = normaliserCode(code);
  if (!c) return null;
  const s = await getDoc(doc(col(), c));
  return s.exists() ? versArticle(s) : null;
}

/** Lecture groupee (imports Excel) : 30 codes par requete. */
export async function trouverArticles(codes: readonly string[]): Promise<Map<string, Article>> {
  const uniques = [...new Set(codes.map(normaliserCode).filter(Boolean))];
  const resultat = new Map<string, Article>();
  for (let i = 0; i < uniques.length; i += 30) {
    const lot = uniques.slice(i, i + 30);
    const res = await getDocs(query(col(), where(documentId(), 'in', lot)));
    res.docs.forEach((d) => resultat.set(d.id, versArticle(d)));
  }
  return resultat;
}

function donnees(a: ArticleSaisi, auteur: string) {
  return {
    designationFr: a.designationFr.trim(),
    designationFrMaj: a.designationFr.trim().toUpperCase(),
    designationAr: a.designationAr.trim(),
    ingredientsFr: a.ingredientsFr.trim(),
    ingredientsAr: a.ingredientsAr.trim(),
    origine: a.origine.trim(),
    colJ: a.colJ.trim(),
    gabaritA7: a.gabaritA7.trim().toUpperCase(),
    majLe: serverTimestamp(),
    majPar: auteur,
  };
}

export async function enregistrerArticle(a: ArticleSaisi, auteur: string): Promise<void> {
  const code = normaliserCode(a.code);
  if (!code) throw new Error('Le code article est obligatoire.');
  await setDoc(doc(col(), code), donnees(a, auteur));
}

export async function supprimerArticle(code: string): Promise<void> {
  await deleteDoc(doc(col(), code));
}

/** Ecriture par lots de 400 (limite Firestore : 500 operations). */
export async function importerArticles(
  articles: readonly ArticleSaisi[],
  auteur: string,
  progression?: (fait: number, total: number) => void,
): Promise<number> {
  let fait = 0;
  for (let i = 0; i < articles.length; i += 400) {
    const lot = writeBatch(db);
    for (const a of articles.slice(i, i + 400)) {
      const code = normaliserCode(a.code);
      if (code) lot.set(doc(col(), code), donnees(a, auteur));
    }
    await lot.commit();
    fait = Math.min(articles.length, i + 400);
    progression?.(fait, articles.length);
  }
  return fait;
}

export async function compterArticles(): Promise<number> {
  const r = await getCountFromServer(col());
  return r.data().count;
}

export interface PageArticles {
  readonly articles: Article[];
  readonly suivant: DocumentSnapshot | null;
}

/**
 * Page de 50 articles.
 * - recherche vide : ordre des codes ;
 * - recherche numerique : codes commencant par la saisie ;
 * - sinon : designations FR commencant par la saisie (majuscules).
 */
export async function pageArticles(recherche: string, apres: DocumentSnapshot | null, taille = 50): Promise<PageArticles> {
  const r = recherche.trim();
  const contraintes: QueryConstraint[] = [];
  if (!r) {
    contraintes.push(orderBy(documentId()));
  } else if (/^\d/.test(r)) {
    contraintes.push(where(documentId(), '>=', r), where(documentId(), '<', `${r}`), orderBy(documentId()));
  } else {
    const m = r.toUpperCase();
    contraintes.push(where('designationFrMaj', '>=', m), where('designationFrMaj', '<', `${m}`), orderBy('designationFrMaj'));
  }
  if (apres) contraintes.push(startAfter(apres));
  contraintes.push(limit(taille));
  const res = await getDocs(query(col(), ...contraintes));
  return {
    articles: res.docs.map(versArticle),
    suivant: res.docs.length === taille ? (res.docs[res.docs.length - 1] ?? null) : null,
  };
}

/** Tous les articles (export Excel, administrateur) — lecture par pages de 1 000. */
export async function tousLesArticles(progression?: (n: number) => void): Promise<Article[]> {
  const tous: Article[] = [];
  let apres: DocumentSnapshot | null = null;
  for (;;) {
    const c: QueryConstraint[] = [orderBy(documentId()), limit(1000)];
    if (apres) c.push(startAfter(apres));
    const res = await getDocs(query(col(), ...c));
    tous.push(...res.docs.map(versArticle));
    progression?.(tous.length);
    if (res.docs.length < 1000) break;
    apres = res.docs[res.docs.length - 1] ?? null;
  }
  return tous;
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
export function gabaritA7Pour(code: string, article: Pick<Article, 'gabaritA7' | 'designationFr'> | null, mapping: readonly RegleMapping[]): string {
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
