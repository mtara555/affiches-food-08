/**
 * Picto : taille relative et suppression du fond blanc.
 *
 * Le fond est retire a l'AFFICHAGE : l'image d'origine reste intacte dans
 * Firestore, donc le reglage est reversible et ne coute aucune ecriture
 * d'image. Le resultat est mis en cache (une copie par image et par tolerance).
 *
 * Algorithme : remplissage depuis les bords de l'image. Seuls les pixels
 * blancs CONNECTES au bord deviennent transparents ; un blanc situe a
 * l'interieur du dessin (reflet, lettre, oeil…) est donc conserve.
 */

import type { Picto } from '../lib/types';
import { chargerImage } from './commun';

/** Coefficient de taille d'un picto (1 = taille definie par le gabarit d'affiche). */
export const PICTO_TAILLE = { min: 0.5, max: 2, defaut: 1, pas: 0.05 } as const;

/** Tolerance de detourage : ecart de blanc accepte (0 = blanc pur uniquement). */
export const PICTO_TOLERANCE = { min: 0, max: 60, defaut: 20, pas: 1 } as const;

/** Largeur (niveaux de gris) de la rampe de transparence : adoucit le contour. */
const RAMPE = 24;

const borne = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function tailleEffective(p: Pick<Picto, 'taille'> | undefined): number {
  const t = p?.taille;
  return typeof t === 'number' && Number.isFinite(t) ? borne(t, PICTO_TAILLE.min, PICTO_TAILLE.max) : PICTO_TAILLE.defaut;
}

export function toleranceEffective(p: Pick<Picto, 'tolerance'> | undefined): number {
  const t = p?.tolerance;
  return typeof t === 'number' && Number.isFinite(t) ? borne(Math.round(t), PICTO_TOLERANCE.min, PICTO_TOLERANCE.max) : PICTO_TOLERANCE.defaut;
}

/**
 * Rend transparents les pixels blancs connectes aux bords (modifie `data`, RGBA).
 * Fonction pure, sans canvas : testable seule.
 */
export function detourerPixels(data: Uint8ClampedArray, w: number, h: number, tolerance: number): void {
  const plein = 255 - tolerance; // blancheur >= plein : totalement transparent
  const bas = Math.max(0, plein - RAMPE); // blancheur < bas : le pixel reste intact
  const visite = new Uint8Array(w * h);
  const pile = new Int32Array(w * h);
  let sommet = 0;

  /** Blancheur d'un pixel (plus petit canal) ; un pixel deja transparent compte comme blanc. */
  const blancheur = (p: number) => {
    const i = p * 4;
    return data[i + 3]! < 16 ? 255 : Math.min(data[i]!, data[i + 1]!, data[i + 2]!);
  };
  const germer = (p: number) => {
    if (!visite[p] && blancheur(p) >= bas) {
      visite[p] = 1;
      pile[sommet++] = p;
    }
  };

  for (let x = 0; x < w; x++) {
    germer(x);
    germer((h - 1) * w + x);
  }
  for (let y = 1; y < h - 1; y++) {
    germer(y * w);
    germer(y * w + w - 1);
  }

  while (sommet > 0) {
    const p = pile[--sommet]!;
    const b = blancheur(p);
    const i = p * 4 + 3;
    // Rampe : opaque a `bas`, transparent a `plein` (contour adouci).
    const alpha = b >= plein ? 0 : Math.round((255 * (plein - b)) / Math.max(1, plein - bas));
    data[i] = Math.min(data[i]!, alpha);
    const x = p % w;
    if (x > 0) germer(p - 1);
    if (x < w - 1) germer(p + 1);
    if (p >= w) germer(p - w);
    if (p < w * (h - 1)) germer(p + w);
  }
}

function detourer(img: HTMLImageElement, tolerance: number): HTMLCanvasElement {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canevas indisponible.');
  ctx.drawImage(img, 0, 0);
  const pixels = ctx.getImageData(0, 0, w, h);
  detourerPixels(pixels.data, w, h, tolerance);
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

/* Cache : image (data URL) -> tolerance -> canvas detoure. Borne pour limiter la memoire. */
const cache = new Map<string, Map<number, HTMLCanvasElement>>();
const MAX_IMAGES = 24;
const MAX_TOLERANCES = 8; // le curseur de l'editeur cree une entree par valeur essayee

/**
 * Source prete a dessiner pour un picto : image d'origine, ou version sans fond.
 * Retourne null si le picto est absent ou illisible (le rendu continue sans picto).
 */
export async function sourcePicto(p: Picto | undefined): Promise<CanvasImageSource | null> {
  if (!p?.image) return null;
  const img = await chargerImage(p.image);
  if (!img) return null;
  if (!p.sansFond) return img;
  const tol = toleranceEffective(p);
  let parTolerance = cache.get(p.image);
  if (!parTolerance) {
    if (cache.size >= MAX_IMAGES) cache.delete(cache.keys().next().value as string);
    parTolerance = new Map();
    cache.set(p.image, parTolerance);
  }
  let resultat = parTolerance.get(tol);
  if (!resultat) {
    try {
      resultat = detourer(img, tol);
    } catch {
      return img; // detourage impossible : on garde l'image d'origine
    }
    if (parTolerance.size >= MAX_TOLERANCES) parTolerance.delete(parTolerance.keys().next().value as number);
    parTolerance.set(tol, resultat);
  }
  return resultat;
}

/** Dimensions naturelles d'une source (image ou canvas). */
export function dimensionsSource(s: CanvasImageSource): { l: number; h: number } {
  if (s instanceof HTMLImageElement) return { l: s.naturalWidth, h: s.naturalHeight };
  if (s instanceof HTMLCanvasElement) return { l: s.width, h: s.height };
  return { l: 1, h: 1 };
}
