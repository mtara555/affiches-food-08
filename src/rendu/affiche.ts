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
  LangueDesignation,
  OrganigrammeAffiche,
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
  /** Image de l'organigramme (zone economie) ; null = aucun / echec de chargement. */
  readonly organigramme: HTMLImageElement | null;
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
/* Designations AR / FR                                                        */
/* -------------------------------------------------------------------------- */

const RE_ARABE = /[\u0600-\u06FF]/;
/** Lettres latines (accentuees comprises) ; × et ÷ exclus. Chiffres et ponctuation sont neutres. */
const RE_LATIN = /[A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u024F]/;

/**
 * Detecte la langue d'une designation.
 *
 * Entree  : texte saisi (peut etre undefined cote donnees anciennes).
 * Sortie  : 'vide'  si vide apres trim ;
 *           'mixte' si au moins un caractere arabe (U+0600–U+06FF) ET au moins une lettre latine ;
 *           'ar'    si au moins un caractere arabe et aucune lettre latine ;
 *           'fr'    sinon (latin, chiffres, ponctuation).
 * Cas limites : chiffres et ponctuation seuls -> 'fr' ; « حليب 1 لتر » -> 'ar'
 *           (les chiffres ne comptent pas comme latin) ; « حليب 1L » -> 'mixte'.
 */
export function detecterLangueDesignation(texte: string): LangueDesignation {
  const t = (texte ?? '').trim();
  if (!t) return 'vide';
  const arabe = RE_ARABE.test(t);
  const latin = RE_LATIN.test(t);
  if (arabe && latin) return 'mixte';
  return arabe ? 'ar' : 'fr';
}

/**
 * Repartit les designations saisies entre la zone arabe et la zone francaise.
 *
 * Entrees : contenu des champs « Designation FR » et « Designation AR ».
 * Sortie  : { fr, ar } — chaine vide = zone non dessinee.
 * Regles  : une zone ne recoit jamais que sa propre langue ;
 *           texte arabe ou mixte -> zone arabe (priorite arabe, la zone FR reste vide pour ce texte) ;
 *           texte latin -> zone francaise ; texte vide -> rien.
 * Cas limites : texte arabe saisi dans le champ FR (ou latin dans le champ AR) est redirige vers
 *           la bonne zone ; si les deux champs portent la meme langue, le champ « naturel » de la
 *           zone l'emporte et l'autre est ignore.
 */
export function resoudreDesignations(desFR: string, desAR: string): { fr: string; ar: string } {
  const tFr = (desFR ?? '').trim();
  const tAr = (desAR ?? '').trim();
  const lFr = detecterLangueDesignation(tFr);
  const lAr = detecterLangueDesignation(tAr);
  const estArabe = (l: LangueDesignation) => l === 'ar' || l === 'mixte';
  const ar = estArabe(lAr) ? tAr : estArabe(lFr) ? tFr : '';
  const fr = lFr === 'fr' ? tFr : lAr === 'fr' ? tAr : '';
  return { fr, ar };
}

/* -------------------------------------------------------------------------- */
/* Zone economie : couleur, libelle, organigramme                              */
/* -------------------------------------------------------------------------- */

/** Bleu Marjane du rectangle derriere les prix (ancien rouge #C8102E). */
export const COULEUR_ECONOMIE_DEFAUT = '#004497';

/** Rouge de l'organigramme. */
export const COULEUR_ORGANIGRAMME_DEFAUT = '#FF0000';

/** Pente du bord haut de l'organigramme (coin haut-gauche descendu de 20 % de la hauteur). */
export const PENTE_ORGANIGRAMME_DEFAUT = 0.2;

/** Organigramme (mm sur A4 210 × 297) : forme du modele TEST2910, 42,8 mm au-dessus du bas du rectangle bleu. */
export const ORGANIGRAMME_DEFAUT = { x: 17.5, y: 123.5, w: 169.8, h: 67.7 } as const;

/** Position horizontale du montant et de « وفر » dans l'organigramme (fraction de sa largeur). */
const X_MONTANT = 0.357;
const X_VOIR = 0.825;

/** Organigramme effectif : valeurs enregistrees completees par les defauts. */
export function organigrammeEffectif(g: GabaritAffiche): OrganigrammeAffiche {
  return {
    image: null,
    ...ORGANIGRAMME_DEFAUT,
    couleur: COULEUR_ORGANIGRAMME_DEFAUT,
    pente: PENTE_ORGANIGRAMME_DEFAUT,
    ...(g.organigramme ?? {}),
  };
}

/**
 * Texte du montant economise, au format du modele : « 50,00 dh ».
 * Entree : ecart = prix barre − prix promo. Sortie : entier, virgule, 2 decimales, « dh ».
 * Cas limite : ecart <= 0 ou non fini -> '' (rien a afficher).
 */
export function montantEconomie(ecart: number): string {
  if (!Number.isFinite(ecart) || ecart <= 0) return '';
  const [ent, dec] = decouperMontant(ecart);
  return `${ent},${dec} dh`;
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
    diff: { x: 0.05, y: 0.58, fs: 30, color: '#FFE600', bgColor: COULEUR_ECONOMIE_DEFAUT },
    fidelite: { x: 0.05, y: 0.72, fs: 20, color: '#F59E0B' },
    gencode: { x: 0.5, y: 0.91, fs: 8, color: '#FFFFFF' },
    picto: { x: 0.77, y: 0.27, w: 0.2, h: 0.14 },
  };
}

/** Rectangle bleu derriere les prix (fractions de la page) : forme du modele TEST2910, cale sur les prix par defaut. */
export const RECT_ECONOMIE_DEFAUT = { x: 0.083, y: 0.28, w: 0.77, h: 0.28 };

export function gabaritsAfficheParDefaut(): GabaritAffiche[] {
  const e = elementsParDefaut;
  const g = (id: string, nom: string, bg: string, bg2: string, logo: boolean, els = e(), ordre = 0): GabaritAffiche => ({
    id, nom, bg, bg2, image: null, logo, els, ordre,
    organigramme: { image: null, ...ORGANIGRAMME_DEFAUT, couleur: COULEUR_ORGANIGRAMME_DEFAUT, pente: PENTE_ORGANIGRAMME_DEFAUT },
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
  const [fond, picto, organigramme] = await Promise.all([
    chargerImage(gabarit.image),
    chargerImage(d.picto ? pictos.get(d.picto)?.image : null),
    chargerImage(gabarit.organigramme?.image),
  ]);
  return {
    gabarit,
    fond,
    picto,
    organigramme,
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

  /* --- Designations : chaque zone ne recoit que sa langue (jamais de zone vide dessinee) --- */
  const des = resoudreDesignations(d.desFR, d.desAR);

  /* --- Designation FR --- */
  if (des.fr) {
    const e = elementEffectif(g, 'desFR');
    // Si la designation arabe suit, la francaise est reduite pour ne pas la chevaucher.
    const eAr = elementEffectif(g, 'desAR');
    const dispo = des.ar && eAr.y > e.y ? (eAr.y - e.y) * H : Infinity;
    const texte = des.fr.toUpperCase();
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
  if (des.ar) {
    const e = elementEffectif(g, 'desAR');
    const fz = e.fs ?? 24;
    ctx.fillStyle = e.color || '#FFFFFF';
    ctx.font = `900 ${fz}px ${POLICE_AR}`;
    ctx.direction = 'rtl';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = flou(4);
    couperLignes(ctx, des.ar, W * 0.92, 2).forEach((l, i) => ctx.fillText(l, W / 2, e.y * H + i * fz * 1.3));
    ctx.shadowBlur = 0;
    ctx.direction = 'ltr';
  }

  /* --- Economie : fonds (organigramme rouge puis rectangle bleu), sous les prix ---
   * Seulement si la regle commerciale l'autorise (AL >= 5 DH, NAL >= 10 %)
   * ET si l'ecart (prix barre − prix promo) est strictement positif. */
  const afficherEconomie = rc.economie.afficher && rc.economie.ecart > 0;
  if (afficherEconomie) {
    const e = elementEffectif(g, 'diff');
    const o = organigrammeEffectif(g);
    const ox = o.x * (W / 210);
    const oy = o.y * (H / 297);
    const ow = o.w * (W / 210);
    const oh = o.h * (H / 297);
    if (rc.organigramme) {
      ctx.drawImage(rc.organigramme, ox, oy, ow, oh);
    } else {
      // Forme du modele : bord haut en biais (coin haut-gauche descendu de `pente` × h).
      ctx.fillStyle = o.couleur || COULEUR_ORGANIGRAMME_DEFAUT;
      ctx.beginPath();
      ctx.moveTo(ox, oy + oh * (o.pente ?? PENTE_ORGANIGRAMME_DEFAUT));
      ctx.lineTo(ox + ow, oy);
      ctx.lineTo(ox + ow, oy + oh);
      ctx.lineTo(ox, oy + oh);
      ctx.closePath();
      ctx.fill();
    }
    // Rectangle bleu derriere les prix.
    ctx.fillStyle = e.bgColor || COULEUR_ECONOMIE_DEFAUT;
    ctx.fillRect(
      (e.diffRectX ?? RECT_ECONOMIE_DEFAUT.x) * W,
      (e.diffRectY ?? RECT_ECONOMIE_DEFAUT.y) * H,
      (e.diffRectW ?? RECT_ECONOMIE_DEFAUT.w) * W,
      (e.diffRectH ?? RECT_ECONOMIE_DEFAUT.h) * H,
    );
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

  /* --- Economie : montant et « وفر » dans l'organigramme (au-dessus du fond dessine plus haut) --- */
  if (afficherEconomie) {
    const e = elementEffectif(g, 'diff');
    const o = organigrammeEffectif(g);
    const ox = o.x * (W / 210);
    const oy = o.y * (H / 297);
    const ow = o.w * (W / 210);
    const oh = o.h * (H / 297);
    // Bande de texte : entre le bas du rectangle bleu et le bas de l'organigramme.
    const basBleu = (e.diffRectY ?? RECT_ECONOMIE_DEFAUT.y) * H + (e.diffRectH ?? RECT_ECONOMIE_DEFAUT.h) * H;
    const yTexte = (Math.min(Math.max(basBleu, oy), oy + oh) + oy + oh) / 2;
    const fz = e.fs ?? 30;
    ctx.fillStyle = e.color || '#FFE600';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.direction = 'ltr';
    ctx.font = p900(fz);
    ctx.fillText(montantEconomie(rc.economie.ecart), ox + ow * X_MONTANT, yTexte);
    ctx.direction = 'rtl';
    ctx.font = `900 ${fz}px ${POLICE_AR}`;
    ctx.fillText('وفر', ox + ow * X_VOIR, yTexte);
    ctx.direction = 'ltr';
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
