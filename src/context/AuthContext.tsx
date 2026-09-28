/**
 * Contexte d'authentification
 *
 * Expose l'utilisateur connecte a toute l'application. Au premier rendu
 * l'etat est « en cours de verification » : on evite ainsi de faire clignoter
 * l'ecran de connexion pour une session valide pas encore lue.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { seConnecter, seDeconnecter, surChangementSession, type Utilisateur } from '../lib/auth';
import { estConfigure } from '../lib/firebase';
import { definirAuteur, journaliser } from '../lib/journal';

const CLE_OUVERTURE = 'affiches-food.ouverture-journalisee';

interface ContexteAuth {
  readonly utilisateur: Utilisateur | null;
  readonly enCoursDeVerification: boolean;
  readonly estAdmin: boolean;
  readonly connexion: (identifiant: string, motDePasse: string) => Promise<void>;
  readonly deconnexion: () => Promise<void>;
}

const Contexte = createContext<ContexteAuth | null>(null);

export function FournisseurAuth({ children }: { children: ReactNode }) {
  const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(null);
  const [enCoursDeVerification, setEnCoursDeVerification] = useState(estConfigure);

  useEffect(() => {
    if (!estConfigure) return;
    return surChangementSession((u) => {
      setUtilisateur(u);
      definirAuteur(u ? { id: u.id, nom: u.nom } : null);
      if (u) {
        try {
          if (!sessionStorage.getItem(CLE_OUVERTURE)) {
            sessionStorage.setItem(CLE_OUVERTURE, '1');
            void journaliser('connexion', 'session', "Ouverture de l'application");
          }
        } catch {
          /* sans importance */
        }
      }
      setEnCoursDeVerification(false);
    });
  }, []);

  const connexion = useCallback(async (identifiant: string, motDePasse: string) => {
    const u = await seConnecter(identifiant, motDePasse);
    definirAuteur({ id: u.id, nom: u.nom });
    try {
      sessionStorage.setItem(CLE_OUVERTURE, '1');
    } catch {
      /* sans importance */
    }
    void journaliser('connexion', 'session', `Connexion (${u.nom}, role ${u.role})`);
    setUtilisateur(u);
  }, []);

  const deconnexion = useCallback(async () => {
    await journaliser('connexion', 'session', 'Deconnexion');
    await seDeconnecter();
    definirAuteur(null);
    try {
      sessionStorage.removeItem(CLE_OUVERTURE);
    } catch {
      /* sans importance */
    }
    setUtilisateur(null);
  }, []);

  const valeur = useMemo(
    () => ({
      utilisateur,
      enCoursDeVerification,
      estAdmin: utilisateur?.role === 'administrateur',
      connexion,
      deconnexion,
    }),
    [utilisateur, enCoursDeVerification, connexion, deconnexion],
  );

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useAuth(): ContexteAuth {
  const c = useContext(Contexte);
  if (!c) throw new Error("useAuth doit etre utilise a l'interieur de <FournisseurAuth>.");
  return c;
}
