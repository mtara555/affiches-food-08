/**
 * Panneau fidelite des affiches : « prix (bleu) | gain fidelite (rose) + carte ».
 *
 * Dessine automatiquement le modele de reference des que le gabarit active le panneau
 * ET qu'un pourcentage de fidelite est saisi (10 %, 20 %…). Le montant du gain est celui
 * de calculerEconomie (prix promo × pourcentage). Les valeurs par defaut reproduisent
 * le modele fourni (A4, 794 × 1123 px) ; elles sont reglables par gabarit.
 */

import type { GabaritAffiche, PanneauFidelite } from '../lib/types';
import carteFournie from '../assets/img/carte-fidelite.jpg';
import { decouperMontant, POLICE_AR } from './commun';

/** Carte de fidelite fournie avec l'application (utilisee si le gabarit n'en definit pas). */
export const CARTE_FIDELITE_DEFAUT: string = carteFournie;

export const COULEUR_ROSE_DEFAUT = '#FB427B';
export const COULEUR_TEXTE_FIDELITE_DEFAUT = '#FFFF00';

export type PanneauFideliteEffectif = Required<Omit<PanneauFidelite, 'carte'>> & { carte: string | null };

/** Valeurs mesurees sur le modele de reference (fractions de la page). */
export const PANNEAU_FIDELITE_DEFAUT: PanneauFideliteEffectif = {
  actif: false,
  carte: null,
  couleurRose: COULEUR_ROSE_DEFAUT,
  couleurTexte: COULEUR_TEXTE_FIDELITE_DEFAUT,
  couleurGain: '#FFFFFF',
  couleurPrix: '#FFFFFF',
  couleurRature: '#FFC000',
  x: 0.0605,
  y: 0.5191,
  w: 0.8615,
  h: 0.2743,
  coupure: 0.609,
  carteX: 0.7544,
  carteY: 0.5049,
  carteW: 0.1814,
  carteH: 0.1222,
  carteAngle: -20.2,
  fsLibelle: 24,
};

export function panneauFidelite(g: GabaritAffiche): PanneauFideliteEffectif {
  const bascule = { ...PANNEAU_FIDELITE_DEFAUT, ...(g.fidelite ?? {}) } as PanneauFideliteEffectif;
  // Une valeur absente ou null du gabarit retombe sur le defaut.
  for (const cle of Object.keys(PANNEAU_FIDELITE_DEFAUT) as (keyof PanneauFideliteEffectif)[]) {
    if (cle !== 'carte' && (bascule[cle] === undefined || bascule[cle] === null)) (bascule as unknown as Record<string, unknown>)[cle] = PANNEAU_FIDELITE_DEFAUT[cle];
  }
  return bascule;
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Rectangles bleu (prix) et rose (gain) en pixels du canevas (repere W × H). */
export function rectanglesFidelite(pf: PanneauFideliteEffectif, W: number, H: number): { bleu: Rect; rose: Rect } {
  const x = pf.x * W;
  const y = pf.y * H;
  const w = pf.w * W;
  const h = pf.h * H;
  const coupure = Math.min(0.8, Math.max(0.3, pf.coupure));
  return { bleu: { x, y, w: w * coupure, h }, rose: { x: x + w * coupure, y, w: w * (1 - coupure), h } };
}

const p900 = (fz: number, police: string) => `900 ${fz}px ${police}`;

/**
 * Tailles du modele (fractions de la HAUTEUR du bloc : elles suivent donc le bloc si on le redimensionne).
 * Mesurees sur le modele fourni : entier, decimales (« ,50 ») et « dh » ont des tailles distinctes,
 * posees sur une meme ligne de base.
 */
const TAILLES = {
  barre: { entier: 0.1704, dec: 0.0843, dh: 0.0642 },
  promo: { entier: 0.6005, dec: 0.1696, dh: 0.1146 },
  gain: { entier: 0.301, dec: 0.0945, dh: 0.0653 },
} as const;

/** Ecart entre les decimales et « dh » (fraction de la taille des decimales). */
const ECART_DH = 0;

/**
 * Dessine « 32 » + « ,50 » + « dh » sur une meme ligne de base.
 * `x` : bord gauche, `aligne` : 'gauche' (x = debut du texte), 'droite' (x = fin) ou 'centre' (x = milieu).
 * Retourne la largeur totale et la hauteur des chiffres (pour la rature).
 */
function dessinerMontant(
  ctx: CanvasRenderingContext2D,
  montant: number,
  t: { entier: number; dec: number; dh: number },
  hBloc: number,
  x: number,
  baseline: number,
  aligne: 'gauche' | 'droite' | 'centre',
  police: string,
  largeurMax = Infinity,
): { debut: number; total: number; hauteur: number } {
  const [ent, dec] = decouperMontant(montant);
  let echelle = 1;
  const mesurer = (e: number) => {
    ctx.font = p900(t.entier * hBloc * e, police);
    const wEnt = ctx.measureText(ent).width;
    ctx.font = p900(t.dec * hBloc * e, police);
    const wDec = ctx.measureText(`,${dec}`).width;
    ctx.font = p900(t.dh * hBloc * e, police);
    const wDh = ctx.measureText('dh').width;
    const ecart = t.dec * hBloc * e * ECART_DH;
    return { wEnt, wDec, wDh, ecart, total: wEnt + wDec + ecart + wDh };
  };
  let m = mesurer(echelle);
  // Un prix trop long est reduit pour rester dans la zone.
  while (echelle > 0.2 && m.total > largeurMax) {
    echelle -= 0.01;
    m = mesurer(echelle);
  }
  const debut = aligne === 'gauche' ? x : aligne === 'droite' ? x - m.total : x - m.total / 2;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.direction = 'ltr';
  ctx.font = p900(t.entier * hBloc * echelle, police);
  ctx.fillText(ent, debut, baseline);
  ctx.font = p900(t.dec * hBloc * echelle, police);
  ctx.fillText(`,${dec}`, debut + m.wEnt, baseline);
  ctx.font = p900(t.dh * hBloc * echelle, police);
  ctx.fillText('dh', debut + m.wEnt + m.wDec + m.ecart, baseline);
  // Hauteur des chiffres : mesuree sur le « 3 » (les chiffres ont la meme hauteur).
  ctx.font = p900(t.entier * hBloc * echelle, police);
  return { debut, total: m.total, hauteur: ctx.measureText('3').actualBoundingBoxAscent };
}

/** Prix barre du mode fidelite : « 36,25dh » en haut a gauche, raye d'un trait montant. */
export function dessinerBarreFidelite(ctx: CanvasRenderingContext2D, barre: number, bleu: Rect, pf: PanneauFideliteEffectif, police: string): void {
  ctx.fillStyle = pf.couleurPrix;
  const bx = bleu.x + bleu.w * 0.0312;
  const by = bleu.y + bleu.h * 0.1396;
  const { total, hauteur } = dessinerMontant(ctx, barre, TAILLES.barre, bleu.h, bx, by, 'gauche', police, bleu.w * 0.6);
  // Rature montante, un peu plus longue que le prix (depassant a gauche et surtout a droite).
  ctx.strokeStyle = pf.couleurRature;
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.moveTo(bx - total * 0.06, by - hauteur * 0.15);
  ctx.lineTo(bx + total * 1.19, by - hauteur * 0.9);
  ctx.stroke();
}

/** Prix promo du mode fidelite : « 32,50dh », aligne a droite dans la zone bleue, avec une ombre legere. */
export function dessinerPromoFidelite(ctx: CanvasRenderingContext2D, promo: number, bleu: Rect, pf: PanneauFideliteEffectif, police: string, k: number): void {
  ctx.save();
  ctx.fillStyle = pf.couleurPrix;
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 3 * k;
  ctx.shadowOffsetY = 1.5 * k;
  dessinerMontant(ctx, promo, TAILLES.promo, bleu.h, bleu.x + bleu.w * 0.958, bleu.y + bleu.h * 0.7013, 'droite', police, bleu.w * 0.9);
  ctx.restore();
}

/** Zone rose : « رْبح », gain « 3,25dh » et « على بطاقتكم ». */
export function dessinerGainFidelite(ctx: CanvasRenderingContext2D, gain: number, rose: Rect, pf: PanneauFideliteEffectif, police: string): void {
  const cx = rose.x + rose.w / 2;
  ctx.fillStyle = pf.couleurGain;
  dessinerMontant(ctx, gain, TAILLES.gain, rose.h, cx, rose.y + rose.h * 0.5699, 'centre', police, rose.w * 0.9);

  // Libelles arabes (jaunes), reduits si besoin pour rester dans la zone rose.
  let fz = pf.fsLibelle;
  const libelle = (texte: string, xRel: number, yRel: number) => {
    ctx.font = p900(fz, POLICE_AR);
    while (fz > 8 && ctx.measureText(texte).width > rose.w * 0.95) {
      fz -= 1;
      ctx.font = p900(fz, POLICE_AR);
    }
    ctx.fillStyle = pf.couleurTexte;
    ctx.direction = 'rtl';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(texte, rose.x + rose.w * xRel, rose.y + rose.h * yRel);
    ctx.direction = 'ltr';
  };
  // « رْبح » porte un soukoun (ْ) comme sur le modele.
  libelle('رْبح', 0.5225, 0.245);
  libelle('على بطاقتكم', 0.4906, 0.9107);
}

/** Carte de fidelite inclinee, coins arrondis, debordant du haut de la zone rose. */
export function dessinerCarteFidelite(ctx: CanvasRenderingContext2D, carte: CanvasImageSource, dimensions: { l: number; h: number }, pf: PanneauFideliteEffectif, W: number, H: number): void {
  const w = pf.carteW * W;
  const h = pf.carteH * W;
  ctx.save();
  ctx.translate(pf.carteX * W, pf.carteY * H);
  ctx.rotate((pf.carteAngle * Math.PI) / 180);
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, h * 0.09);
  ctx.clip();
  // Rogne 1,5 % sur les bords de l'image : evite le liseré clair des photos de carte.
  const m = 0.015;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(carte, dimensions.l * m, dimensions.h * m, dimensions.l * (1 - 2 * m), dimensions.h * (1 - 2 * m), -w / 2, -h / 2, w, h);
  ctx.restore();
}
