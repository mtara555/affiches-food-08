/**
 * Ecritures Firestore passant par des transactions.
 *
 * Sur certains reseaux (proxy d'entreprise, antivirus…), le canal d'ecriture
 * continu de Firestore (setDoc, addDoc, writeBatch…) n'est jamais acquitte :
 * l'ecriture reste « en attente » indefiniment. Les transactions utilisent une
 * requete simple (Commit) qui, elle, passe. Toutes les ecritures de
 * l'application passent donc par ici.
 */

import {
  doc,
  runTransaction,
  type CollectionReference,
  type DocumentData,
  type DocumentReference,
  type UpdateData,
} from 'firebase/firestore';
import { db } from './firebase';

export type Operation =
  | { readonly type: 'set'; readonly ref: DocumentReference; readonly donnees: DocumentData }
  | { readonly type: 'update'; readonly ref: DocumentReference; readonly donnees: DocumentData }
  | { readonly type: 'delete'; readonly ref: DocumentReference };

/** Applique jusqu'a 500 operations en une seule transaction (tout ou rien). */
export async function executerLot(ops: readonly Operation[]): Promise<void> {
  if (!ops.length) return;
  if (ops.length > 500) throw new Error('Trop d’operations dans un meme lot (500 au plus).');
  await runTransaction(db, async (tx) => {
    for (const o of ops) {
      if (o.type === 'set') tx.set(o.ref, o.donnees);
      else if (o.type === 'update') tx.update(o.ref, o.donnees as UpdateData<DocumentData>);
      else tx.delete(o.ref);
    }
  });
}

/** Equivalent de setDoc. */
export const ecrire = (ref: DocumentReference, donnees: DocumentData) => executerLot([{ type: 'set', ref, donnees }]);

/** Equivalent de updateDoc (le document doit exister). */
export const modifier = (ref: DocumentReference, donnees: DocumentData) => executerLot([{ type: 'update', ref, donnees }]);

/** Equivalent de deleteDoc. */
export const supprimer = (ref: DocumentReference) => executerLot([{ type: 'delete', ref }]);

/** Equivalent de addDoc : identifiant genere localement. */
export async function ajouter(col: CollectionReference, donnees: DocumentData): Promise<DocumentReference> {
  const ref = doc(col);
  await ecrire(ref, donnees);
  return ref;
}
