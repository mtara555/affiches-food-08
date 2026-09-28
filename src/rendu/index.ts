/**
 * Point d'entree unique des moteurs : dessine n'importe quel element d'une
 * campagne selon son type, avec les donnees de reference de la session.
 */

import type { TypeCampagne } from '../config/constants';
import type {
  Element,
  ElementA7,
  ElementAfficheSaisi,
  ElementBalisage,
  GabaritA7,
  GabaritAffiche,
  GabaritBalisage,
  Parametres,
  Picto,
  Saisie,
} from '../lib/types';
import { A7_H, A7_L, dessinerA7, preparerA7 } from './a7';
import { AF_H, AF_L, dessinerAffiche, gabaritsAfficheParDefaut, preparerAffiche } from './affiche';
import { BA_H, BA_L, dessinerBalisage, preparerBalisage } from './balisage';
import { chargerPolices } from './commun';

export interface Reference {
  readonly parametres: Parametres;
  readonly mapA7: ReadonlyMap<string, GabaritA7>;
  readonly mapAffiche: ReadonlyMap<string, GabaritAffiche>;
  readonly mapBalisage: ReadonlyMap<string, GabaritBalisage>;
  readonly mapPictos: ReadonlyMap<string, Picto>;
}

/** Dimensions de reference (repere des gabarits) par type. */
export const DIMENSIONS: Readonly<Record<TypeCampagne, { l: number; h: number }>> = {
  A7: { l: A7_L, h: A7_H },
  AFFICHE: { l: AF_L, h: AF_H },
  BALISAGE: { l: BA_L, h: BA_H },
};

/** Facteur d'agrandissement pour l'impression (~300 dpi). */
export function facteurImpression(type: TypeCampagne, formatAffiche: 'A3' | 'A4' | 'A5' = 'A4'): number {
  if (type === 'A7') return 4; // 888 × 1260 px pour 74 × 105 mm
  if (type === 'BALISAGE') return 5; // 2250 × 600 px pour 150 × 40 mm
  return formatAffiche === 'A3' ? 7 : formatAffiche === 'A5' ? 4 : 5.5;
}

type SaisieQuelconque = Saisie<ElementA7> | Saisie<ElementAfficheSaisi> | Saisie<ElementBalisage> | Element;

export async function dessinerElement(
  type: TypeCampagne,
  element: SaisieQuelconque,
  ref: Reference,
  canvas: HTMLCanvasElement,
  k: number,
  options: { signature?: boolean } = {},
): Promise<void> {
  await chargerPolices();
  if (type === 'A7') {
    const e = element as Saisie<ElementA7>;
    const sig = options.signature && ref.parametres.signatureActive ? ref.parametres.signatureTexte : undefined;
    const rc = await preparerA7(e, ref.mapA7, ref.parametres.couleursA7, sig);
    dessinerA7(canvas, e, rc, k);
  } else if (type === 'AFFICHE') {
    const e = element as Saisie<ElementAfficheSaisi>;
    const gabarit = ref.mapAffiche.get(e.gabarit) ?? [...ref.mapAffiche.values()][0] ?? gabaritsAfficheParDefaut()[0]!;
    const rc = await preparerAffiche(e, gabarit, ref.mapPictos, ref.parametres);
    dessinerAffiche(canvas, e, rc, k);
  } else {
    const e = element as Saisie<ElementBalisage>;
    const rc = await preparerBalisage(e, ref.mapBalisage, ref.parametres.couleursBalisage);
    dessinerBalisage(canvas, e, rc, k);
  }
}
