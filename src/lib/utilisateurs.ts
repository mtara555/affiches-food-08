/**
 * Gestion des utilisateurs (administrateurs)
 *
 * Le SDK web ne permet pas de creer un compte pour quelqu'un d'autre sans
 * fermer sa propre session. On utilise donc une seconde instance Firebase,
 * « secondaire », le temps de la creation : la session de l'administrateur
 * n'est pas touchee. Aucune fonction serveur (payante) n'est necessaire.
 */

import { deleteApp, initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import { collection, doc, getDocs, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { ecrire, modifier } from './ecriture';
import { configuration, db, COLLECTIONS } from './firebase';
import { messageErreurConnexion, versEmail } from './auth';
import type { Role } from '../config/constants';

export interface FicheUtilisateur {
  readonly id: string;
  readonly nom: string;
  readonly email: string;
  readonly role: Exclude<Role, 'aucun'>;
  readonly actif: boolean;
}

export async function listerUtilisateurs(): Promise<FicheUtilisateur[]> {
  const res = await getDocs(query(collection(db, COLLECTIONS.UTILISATEURS), orderBy('nom')));
  return res.docs.map((d) => {
    const v = d.data() as Partial<FicheUtilisateur>;
    return {
      id: d.id,
      nom: v.nom ?? '',
      email: v.email ?? '',
      role: v.role === 'administrateur' ? 'administrateur' : 'operateur',
      actif: v.actif !== false,
    };
  });
}

export async function creerUtilisateur(
  nom: string,
  identifiant: string,
  motDePasse: string,
  role: Exclude<Role, 'aucun'>,
): Promise<void> {
  const email = versEmail(identifiant);
  const secondaire = initializeApp(configuration, `creation-${Date.now()}`);
  try {
    const authSecondaire = getAuth(secondaire);
    let uid: string;
    try {
      const res = await createUserWithEmailAndPassword(authSecondaire, email, motDePasse);
      uid = res.user.uid;
    } catch (e) {
      throw new Error(messageErreurConnexion(e));
    }
    await signOut(authSecondaire);
    await ecrire(doc(db, COLLECTIONS.UTILISATEURS, uid), {
      nom: nom.trim(),
      email,
      role,
      actif: true,
      creeLe: serverTimestamp(),
    });
  } finally {
    await deleteApp(secondaire);
  }
}

export async function modifierUtilisateur(
  id: string,
  champs: Partial<Pick<FicheUtilisateur, 'nom' | 'role' | 'actif'>>,
): Promise<void> {
  await modifier(doc(db, COLLECTIONS.UTILISATEURS, id), champs);
}
