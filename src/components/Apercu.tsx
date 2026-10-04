/**
 * Apercu en direct d'un element (etiquette, affiche, balisage).
 * Le canevas est dessine a 2× (ou 3× sur ecran haute densite) puis affiche a
 * la largeur voulue. Les dessins concurrents sont ignores (seul le dernier compte).
 */

import { useEffect, useMemo, useRef } from 'react';
import type { ParametresVrac, TypeCampagne } from '../config/constants';
import type { Element, GabaritA7, GabaritAffiche, GabaritBalisage, Parametres, SaisieElement } from '../lib/types';
import { useDonnees } from '../context/DonneesContext';
import { dessinerElement, dimensionsRendu, type Reference } from '../rendu';
import './Apercu.css';

interface Props {
  readonly type: TypeCampagne;
  readonly element: SaisieElement | Element;
  /** Largeur d'affichage en px CSS. */
  readonly largeur: number;
  readonly className?: string;
  readonly titre?: string;
  /** Dimensions et mode ingredients (type VRAC uniquement). */
  readonly vrac?: ParametresVrac;
  /** Gabarit ou parametres en cours d'edition (non encore enregistres). */
  readonly surcharge?: {
    readonly a7?: GabaritA7;
    readonly affiche?: GabaritAffiche;
    readonly balisage?: GabaritBalisage;
    readonly parametres?: Parametres;
  };
}

function avec<T extends { id: string }>(map: ReadonlyMap<string, T>, g: T | undefined): ReadonlyMap<string, T> {
  if (!g) return map;
  const m = new Map(map);
  m.set(g.id, g);
  return m;
}

export function Apercu({ type, element, largeur, className, titre, surcharge, vrac }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const jeton = useRef(0);
  const base = useDonnees();
  const donnees = useMemo<Reference>(
    () =>
      surcharge
        ? {
            parametres: surcharge.parametres ?? base.parametres,
            mapA7: avec(base.mapA7, surcharge.a7),
            mapAffiche: avec(base.mapAffiche, surcharge.affiche),
            mapBalisage: avec(base.mapBalisage, surcharge.balisage),
            mapPictos: base.mapPictos,
          }
        : base,
    [base, surcharge],
  );

  const vracL = vrac?.largeurMm;
  const vracH = vrac?.hauteurMm;
  const vracIng = vrac?.avecIngredients;
  const vracStable = useMemo<ParametresVrac | undefined>(
    () => (vracL && vracH ? { largeurMm: vracL, hauteurMm: vracH, avecIngredients: vracIng !== false } : undefined),
    [vracL, vracH, vracIng],
  );

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const n = ++jeton.current;
    const dim = dimensionsRendu(type, vracStable);
    const densite = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
    const k = (largeur / dim.l) * densite;
    const hors = document.createElement('canvas');
    void dessinerElement(type, element, donnees, hors, k, { vrac: vracStable }).then(() => {
      if (n !== jeton.current) return;
      canvas.width = hors.width;
      canvas.height = hors.height;
      canvas.getContext('2d')?.drawImage(hors, 0, 0);
    });
  }, [type, element, largeur, donnees, vracStable]);

  const dim = dimensionsRendu(type, vracStable);
  return (
    <canvas
      ref={ref}
      className={`apercu ${className ?? ''}`}
      style={{ width: largeur, aspectRatio: `${dim.l} / ${dim.h}` }}
      role="img"
      aria-label={titre ?? 'Apercu'}
    />
  );
}
