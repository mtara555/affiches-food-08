/**
 * Moteur de rendu — Affiche promo (A4 de reference, A3 / A5 homothetiques)
 *
 * Portage de a4RenderCanvas / a4RenderEls : designations FR / AR, prix barre
 * raye, prix promo, rectangle economie « وفر », gain fidelite, code-barres
 * Code 39 (5 × 2 cm sur A4) et picto (5 × 3 cm).
 * Repere de reference : 420 × 594 (2 px/mm sur A4).
 * Les images (fond, picto, logo) sont prechargees : le rendu est synchrone,
 * donc le PDF contient toujours le picto (corrige un defaut de l'ancienne app).
 */

import type {
  CleElementAffiche,
  ElementAffiche,
  ElementAfficheSaisi,
  GabaritAffiche,
  Parametres,
  Picto,
  Saisie,
} from '../lib/types';
import { assombrir, chargerImage, couperLignes, decouperMontant, POLICE, POLICE_AR, preparerCanevas } from './commun';
import { dessinerCode39, largeurCode39, nettoyerCode39 } from './code39';

export const AF_L = 420;
export const AF_H = 594;

export type DonneesAffiche = Saisie<ElementAfficheSaisi>;

export interface ContexteAffiche {
  readonly gabarit: GabaritAffiche;
  readonly fond: HTMLImageElement | null;
  readonly picto: HTMLImageElement | null;
  readonly entete: string;
  readonly economie: ResultatEconomie;
}

/* -------------------------------------------------------------------------- */
/* Regles commerciales                                                         */
/* -------------------------------------------------------------------------- */

export interface ResultatEconomie {
  readonly ecart: number;
  readonly afficher: boolean;
  readonly motif: string;
  readonly gainFidelite: number;
}

/**
 * Economie affichee :
 *  - Food : si l'ecart atteint le seuil en DH (5 DH par defaut) ;
 *  - Non Food : si l'ecart atteint le seuil en % du prix barre (10 % par defaut).
 */
export function calculerEconomie(
  d: Pick<DonneesAffiche, 'barre' | 'promo' | 'fidelite' | 'secteur'>,
  p: Pick<Parametres, 'seuilEconomieFoodDh' | 'seuilEconomieNonFoodPct'>,
): ResultatEconomie {
  const ecart = d.barre > 0 && d.promo > 0 ? Math.max(0, Math.round((d.barre - d.promo) * 100) / 100) : 0;
  let afficher = false;
  let motif = 'pas de prix barre';
  if (ecart > 0) {
    if (d.secteur === 'food') {
      afficher = ecart >= p.seuilEconomieFoodDh;
      motif = afficher ? '' : `sous le seuil Food (${p.seuilEconomieFoodDh} DH)`;
    } else {
      afficher = d.barre > 0 && (ecart / d.barre) * 100 >= p.seuilEconomieNonFoodPct;
      motif = afficher ? '' : `sous le seuil Non Food (${p.seuilEconomieNonFoodPct} %)`;
    }
  } else if (d.barre > 0 && d.promo > 0) {
    motif = 'prix promo superieur ou egal au prix barre';
  }
  const gainFidelite = d.fidelite > 0 && d.promo > 0 ? (d.promo * d.fidelite) / 100 : 0;
  return { ecart, afficher, motif, gainFidelite };
}

/* -------------------------------------------------------------------------- */
/* Gabarits par defaut                                                         */
/* -------------------------------------------------------------------------- */

export function elementsParDefaut(): Record<CleElementAffiche, ElementAffiche> {
  return {
    desFR: { x: 0.05, y: 0.08, fs: 34, color: '#FFFFFF' },
    desAR: { x: 0.95, y: 0.16, fs: 24, color: '#FFFFFF' },
    prixBarre: { x: 0.28, y: 0.33, fs: 30, color: '#FFAAAA' },
    prixPromo: { x: 0.5, y: 0.47, fs: 74, color: '#FFFFFF' },
    diff: { x: 0.05, y: 0.58, fs: 22, color: '#FFE600' },
    fidelite: { x: 0.05, y: 0.72, fs: 20, color: '#F59E0B' },
    gencode: { x: 0.5, y: 0.91, fs: 8, color: '#FFFFFF' },
    picto: { x: 0.77, y: 0.27, w: 0.2, h: 0.14 },
  };
}

export const RECT_ECONOMIE_DEFAUT = { x: 0.05, y: 0.55, w: 0.9, h: 0.105 };

export function gabaritsAfficheParDefaut(): GabaritAffiche[] {
  const e = elementsParDefaut;
  const g = (id: string, nom: string, bg: string, bg2: string, logo: boolean, els = e(), ordre = 0): GabaritAffiche => ({
    id, nom, bg, bg2, image: null, logo, els, ordre,
  });
  return [
    g('MARJANE_BLEU', 'MARJANE BLEU', '#1a4da0', '#0d2d6b', true, e(), 1),
    g('MARJANE_JAUNE', 'MARJANE JAUNE', '#FFE600', '#e6b800', true, {
      ...e(),
      prixPromo: { x: 0.5, y: 0.47, fs: 74, color: '#1a4da0' },
      desFR: { x: 0.05, y: 0.08, fs: 34, color: '#1a4da0' },
      desAR: { x: 0.95, y: 0.16, fs: 24, color: '#1a4da0' },
      prixBarre: { x: 0.28, y: 0.33, fs: 30, color: '#C8102E' },
    }, 2),
    g('PROMO_ROUGE', 'PROMO ROUGE', '#991b1b', '#7f1d1d', false, e(), 3),
    g('PROMO_VERT', 'PROMO VERT', '#14532d', '#052e16', false, e(), 4),
    g('PROMO_BLEU', 'PROMO BLEU', '#1e3a5f', '#1e1b4b', false, e(), 5),
    g('PROMO_ORANGE', 'PROMO ORANGE', '#92400e', '#78350f', false, {
      ...e(),
      prixPromo: { x: 0.5, y: 0.47, fs: 74, color: '#fef3c7' },
    }, 6),
    g('PROMO_NOIR', 'PROMO NOIR', '#111827', '#030712', false, e(), 7),
    g('PROMO_VIOLET', 'PROMO VIOLET', '#581c87', '#3b0764', false, e(), 8),
  ];
}

/** Element effectif : valeurs du gabarit completees par les valeurs par defaut. */
export function elementEffectif(g: GabaritAffiche, cle: CleElementAffiche): ElementAffiche {
  return { ...elementsParDefaut()[cle], ...(g.els[cle] ?? {}) };
}

/* -------------------------------------------------------------------------- */
/* Preparation (chargement des images)                                         */
/* -------------------------------------------------------------------------- */

export async function preparerAffiche(
  d: DonneesAffiche,
  gabarit: GabaritAffiche,
  pictos: ReadonlyMap<string, Picto>,
  parametres: Parametres,
): Promise<ContexteAffiche> {
  const [fond, picto] = await Promise.all([
    chargerImage(gabarit.image),
    chargerImage(d.picto ? pictos.get(d.picto)?.image : null),
  ]);
  return {
    gabarit,
    fond,
    picto,
    entete: parametres.enteteAffiche,
    economie: calculerEconomie(d, parametres),
  };
}

/* -------------------------------------------------------------------------- */
/* Dessin                                                                      */
/* -------------------------------------------------------------------------- */

const p900 = (fz: number) => `900 ${fz}px ${POLICE}`;

export function dessinerAffiche(canvas: HTMLCanvasElement, d: DonneesAffiche, rc: ContexteAffiche, k: number): void {
  const ctx = preparerCanevas(canvas, AF_L, AF_H, k);
  const W = AF_L;
  const H = AF_H;
  const g = rc.gabarit;
  /** shadowBlur ne suit pas la mise a l'echelle du contexte. */
  const flou = (v: number) => v * k;

  /* --- Fond --- */
  if (rc.fond) {
    ctx.drawImage(rc.fond, 0, 0, W, H);
  } else {
    const degrade = ctx.createLinearGradient(0, 0, 0, H);
    degrade.addColorStop(0, g.bg || '#991b1b');
    degrade.addColorStop(1, g.bg2 || assombrir(g.bg || '#991b1b', 40));
    ctx.fillStyle = degrade;
    ctx.fillRect(0, 0, W, H);

    const jaune = g.bg.toLowerCase() === '#ffe600' || g.bg.toLowerCase() === '#e6b800';
    ctx.fillStyle = g.logo && jaune ? 'rgba(26,77,160,0.9)' : g.logo ? 'rgba(255,230,0,0.18)' : 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, W, H * 0.065);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = p900(12);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(rc.entete.toUpperCase(), W / 2, H * 0.034);

    if (!g.logo) {
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(0, H * 0.88, W, H * 0.12);
    }
  }

  ctx.save();

  /* --- Designation FR --- */
  if (d.desFR) {
    const e = elementEffectif(g, 'desFR');
    // Si la designation arabe suit, la francaise est reduite pour ne pas la chevaucher.
    const eAr = elementEffectif(g, 'desAR');
    const dispo = d.desAR && eAr.y > e.y ? (eAr.y - e.y) * H : Infinity;
    const texte = d.desFR.toUpperCase();
    let fz = e.fs ?? 34;
    const min = fz * 0.6;
    ctx.font = p900(fz);
    let lignes = couperLignes(ctx, texte, W * 0.92);
    while (fz > min && (lignes.length > 2 || lignes.length * fz * 1.15 > dispo)) {
      fz -= 1;
      ctx.font = p900(fz);
      lignes = couperLignes(ctx, texte, W * 0.92);
    }
    ctx.fillStyle = e.color || '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = flou(5);
    lignes.slice(0, 2).forEach((l, i) => ctx.fillText(l, W / 2, e.y * H + i * fz * 1.15));
    ctx.shadowBlur = 0;
  }

  /* --- Designation AR --- */
  if (d.desAR) {
    const e = elementEffectif(g, 'desAR');
    const fz = e.fs ?? 24;
    ctx.fillStyle = e.color || '#FFFFFF';
    ctx.font = `900 ${fz}px ${POLICE_AR}`;
    ctx.direction = 'rtl';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = flou(4);
    couperLignes(ctx, d.desAR, W * 0.92, 2).forEach((l, i) => ctx.fillText(l, W / 2, e.y * H + i * fz * 1.3));
    ctx.shadowBlur = 0;
    ctx.direction = 'ltr';
  }

  /* --- Prix barre (raye) --- */
  if (d.barre > 0) {
    const e = elementEffectif(g, 'prixBarre');
    const [ent, dec] = decouperMontant(d.barre);
    const fzI = e.fs ?? 30;
    const fzD = fzI * (e.decScale ?? 0.5);
    ctx.fillStyle = e.color || '#FFAAAA';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.font = p900(fzI);
    const iW = ctx.measureText(ent).width;
    ctx.font = p900(fzD);
    const suite = `,${dec} DH`;
    const total = iW + ctx.measureText(suite).width;
    const bx = e.x * W;
    const by = e.y * H;
    ctx.font = p900(fzI);
    ctx.fillText(ent, bx, by);
    ctx.font = p900(fzD);
    ctx.fillText(suite, bx + iW, by - (fzI - fzD) * 0.3);
    ctx.strokeStyle = e.color || '#FFAAAA';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(bx, by - fzI * 0.85);
    ctx.lineTo(bx + total, by + fzI * 0.05);
    ctx.stroke();
  }

  /* --- Prix promo --- */
  if (d.promo > 0) {
    const e = elementEffectif(g, 'prixPromo');
    const [ent, dec] = decouperMontant(d.promo);
    const fzI = e.fs ?? 74;
    const fzD = fzI * (e.decScale ?? 0.38);
    ctx.font = p900(fzI);
    const iW = ctx.measureText(ent).width;
    ctx.font = p900(fzD);
    const suite = `,${dec} DH`;
    const total = iW + ctx.measureText(suite).width;
    const sx = e.x * W - total / 2;
    const by = e.y * H + fzI * 0.35;
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = flou(14);
    ctx.fillStyle = e.color || '#FFFFFF';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = p900(fzI);
    ctx.fillText(ent, sx, by);
    ctx.font = p900(fzD);
    ctx.fillText(suite, sx + iW, by - (fzI - fzD) * 0.3);
    ctx.shadowBlur = 0;
  }

  /* --- Economie « وفر » --- */
  if (rc.economie.afficher && rc.economie.ecart > 0) {
    const e = elementEffectif(g, 'diff');
    const rx = (e.diffRectX ?? RECT_ECONOMIE_DEFAUT.x) * W;
    const ry = (e.diffRectY ?? RECT_ECONOMIE_DEFAUT.y) * H;
    const rw = (e.diffRectW ?? RECT_ECONOMIE_DEFAUT.w) * W;
    const rh = (e.diffRectH ?? RECT_ECONOMIE_DEFAUT.h) * H;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = flou(8);
    ctx.fillStyle = e.bgColor || '#C8102E';
    ctx.fillRect(rx, ry, rw, rh);
    ctx.restore();
    const fzI = e.fs ?? 22;
    const fzD = fzI * (e.decScale ?? 0.5);
    const [ent, dec] = decouperMontant(rc.economie.ecart);
    ctx.font = p900(fzI);
    const iW = ctx.measureText(ent).width;
    ctx.font = p900(fzD);
    const suite = `,${dec} DH`;
    const dW = ctx.measureText(suite).width;
    const sx = rx + rw / 2 - (iW + dW) / 2;
    const by = ry + rh / 2 + fzI * 0.35;
    ctx.fillStyle = e.color || '#FFE600';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = p900(fzI);
    ctx.fillText(ent, sx, by);
    ctx.font = p900(fzD);
    ctx.fillText(suite, sx + iW, by - fzI * 0.35);
    ctx.font = `900 ${rh * 0.38}px ${POLICE_AR}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('وفر', rx + rw - 6, ry + rh / 2);
  }

  /* --- Gain fidelite --- */
  if (rc.economie.gainFidelite > 0) {
    const e = elementEffectif(g, 'fidelite');
    const [ent, dec] = decouperMontant(rc.economie.gainFidelite);
    const fzI = e.fs ?? 20;
    const fzD = fzI * (e.decScale ?? 0.45);
    const cx = e.x * W;
    const cy = e.y * H;
    ctx.fillStyle = e.color || '#FFE600';
    if (!rc.fond) {
      // Sans fond imprime, on precise ce que represente le montant.
      ctx.font = p900(fzI * 0.42);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText('GAIN FIDÉLITÉ  ربح', cx, cy - fzI * 0.85);
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = p900(fzI);
    const iW = ctx.measureText(ent).width;
    ctx.fillText(ent, cx, cy);
    ctx.font = p900(fzD);
    ctx.fillText(`,${dec}`, cx + iW, cy - fzI * 0.3);
    ctx.fillText('DH', cx + iW + ctx.measureText(`,${dec}`).width + 3, cy - fzI * 0.3);
  }

  /* --- Code-barres Code 39 (5 × 2 cm maximum sur A4) --- */
  const propre = nettoyerCode39(d.code);
  if (propre) {
    const e = elementEffectif(g, 'gencode');
    const maxW = W * (50 / 210);
    const maxH = H * (20 / 297);
    const unites = largeurCode39(propre);
    const unite = Math.min(maxW / unites, maxH / 44);
    const largeur = unites * unite;
    const hBarres = unite * 40;
    const hTexte = Math.max(unite * 4, 5);
    const total = hBarres + hTexte + 4;
    const cx = Math.min(Math.max(e.x * W, largeur / 2 + 6), W - largeur / 2 - 6);
    const cy = Math.min(e.y * H, H - total / 2 - 4);
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(cx - largeur / 2 - 4, cy - hBarres / 2 - 3, largeur + 8, total + 2, 3);
    ctx.fill();
    dessinerCode39(ctx, propre, cx, cy, unite, hBarres, hTexte, '#000000');
  }

  /* --- Picto (5 × 3 cm) --- */
  if (rc.picto) {
    const e = elementEffectif(g, 'picto');
    const pw = (e.w ?? 0.2) * W;
    const ph = pw * (3 / 5);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = flou(6);
    ctx.drawImage(rc.picto, e.x * W - pw / 2, e.y * H - ph / 2, pw, ph);
    ctx.restore();
  }

  ctx.restore();
}
