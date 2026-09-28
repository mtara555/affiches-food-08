/**
 * Donnees de reference chargees une fois par session et partagees par tous
 * les ecrans : parametres, gabarits (A7, affiche, balisage) et pictos.
 * `recharger()` apres une modification par un administrateur.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { chargerParametres, PARAMETRES_DEFAUT } from '../lib/parametres';
import {
  gabaritsA7ParDefaut,
  listerGabaritsA7,
  listerGabaritsAffiche,
  listerGabaritsBalisage,
  listerPictos,
} from '../lib/gabarits';
import type { GabaritA7, GabaritAffiche, GabaritBalisage, Parametres, Picto } from '../lib/types';
import { gabaritsAfficheParDefaut } from '../rendu/affiche';
import { gabaritsBalisageParDefaut } from '../rendu/balisage';
import { chargerPolices } from '../rendu/commun';

interface ContexteDonnees {
  readonly pret: boolean;
  readonly erreur: string | null;
  readonly parametres: Parametres;
  readonly gabaritsA7: GabaritA7[];
  readonly gabaritsAffiche: GabaritAffiche[];
  readonly gabaritsBalisage: GabaritBalisage[];
  readonly pictos: Picto[];
  readonly mapA7: ReadonlyMap<string, GabaritA7>;
  readonly mapAffiche: ReadonlyMap<string, GabaritAffiche>;
  readonly mapBalisage: ReadonlyMap<string, GabaritBalisage>;
  readonly mapPictos: ReadonlyMap<string, Picto>;
  readonly recharger: () => Promise<void>;
}

const Contexte = createContext<ContexteDonnees | null>(null);

export function FournisseurDonnees({ children }: { children: ReactNode }) {
  const { utilisateur } = useAuth();
  const [pret, setPret] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [parametres, setParametres] = useState<Parametres>(PARAMETRES_DEFAUT);
  const [gabaritsA7, setA7] = useState<GabaritA7[]>(gabaritsA7ParDefaut);
  const [gabaritsAffiche, setAffiche] = useState<GabaritAffiche[]>(gabaritsAfficheParDefaut);
  const [gabaritsBalisage, setBalisage] = useState<GabaritBalisage[]>(gabaritsBalisageParDefaut);
  const [pictos, setPictos] = useState<Picto[]>([]);

  const recharger = useCallback(async () => {
    setErreur(null);
    try {
      const [p, a7, af, ba, pi] = await Promise.all([
        chargerParametres(),
        listerGabaritsA7(),
        listerGabaritsAffiche(),
        listerGabaritsBalisage(),
        listerPictos(),
        chargerPolices(),
      ]);
      setParametres(p);
      setA7(a7);
      setAffiche(af);
      setBalisage(ba);
      setPictos(pi);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Chargement des gabarits impossible.');
    } finally {
      setPret(true);
    }
  }, []);

  const actif = utilisateur && utilisateur.role !== 'aucun';
  useEffect(() => {
    if (actif) void recharger();
  }, [actif, recharger]);

  const valeur = useMemo<ContexteDonnees>(
    () => ({
      pret,
      erreur,
      parametres,
      gabaritsA7,
      gabaritsAffiche,
      gabaritsBalisage,
      pictos,
      mapA7: new Map(gabaritsA7.map((g) => [g.id, g])),
      mapAffiche: new Map(gabaritsAffiche.map((g) => [g.id, g])),
      mapBalisage: new Map(gabaritsBalisage.map((g) => [g.id, g])),
      mapPictos: new Map(pictos.map((p) => [p.id, p])),
      recharger,
    }),
    [pret, erreur, parametres, gabaritsA7, gabaritsAffiche, gabaritsBalisage, pictos, recharger],
  );

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useDonnees(): ContexteDonnees {
  const c = useContext(Contexte);
  if (!c) throw new Error('useDonnees doit etre utilise dans <FournisseurDonnees>.');
  return c;
}
