/**
 * Outils communs aux moteurs de rendu (A7, affiches, balisage)
 *
 * Tous les moteurs dessinent dans un repere « de reference » (celui de
 * l'ancienne application : 222 × 315 pour l'A7, 420 × 594 pour l'affiche,
 * 450 × 120 pour le balisage). Le canevas reel est k fois plus grand et le
 * contexte est mis a l'echelle : les positions et tailles de police des
 * gabarits existants restent valables, mais l'impression est nette
 * (≈ 300 dpi au lieu de 76 dpi).
 */

import medium from '../assets/fonts/BFMarjane-Medium.woff2';
import black from '../assets/fonts/BFMarjane-Black.woff2';

export const POLICE = "'BFMarjane', 'Barlow Condensed', 'Arial Narrow', sans-serif";
export const POLICE_AR = "'BFMarjane', 'IBM Plex Sans Arabic', 'Segoe UI', sans-serif";

/* -------------------------------------------------------------------------- */
/* Polices                                                                     */
/* -------------------------------------------------------------------------- */

let policesPretes: Promise<void> | null = null;

/** Charge BF Marjane (500 et 900) avant tout dessin. Idempotent. */
export function chargerPolices(): Promise<void> {
  if (policesPretes) return policesPretes;
  policesPretes = (async () => {
    try {
      const faces = [
        new FontFace('BFMarjane', `url(${medium})`, { weight: '500' }),
        new FontFace('BFMarjane', `url(${black})`, { weight: '900' }),
        new FontFace('BFMarjane', `url(${black})`, { weight: '700' }),
      ];
      const chargees = await Promise.all(faces.map((f) => f.load()));
      chargees.forEach((f) => document.fonts.add(f));
    } catch (e) {
      console.warn('[polices] BF Marjane indisponible, police de secours utilisee', e);
    }
  })();
  return policesPretes;
}

/* -------------------------------------------------------------------------- */
/* Canevas                                                                     */
/* -------------------------------------------------------------------------- */

/** Polyfill roundRect (Safari < 16, anciens WebViews Android). */
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function roundRect(
    this: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r?: number | DOMPointInit | Iterable<number | DOMPointInit>,
  ) {
    const rr = typeof r === 'number' ? r : 0;
    this.moveTo(x + rr, y);
    this.lineTo(x + w - rr, y);
    this.arcTo(x + w, y, x + w, y + rr, rr);
    this.lineTo(x + w, y + h - rr);
    this.arcTo(x + w, y + h, x + w - rr, y + h, rr);
    this.lineTo(x + rr, y + h);
    this.arcTo(x, y + h, x, y + h - rr, rr);
    this.lineTo(x, y + rr);
    this.arcTo(x, y, x + rr, y, rr);
  } as CanvasRenderingContext2D['roundRect'];
}

/**
 * Prepare un canevas : taille reelle = reference × k, repere de reference.
 * Renvoie le contexte deja mis a l'echelle.
 */
export function preparerCanevas(
  canvas: HTMLCanvasElement,
  largeurRef: number,
  hauteurRef: number,
  k: number,
): CanvasRenderingContext2D {
  const w = Math.round(largeurRef * k);
  const h = Math.round(hauteurRef * k);
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canevas indisponible sur ce navigateur.');
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.clearRect(0, 0, largeurRef, hauteurRef);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.direction = 'ltr';
  ctx.imageSmoothingQuality = 'high';
  return ctx;
}

/* -------------------------------------------------------------------------- */
/* Images                                                                      */
/* -------------------------------------------------------------------------- */

const cacheImages = new Map<string, Promise<HTMLImageElement | null>>();

/** Charge une image (data URL ou https) une seule fois ; null si echec. */
export function chargerImage(source: string | null | undefined): Promise<HTMLImageElement | null> {
  if (!source) return Promise.resolve(null);
  const existant = cacheImages.get(source);
  if (existant) return existant;
  const promesse = new Promise<HTMLImageElement | null>((resoudre) => {
    const img = new Image();
    if (!source.startsWith('data:')) img.crossOrigin = 'anonymous';
    const minuterie = window.setTimeout(() => resoudre(null), 8000);
    img.onload = () => {
      window.clearTimeout(minuterie);
      resoudre(img);
    };
    img.onerror = () => {
      window.clearTimeout(minuterie);
      cacheImages.delete(source);
      resoudre(null);
    };
    img.src = source;
  });
  cacheImages.set(source, promesse);
  return promesse;
}

/* -------------------------------------------------------------------------- */
/* Prix                                                                        */
/* -------------------------------------------------------------------------- */

export function versNombre(v: unknown): number {
  const n = parseFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

/** « 12.5 » -> « 12,50 » ; '' si invalide. */
export function formaterPrix(v: unknown): string {
  const n = versNombre(v);
  return Number.isNaN(n) ? '' : n.toFixed(2).replace('.', ',');
}

/** Separe un montant en partie entiere et decimales : 12.5 -> ['12', '50']. */
export function decouperMontant(n: number): [string, string] {
  const arrondi = Math.round(n * 100) / 100;
  const entier = Math.floor(arrondi);
  const dec = Math.round((arrondi - entier) * 100);
  return [String(entier), String(dec).padStart(2, '0')];
}

/* -------------------------------------------------------------------------- */
/* Texte                                                                       */
/* -------------------------------------------------------------------------- */

/** Coupe un texte en lignes (au plus maxLignes) sans depasser maxW. */
export function couperLignes(
  ctx: CanvasRenderingContext2D,
  texte: string,
  maxW: number,
  maxLignes = Infinity,
): string[] {
  const mots = texte.split(/\s+/).filter(Boolean);
  const lignes: string[] = [];
  let ligne = '';
  for (const mot of mots) {
    const essai = ligne ? `${ligne} ${mot}` : mot;
    if (ctx.measureText(essai).width > maxW && ligne) {
      lignes.push(ligne);
      ligne = mot;
      if (lignes.length >= maxLignes) {
        ligne = '';
        break;
      }
    } else {
      ligne = essai;
    }
  }
  if (ligne && lignes.length < maxLignes) lignes.push(ligne);
  return lignes;
}

/** Echappe un texte pour l'inserer dans du HTML. */
export function echapperHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

export function assombrir(hex: string, quantite: number): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return hex;
  return (
    '#' +
    [m[1], m[2], m[3]]
      .map((c) => Math.max(0, parseInt(c ?? '0', 16) - quantite).toString(16).padStart(2, '0'))
      .join('')
  );
}
