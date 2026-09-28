/**
 * Connexion Firebase (Authentification + Firestore)
 *
 * Les valeurs de configuration sont publiques par conception : elles figurent
 * dans le code de toute application web Firebase. La securite repose sur
 * l'authentification et sur les regles Firestore (firestore.rules).
 *
 * Plan gratuit « Spark » : Firebase Storage n'y est plus disponible pour les
 * nouveaux projets. Les images (fonds de gabarit, pictos) sont donc
 * compressees dans le navigateur puis rangees directement dans Firestore
 * (voir lib/images.ts), sous la limite de 1 Mo par document.
 *
 * Cache Firestore en memoire (et non persistant multi-onglets) : avec le cache
 * persistant, seul l'onglet « principal » parle au serveur ; si cet onglet est
 * en veille ou fige par le navigateur, les ecritures des autres onglets
 * restent en attente indefiniment. Le catalogue, lui, a sa propre copie
 * locale (lib/articles.ts) et reste disponible hors ligne.
 *
 * La detection automatique du « long polling » permet de fonctionner derriere
 * les proxys et pare-feu d'entreprise qui bloquent les connexions en continu.
 */

import { initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, memoryLocalCache, type Firestore } from 'firebase/firestore';

export const configuration: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
};

/** Indique si les variables d'environnement Firebase sont renseignees. */
export const estConfigure = Boolean(configuration.apiKey && configuration.projectId);

export const app: FirebaseApp = initializeApp(
  estConfigure ? configuration : { apiKey: 'non-configure', projectId: 'non-configure', appId: '0' },
);

export const auth = getAuth(app);

function creerFirestore(): Firestore {
  return initializeFirestore(app, {
    localCache: memoryLocalCache(),
    ignoreUndefinedProperties: true,
    experimentalAutoDetectLongPolling: true,
  });
}

export const db: Firestore = creerFirestore();

/** Noms des collections, regroupes pour eviter les chaines disseminees. */
export const COLLECTIONS = {
  UTILISATEURS: 'utilisateurs',
  CATALOGUE: 'catalogue',
  CAMPAGNES: 'campagnes',
  ELEMENTS: 'elements',
  GABARITS_A7: 'gabaritsA7',
  GABARITS_AFFICHE: 'gabaritsAffiche',
  GABARITS_BALISAGE: 'gabaritsBalisage',
  PICTOS: 'pictos',
  PARAMETRES: 'parametres',
  JOURNAL: 'journal',
} as const;

/** Traduit une erreur Firebase en message lisible. */
export function messageErreur(erreur: unknown): string {
  const code = (erreur as { code?: string } | null)?.code ?? '';
  switch (code) {
    case 'permission-denied':
      return "Action refusee : votre role ne le permet pas (ou les regles Firestore ne sont pas publiees).";
    case 'unavailable':
      return 'Serveur injoignable. Les modifications seront envoyees au retour du reseau.';
    case 'unauthenticated':
      return 'Session expiree. Reconnectez-vous.';
    case 'resource-exhausted':
      return 'Quota gratuit Firebase atteint pour aujourd’hui. Reessayez demain.';
    case 'invalid-argument':
      return 'Donnees invalides (document trop volumineux ?).';
    case 'not-found':
      return 'Element introuvable.';
    default:
      return erreur instanceof Error ? erreur.message : 'Une erreur est survenue.';
  }
}
