// Faux Firebase Auth (banc d'essai uniquement).
import { doc, setDoc, Timestamp } from './firestore';
export interface User { uid: string; email: string | null }
const comptes = new Map<string, { uid: string; mdp: string }>();
let courant: User | null = null;
const ecouteurs = new Set<(u: User | null) => void>();
const emettre = () => ecouteurs.forEach((e) => e(courant));

// Administrateur de test : admin / admin123
comptes.set('admin@marjane08.local', { uid: 'uid-admin', mdp: 'admin123' });
void setDoc(doc(null, 'utilisateurs', 'uid-admin'), { nom: 'Mohamed (test)', email: 'admin@marjane08.local', role: 'administrateur', actif: true, creeLe: Timestamp.now() });

export const getAuth = (app?: { name?: string }) => ({ principal: !app || app.name === '[DEFAULT]' });
export function onAuthStateChanged(_a: unknown, cb: (u: User | null) => void) {
  ecouteurs.add(cb);
  setTimeout(() => cb(courant), 10);
  return () => ecouteurs.delete(cb);
}
export async function signInWithEmailAndPassword(_a: unknown, email: string, mdp: string) {
  const c = comptes.get(email);
  if (!c || c.mdp !== mdp) throw Object.assign(new Error('x'), { code: 'auth/invalid-credential' });
  courant = { uid: c.uid, email };
  emettre();
  return { user: courant };
}
export async function createUserWithEmailAndPassword(_a: unknown, email: string, mdp: string) {
  if (comptes.has(email)) throw Object.assign(new Error('x'), { code: 'auth/email-already-in-use' });
  const uid = 'uid-' + Math.random().toString(36).slice(2);
  comptes.set(email, { uid, mdp });
  return { user: { uid, email } };
}
export async function signOut(a: { principal?: boolean }) { if (a.principal) { courant = null; emettre(); } }
export async function sendPasswordResetEmail() {}
export async function updatePassword() {}
export async function reauthenticateWithCredential() {}
export const EmailAuthProvider = { credential: (e: string, p: string) => ({ e, p }) };
