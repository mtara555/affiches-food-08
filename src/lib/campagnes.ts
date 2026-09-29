/**
 * Campagnes (lots d'impression) et leurs elements.
 *
 *   campagnes/{id}                 nom, type, format, statut, nbElements…
 *   campagnes/{id}/elements/{id}   une etiquette / affiche / bande de balisage
 *
 * Chaque element est une copie des donnees au moment de la saisie : modifier
 * le catalogue ensuite ne change pas une campagne deja imprimee.
 */

import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
  type DocumentSnapshot,
} from 'firebase/firestore';
import { db, COLLECTIONS } from './firebase';
import { ajouter, executerLot, modifier, supprimer, type Operation } from './ecriture';
import type { Campagne, Element, SaisieElement } from './types';
import type { FormatAffiche, TypeCampagne } from '../config/constants';

const colCampagnes = () => collection(db, COLLECTIONS.CAMPAGNES);
const colElements = (campagneId: string) => collection(db, COLLECTIONS.CAMPAGNES, campagneId, COLLECTIONS.ELEMENTS);

const date = (v: unknown) => (v instanceof Timestamp ? v.toDate() : null);

function versCampagne(s: DocumentSnapshot): Campagne {
  const d = (s.data() ?? {}) as Record<string, unknown>;
  return {
    id: s.id,
    nom: String(d.nom ?? ''),
    type: (d.type as TypeCampagne) ?? 'A7',
    format: (d.format as FormatAffiche) ?? 'A4',
    statut: (d.statut as Campagne['statut']) ?? 'brouillon',
    nbElements: Number(d.nbElements ?? 0),
    creeLe: date(d.creeLe),
    creePar: String(d.creePar ?? ''),
    creeParNom: String(d.creeParNom ?? ''),
    majLe: date(d.majLe),
  };
}

export async function listerCampagnes(options: { archivees?: boolean; max?: number } = {}): Promise<Campagne[]> {
  const res = await getDocs(query(colCampagnes(), orderBy('majLe', 'desc'), limit(options.max ?? 200)));
  return res.docs.map(versCampagne).filter((c) => options.archivees || c.statut !== 'archivee');
}

export async function obtenirCampagne(id: string): Promise<Campagne | null> {
  const s = await getDoc(doc(colCampagnes(), id));
  return s.exists() ? versCampagne(s) : null;
}

export async function creerCampagne(
  nom: string,
  type: TypeCampagne,
  format: FormatAffiche,
  auteur: { id: string; nom: string },
): Promise<string> {
  const ref = await ajouter(colCampagnes(), {
    nom: nom.trim(),
    type,
    format,
    statut: 'brouillon',
    nbElements: 0,
    creeLe: serverTimestamp(),
    majLe: serverTimestamp(),
    creePar: auteur.id,
    creeParNom: auteur.nom,
  });
  return ref.id;
}

export async function modifierCampagne(
  id: string,
  champs: Partial<Pick<Campagne, 'nom' | 'format' | 'statut'>>,
): Promise<void> {
  await modifier(doc(colCampagnes(), id), { ...champs, majLe: serverTimestamp() });
}

/** Supprime la campagne et tous ses elements. */
export async function supprimerCampagne(id: string): Promise<void> {
  const elements = await getDocs(colElements(id));
  for (let i = 0; i < elements.docs.length; i += 400) {
    await executerLot(elements.docs.slice(i, i + 400).map((d): Operation => ({ type: 'delete', ref: d.ref })));
  }
  await supprimer(doc(colCampagnes(), id));
}

/** Duplique une campagne (nouvelle semaine, memes articles). */
export async function dupliquerCampagne(source: Campagne, nouveauNom: string, auteur: { id: string; nom: string }): Promise<string> {
  const id = await creerCampagne(nouveauNom, source.type, source.format, auteur);
  const elements = await listerElements<Element>(source.id);
  await ajouterElements(id, elements.map(({ id: _i, ordre: _o, ...reste }) => { void _i; void _o; return reste; }), 0);
  return id;
}

/* -------------------------------------------------------------------------- */
/* Elements                                                                    */
/* -------------------------------------------------------------------------- */

export async function listerElements<T extends Element>(campagneId: string): Promise<T[]> {
  const res = await getDocs(query(colElements(campagneId), orderBy('ordre')));
  return res.docs.map((d) => ({ ...(d.data() as Omit<T, 'id'>), id: d.id }) as T);
}

/** Ajoute des elements a la suite (ordre croissant) et met a jour le compteur. */
export async function ajouterElements(
  campagneId: string,
  elements: readonly SaisieElement[],
  ordreDepart: number,
): Promise<void> {
  for (let i = 0; i < elements.length; i += 400) {
    const tranche = elements.slice(i, i + 400);
    const ops: Operation[] = tranche.map((e, j) => ({
      type: 'set',
      ref: doc(colElements(campagneId)),
      donnees: { ...e, ordre: ordreDepart + i + j, creeLe: serverTimestamp() },
    }));
    ops.push({ type: 'update', ref: doc(colCampagnes(), campagneId), donnees: { nbElements: increment(tranche.length), majLe: serverTimestamp() } });
    await executerLot(ops);
  }
}

export async function modifierElement(campagneId: string, elementId: string, champs: Partial<Omit<Element, 'id'>>): Promise<void> {
  await executerLot([
    { type: 'update', ref: doc(colElements(campagneId), elementId), donnees: champs },
    { type: 'update', ref: doc(colCampagnes(), campagneId), donnees: { majLe: serverTimestamp() } },
  ]);
}

export async function supprimerElement(campagneId: string, elementId: string): Promise<void> {
  await executerLot([
    { type: 'delete', ref: doc(colElements(campagneId), elementId) },
    { type: 'update', ref: doc(colCampagnes(), campagneId), donnees: { nbElements: increment(-1), majLe: serverTimestamp() } },
  ]);
}

/** Nouvel ordre apres deplacement (on reecrit seulement les ordres modifies). */
export async function reordonner(campagneId: string, idsDansLOrdre: readonly string[], anciens: ReadonlyMap<string, number>): Promise<void> {
  const ops: Operation[] = [];
  idsDansLOrdre.forEach((id, i) => {
    if (anciens.get(id) !== i) ops.push({ type: 'update', ref: doc(colElements(campagneId), id), donnees: { ordre: i } });
  });
  for (let i = 0; i < ops.length; i += 450) await executerLot(ops.slice(i, i + 450));
}

/* -------------------------------------------------------------------------- */
/* Statistiques (tableau de bord)                                              */
/* -------------------------------------------------------------------------- */

export async function compterCampagnes(type?: TypeCampagne): Promise<number> {
  const q = type ? query(colCampagnes(), where('type', '==', type)) : colCampagnes();
  const r = await getCountFromServer(q);
  return r.data().count;
}
