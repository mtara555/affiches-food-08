/**
 * Ecriture d'une liste d'ingredients avec les allergenes en gras rouge.
 *
 * Coupure des lignes entre les mots uniquement (la ponctuation reste
 * attachee a son mot : jamais de « ), » en debut de ligne). A l'interieur
 * d'un mot, seules les lettres de l'allergene sont colorees :
 * « (LAIT), » -> « ( » normal, « LAIT » rouge, « ), » normal.
 */

import { estAllergeneAr, marquerAllergenesFr } from './allergenes';

interface Segment {
  readonly t: string;
  readonly alg: boolean;
  readonly w: number;
}

interface Mot {
  readonly segments: Segment[];
  readonly w: number;
}

export interface StyleTexte {
  readonly taille: number;
  readonly famille: string;
  readonly poidsNormal: string;
  readonly couleur: string;
  readonly couleurAllergene: string;
  readonly interligne: number;
}

const police = (s: StyleTexte, gras: boolean) => `${gras ? 'bold' : s.poidsNormal} ${s.taille}px ${s.famille}`;

const RE_LETTRES = /[A-Za-zÀ-ÿŒœ]/;

function mesurerMotsFr(ctx: CanvasRenderingContext2D, texte: string, s: StyleTexte): Mot[] {
  // 1) Decoupage en mots puis en segments (lettres / ponctuation).
  const motsBruts: string[][] = texte
    .split(/\s+/)
    .filter(Boolean)
    .map((mot) => mot.split(/([^A-Za-zÀ-ÖØ-öø-ÿŒœ]+)/).filter(Boolean));

  // 2) Detection sur tous les segments « lettres » a la suite, pour gerer
  //    les termes composes (« CREME FRAICHE » -> les 2 mots en rouge).
  const lettres = motsBruts.flat().filter((t) => RE_LETTRES.test(t));
  const flags = marquerAllergenesFr(lettres);

  // 3) Mesure avec la police adaptee (gras si allergene).
  let n = 0;
  return motsBruts.map((segsBruts) => {
    const segments = segsBruts.map((t) => {
      const alg = RE_LETTRES.test(t) ? (flags[n++] ?? false) : false;
      // Allergenes en MAJUSCULES, le reste en minuscules.
      const texteAffiche = alg ? t.toUpperCase() : t.toLowerCase();
      ctx.font = police(s, alg);
      return { t: texteAffiche, alg, w: ctx.measureText(texteAffiche).width };
    });
    return { segments, w: segments.reduce((a, b) => a + b.w, 0) };
  });
}

function mesurerMotsAr(ctx: CanvasRenderingContext2D, texte: string, s: StyleTexte): Mot[] {
  return texte
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => {
      const alg = estAllergeneAr(t.replace(/[،,;.()]/g, ''));
      ctx.font = police(s, alg);
      const w = ctx.measureText(t).width;
      return { segments: [{ t, alg, w }], w };
    });
}

function couper(mots: Mot[], maxW: number, espace: number): Mot[][] {
  const lignes: Mot[][] = [];
  let courante: Mot[] = [];
  let largeur = 0;
  for (const m of mots) {
    const ajout = courante.length ? espace + m.w : m.w;
    if (courante.length && largeur + ajout > maxW) {
      lignes.push(courante);
      courante = [m];
      largeur = m.w;
    } else {
      courante.push(m);
      largeur += ajout;
    }
  }
  if (courante.length) lignes.push(courante);
  return lignes;
}

/** Nombre de lignes necessaires (pour ajuster la taille). */
export function compterLignes(ctx: CanvasRenderingContext2D, texte: string, maxW: number, s: StyleTexte, rtl: boolean): number {
  ctx.font = police(s, false);
  const espace = ctx.measureText(' ').width;
  return couper(rtl ? mesurerMotsAr(ctx, texte, s) : mesurerMotsFr(ctx, texte, s), maxW, espace).length;
}

/**
 * Ecrit le texte a partir de (x, y) — bord gauche en francais, bord droit
 * en arabe — sur au plus maxLignes lignes.
 */
export function ecrireIngredients(
  ctx: CanvasRenderingContext2D,
  texte: string,
  x: number,
  y: number,
  maxW: number,
  s: StyleTexte,
  rtl: boolean,
  maxLignes = Infinity,
): void {
  ctx.save();
  ctx.font = police(s, false);
  const espace = ctx.measureText(' ').width;
  const lignes = couper(rtl ? mesurerMotsAr(ctx, texte, s) : mesurerMotsFr(ctx, texte, s), maxW, espace).slice(0, maxLignes);
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  // En arabe, la ponctuation finale (، .) doit rester a gauche du mot.
  ctx.direction = rtl ? 'rtl' : 'ltr';
  lignes.forEach((ligne, i) => {
    const ly = y + i * s.taille * s.interligne;
    let cx = rtl ? x : x;
    for (const mot of ligne) {
      if (rtl) cx -= mot.w;
      let sx = cx;
      for (const seg of mot.segments) {
        ctx.font = police(s, seg.alg);
        ctx.fillStyle = seg.alg ? s.couleurAllergene : s.couleur;
        ctx.fillText(seg.t, sx, ly);
        sx += seg.w;
      }
      cx = rtl ? cx - espace : cx + mot.w + espace;
    }
  });
  ctx.restore();
}

/** Plus grande taille (<= depart, >= min) pour que le texte tienne dans maxH. */
export function tailleAjustee(
  ctx: CanvasRenderingContext2D,
  texte: string,
  maxW: number,
  maxH: number,
  s: Omit<StyleTexte, 'taille'>,
  depart: number,
  min: number,
  rtl: boolean,
): number {
  let fz = depart;
  while (fz > min) {
    const n = compterLignes(ctx, texte, maxW, { ...s, taille: fz }, rtl);
    if (n * fz * s.interligne <= maxH) return fz;
    fz -= 0.25;
  }
  return min;
}
