/**
 * Moteur de rendu — Balisage boulangerie / patisserie (150 × 40 mm)
 *
 * Portage de bDrawBalisage : fond image (modele PowerPoint) ou fond dessine
 * (panneau arabesque, bandeaux verticaux), designations FR / AR centrees dans
 * leur zone, ingredients FR (LTR) et AR (RTL) avec allergenes en rouge gras.
 * Repere de reference : 450 × 120 (3 px/mm).
 */

import type {
  AxeBalisage,
  CleAxeBalisage,
  CouleursBalisage,
  ElementBalisage,
  GabaritBalisage,
  Saisie,
} from '../lib/types';
import { chargerImage, POLICE, POLICE_AR, preparerCanevas } from './commun';
import { ecrireIngredients, tailleAjustee, type StyleTexte } from './texte-allergenes';

export const BA_L = 450;
export const BA_H = 120;

export type DonneesBalisage = Saisie<ElementBalisage>;

export interface ContexteBalisage {
  readonly gabarit: GabaritBalisage | undefined;
  readonly fond: HTMLImageElement | null;
  readonly couleurs: CouleursBalisage;
}

export const AXES_DEFAUT: Readonly<Record<CleAxeBalisage, AxeBalisage & { libelle: string }>> = {
  desFR: { libelle: 'Designation FR', x: 5, y: 8, w: 130, h: 55, fs: 10 },
  desAR: { libelle: 'Designation AR', x: 5, y: 68, w: 130, h: 46, fs: 9 },
  ingFR: { libelle: 'Ingredients FR', x: 150, y: 4, w: 145, h: 112, fs: 7 },
  ingAR: { libelle: 'Ingredients AR', x: 300, y: 4, w: 145, h: 112, fs: 7 },
};

export const CLES_AXES: readonly CleAxeBalisage[] = ['desFR', 'desAR', 'ingFR', 'ingAR'];

export const COULEURS_BALISAGE_DEFAUT: CouleursBalisage = {
  desFR: '#5c2d0a',
  desAR: '#3d1c00',
  ingFR: '#2a1500',
  ingAR: '#2a1500',
};

export function gabaritsBalisageParDefaut(): GabaritBalisage[] {
  return [
    { id: 'BOUL', nom: 'BOULANGERIE', image: null, axes: {}, libelleDroit: 'Allergènes', ordre: 1 },
    { id: 'PAT', nom: 'PÂTISSERIE', image: null, axes: {}, libelleDroit: 'Ingrédients', ordre: 2 },
  ];
}

export function axeEffectif(g: GabaritBalisage | undefined, cle: CleAxeBalisage): AxeBalisage {
  const d = AXES_DEFAUT[cle];
  const s = g?.axes[cle] ?? {};
  return { x: s.x ?? d.x, y: s.y ?? d.y, w: s.w ?? d.w, h: s.h ?? d.h, fs: s.fs ?? d.fs };
}

export async function preparerBalisage(
  d: DonneesBalisage,
  gabarits: ReadonlyMap<string, GabaritBalisage>,
  couleurs: CouleursBalisage,
): Promise<ContexteBalisage> {
  const gabarit = gabarits.get(d.gabarit) ?? gabarits.get('BOUL');
  return { gabarit, fond: await chargerImage(gabarit?.image), couleurs };
}

/* -------------------------------------------------------------------------- */

function arabesque(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, couleur: string) {
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = couleur;
  ctx.lineWidth = 0.8;
  const pas = 12;
  for (let i = 0; i < w; i += pas) {
    for (let j = 0; j < h; j += pas) {
      ctx.beginPath();
      ctx.moveTo(x + i + pas / 2, y + j);
      ctx.lineTo(x + i + pas, y + j + pas / 2);
      ctx.lineTo(x + i + pas / 2, y + j + pas);
      ctx.lineTo(x + i, y + j + pas / 2);
      ctx.closePath();
      ctx.stroke();
    }
  }
  ctx.restore();
}

function texteVertical(ctx: CanvasRenderingContext2D, texte: string, cx: number, cy: number, police: string) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#ffffff';
  ctx.font = police;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(texte, 0, 0);
  ctx.restore();
}

/** Texte multiligne centre dans une zone (centre cx, cy). */
function texteCentre(ctx: CanvasRenderingContext2D, texte: string, cx: number, cy: number, maxW: number, interligne: number) {
  const mots = texte.split(/\s+/).filter(Boolean);
  const lignes: string[] = [];
  let ligne = '';
  for (const m of mots) {
    const essai = ligne ? `${ligne} ${m}` : m;
    if (ctx.measureText(essai).width > maxW && ligne) {
      lignes.push(ligne);
      ligne = m;
    } else ligne = essai;
  }
  if (ligne) lignes.push(ligne);
  let y = cy - (lignes.length * interligne) / 2 + interligne / 2;
  ctx.textAlign = 'center';
  for (const l of lignes) {
    ctx.fillText(l, cx, y);
    y += interligne;
  }
}

function ingredients(
  ctx: CanvasRenderingContext2D,
  texte: string,
  axe: AxeBalisage,
  famille: string,
  couleur: string,
  rtl: boolean,
) {
  const style: StyleTexte = {
    taille: axe.fs,
    famille,
    poidsNormal: '400',
    couleur,
    couleurAllergene: '#FF0000',
    interligne: 1.35,
  };
  // Reduit la taille si le texte depasse la zone (jusqu'a 70 %).
  const fz = tailleAjustee(ctx, texte, axe.w, axe.h, style, axe.fs, axe.fs * 0.7, rtl);
  const maxLignes = Math.max(1, Math.floor(axe.h / (fz * 1.35)));
  ecrireIngredients(ctx, texte, rtl ? axe.x + axe.w : axe.x, axe.y, axe.w, { ...style, taille: fz }, rtl, maxLignes);
}

export function dessinerBalisage(canvas: HTMLCanvasElement, d: DonneesBalisage, rc: ContexteBalisage, k: number): void {
  const ctx = preparerCanevas(canvas, BA_L, BA_H, k);
  const CW = BA_L;
  const CH = BA_H;
  const g = rc.gabarit;

  if (rc.fond) {
    ctx.drawImage(rc.fond, 0, 0, CW, CH);
  } else {
    // Fond dessine, aligne sur les zones par defaut :
    // designations 0-138 | bandeau | ingredients FR 150-295 | ingredients AR 300-445.
    const barre = '#5c2d0a';
    const bord = '#8B5E3C';
    ctx.fillStyle = '#fff8ee';
    ctx.fillRect(0, 0, CW, CH);
    ctx.fillStyle = '#f5efe0';
    ctx.fillRect(0, 0, 136, CH);
    arabesque(ctx, 0, 0, 136, CH, bord);
    ctx.fillStyle = barre;
    ctx.fillRect(136, 0, 12, CH);
    texteVertical(ctx, g?.libelleDroit || 'Ingrédients', 142, CH * 0.27, `700 7px ${POLICE}`);
    texteVertical(ctx, 'المكونات', 142, CH * 0.75, `700 7.5px ${POLICE_AR}`);
    ctx.strokeStyle = 'rgba(139,94,60,0.45)';
    ctx.lineWidth = 0.8;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(297.5, 8);
    ctx.lineTo(297.5, CH - 8);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = bord;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, CW - 2, CH - 2);
  }

  const vide = !rc.fond;
  const aDesFR = axeEffectif(g, 'desFR');
  ctx.save();
  ctx.font = `700 ${aDesFR.fs}px ${POLICE}`;
  ctx.fillStyle = rc.couleurs.desFR;
  ctx.textBaseline = 'middle';
  texteCentre(ctx, d.desFR || (vide ? 'Désignation FR' : ''), aDesFR.x + aDesFR.w / 2, aDesFR.y + aDesFR.h / 2, aDesFR.w, aDesFR.fs + 2);
  ctx.restore();

  const aDesAR = axeEffectif(g, 'desAR');
  ctx.save();
  ctx.font = `600 ${aDesAR.fs}px ${POLICE_AR}`;
  ctx.fillStyle = rc.couleurs.desAR;
  ctx.textBaseline = 'middle';
  ctx.direction = 'rtl';
  texteCentre(ctx, d.desAR || (vide ? 'الاسم بالعربية' : ''), aDesAR.x + aDesAR.w / 2, aDesAR.y + aDesAR.h / 2, aDesAR.w, aDesAR.fs + 2);
  ctx.restore();

  if (d.ingAR.trim()) ingredients(ctx, d.ingAR.trim(), axeEffectif(g, 'ingAR'), POLICE_AR, rc.couleurs.ingAR, true);
  if (d.ingFR.trim()) ingredients(ctx, d.ingFR.trim(), axeEffectif(g, 'ingFR'), POLICE, rc.couleurs.ingFR, false);
}
