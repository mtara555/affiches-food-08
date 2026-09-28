/**
 * Service d'authentification
 *
 * Le role d'un utilisateur est porte par son document `utilisateurs/{uid}`.
 * Les memes documents servent aux regles Firestore : un utilisateur ne peut
 * donc pas s'attribuer un role en manipulant le code de la page.
 */

import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  type User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, COLLECTIONS } from './firebase';
import { DOMAINE_IDENTIFIANT, type Role } from '../config/constants';

export interface Utilisateur {
  readonly id: string;
  readonly nom: string;
  readonly email: string;
  readonly role: Role;
  readonly actif: boolean;
}

/** « karim » devient « karim@marjane08.local » ; une vraie adresse reste inchangee. */
export function versEmail(identifiant: string): string {
  const v = identifiant.trim().toLowerCase();
  return v.includes('@') ? v : `${v.replace(/\s+/g, '.')}@${DOMAINE_IDENTIFIANT}`;
}

/** Affichage : on masque le domaine technique des identifiants simples. */
export function afficherIdentifiant(email: string): string {
  return email.endsWith(`@${DOMAINE_IDENTIFIANT}`) ? email.split('@')[0] ?? email : email;
}

async function lireProfil(compte: User): Promise<Utilisateur> {
  const email = compte.email ?? '';
  try {
    const instantane = await getDoc(doc(db, COLLECTIONS.UTILISATEURS, compte.uid));
    if (!instantane.exists()) {
      return { id: compte.uid, nom: afficherIdentifiant(email), email, role: 'aucun', actif: false };
    }
    const d = instantane.data() as { nom?: string; role?: Role; actif?: boolean };
    const actif = d.actif !== false;
    return {
      id: compte.uid,
      nom: d.nom || afficherIdentifiant(email),
      email,
      role: actif && (d.role === 'administrateur' || d.role === 'operateur') ? d.role : 'aucun',
      actif,
    };
  } catch {
    return { id: compte.uid, nom: afficherIdentifiant(email), email, role: 'aucun', actif: false };
  }
}

/** S'abonne aux changements de session. Renvoie la fonction de desabonnement. */
export function surChangementSession(rappel: (u: Utilisateur | null) => void): () => void {
  return onAuthStateChanged(auth, (compte) => {
    if (!compte) {
      rappel(null);
      return;
    }
    void lireProfil(compte).then(rappel);
  });
}

export async function seConnecter(identifiant: string, motDePasse: string): Promise<Utilisateur> {
  try {
    const resultat = await signInWithEmailAndPassword(auth, versEmail(identifiant), motDePasse);
    return await lireProfil(resultat.user);
  } catch (erreur) {
    throw new Error(messageErreurConnexion(erreur));
  }
}

export async function seDeconnecter(): Promise<void> {
  await signOut(auth);
}

export async function changerMotDePasse(ancien: string, nouveau: string): Promise<void> {
  const compte = auth.currentUser;
  if (!compte?.email) throw new Error('Aucune session ouverte.');
  try {
    await reauthenticateWithCredential(compte, EmailAuthProvider.credential(compte.email, ancien));
    await updatePassword(compte, nouveau);
  } catch (erreur) {
    throw new Error(messageErreurConnexion(erreur));
  }
}

export async function envoyerReinitialisation(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

/** Messages volontairement identiques pour identifiant / mot de passe faux. */
export function messageErreurConnexion(erreur: unknown): string {
  const code = (erreur as { code?: string } | null)?.code ?? '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'Identifiant ou mot de passe incorrect.';
    case 'auth/user-disabled':
      return 'Ce compte est desactive. Contactez un administrateur.';
    case 'auth/too-many-requests':
      return 'Trop de tentatives. Patientez quelques minutes avant de reessayer.';
    case 'auth/network-request-failed':
      return 'Connexion au serveur impossible. Verifiez votre reseau.';
    case 'auth/weak-password':
      return 'Mot de passe trop court (6 caracteres minimum).';
    case 'auth/email-already-in-use':
      return 'Cet identifiant existe deja.';
    case 'auth/requires-recent-login':
      return 'Reconnectez-vous puis recommencez.';
    default:
      return erreur instanceof Error ? erreur.message : 'La connexion a echoue.';
  }
}
