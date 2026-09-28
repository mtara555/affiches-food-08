/**
 * Moteur de rendu — Etiquette A7 (74 × 105 mm)
 *
 * Portage fidele de drawLabel / drawLabelText de l'ancienne application :
 * memes positions (modele PowerPoint), memes regles (designation 2 lignes
 * avec reduction automatique, prix entier + decimales, cadres ingredients
 * FR / AR avec allergenes en rouge, zone fidelite, drapeau d'origine).
 * Repere de reference : 222 × 315 (3 px/mm), agrandi k fois a l'impression.
 */

import type { CouleursA7, ElementA7, GabaritA7, LayoutA7, Saisie } from '../lib/types';
import { GABARITS_A7_FIDELITE } from '../config/constants';
import { chargerImage, formaterPrix, POLICE, POLICE_AR, preparerCanevas, versNombre } from './commun';
import { ecrireIngredients, tailleAjustee, type StyleTexte } from './texte-allergenes';
import { codePays, urlDrapeau } from './drapeaux';
import { LAYOUT_A7_DEFAUT } from './a7-layout';

export const A7_L = 222;
export const A7_H = 315;

export type DonneesA7 = Saisie<ElementA7>;

export interface ContexteA7 {
  readonly gabarit: GabaritA7 | undefined;
  readonly fond: HTMLImageElement | null;
  readonly drapeau: HTMLImageElement | null;
  readonly couleurs: CouleursA7;
  /** Signature discrete en bas a droite (impression). */
  readonly signature?: string;
}

const COULEURS_GABARIT: Readonly<Record<string, string>> = {
  PAT: '#b45309', PAT_M: '#92400e', BOUL: '#d97706', B_AGN: '#7c3aed',
  B_FIL: '#1d4ed8', B_FIL_MN: '#1e3a8a', 'B_VOL-MN': '#7f1d1d',
  B_BCK: '#064e3b', B_VOL: '#991b1b', TRAIT: '#166534', FROM: '#1d4ed8',
  FROM_CAN: '#0f766e', GLACE: '#0369a1',
};

const police900 = (fz: number) => `900 ${fz}px ${POLICE}`;
const police500Ar = (fz: number) => `500 ${fz}px ${POLICE_AR}`;

/** Mise en page effective : valeurs PowerPoint + surcharges du gabarit. */
export function layoutEffectif(gabarit: GabaritA7 | undefined, code: string): LayoutA7 {
  return { ...(LAYOUT_A7_DEFAUT[code] ?? {}), ...(gabarit?.layout ?? {}) };
}

/** Charge les images necessaires a une etiquette (fond + drapeau). */
export async function preparerA7(
  item: DonneesA7,
  gabarits: ReadonlyMap<string, GabaritA7>,
  couleurs: CouleursA7,
  signature?: string,
): Promise<ContexteA7> {
  const gabarit = gabarits.get(item.gabarit);
  const pays = codePays(item.origine);
  const [fond, drapeau] = await Promise.all([
    chargerImage(gabarit?.image),
    pays ? chargerImage(urlDrapeau(pays)) : Promise.resolve(null),
  ]);
  return { gabarit, fond, drapeau, couleurs, signature };
}

/* -------------------------------------------------------------------------- */

/** Designation centree, 2 lignes max, taille reduite jusqu'a ce qu'elle tienne. */
function designationCentree(
  ctx: CanvasRenderingContext2D,
  texte: string,
  cx: number,
  y: number,
  maxW: number,
  fzDepart: number,
  fzMin: number,
  police: (fz: number) => string,
  maxH = Infinity,
): void {
  if (!texte) return;
  const mots = texte.split(' ');
  /** Lignes a cette taille ; `deborde` si des mots ne tiennent pas en 2 lignes. */
  const lignesPour = (fz: number) => {
    ctx.font = police(fz);
    const lignes: string[] = [];
    let ligne = '';
    let deborde = false;
    for (const m of mots) {
      const essai = ligne ? `${ligne} ${m}` : m;
      if (ctx.measureText(essai).width > maxW && ligne) {
        lignes.push(ligne);
        ligne = m;
        if (lignes.length >= 2) {
          deborde = true;
          ligne = '';
          break;
        }
      } else ligne = essai;
    }
    if (ligne) lignes.push(ligne);
    return { lignes, deborde };
  };
  let fz = fzDepart > 0 ? fzDepart : fzMin;
  for (let i = 0; i < 80; i++) {
    const { lignes, deborde } = lignesPour(fz);
    const tient = !deborde && lignes.every((l) => ctx.measureText(l).width <= maxW) && lignes.length * fz * 1.2 <= maxH + 1;
    if (tient || fz <= fzMin) {
      ctx.font = police(fz);
      ctx.textAlign = 'center';
      const hauteurLigne = fz * 1.2;
      lignes.forEach((l, j) => ctx.fillText(l, cx, y + j * hauteurLigne));
      return;
    }
    fz -= 0.5;
  }
}

/* -------------------------------------------------------------------------- */

/** Dessine l'etiquette dans le canevas (taille = 222k × 315k). */
export function dessinerA7(canvas: HTMLCanvasElement, item: DonneesA7, rc: ContexteA7, k: number): void {
  const ctx = preparerCanevas(canvas, A7_L, A7_H, k);
  const CW = A7_L;
  const CH = A7_H;
  const hasBg = Boolean(rc.fond);
  const L = layoutEffectif(rc.gabarit, item.gabarit);
  const G = rc.couleurs;

  /* --- Fond --- */
  if (rc.fond) {
    ctx.drawImage(rc.fond, 0, 0, CW, CH);
  } else {
    const c = COULEURS_GABARIT[item.gabarit] ?? '#1d2d44';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CW, CH);
    ctx.fillStyle = c;
    ctx.fillRect(0, 0, CW, 12);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.gabarit, CW / 2, 6);
    ctx.strokeStyle = `${c}88`;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, CW - 2, CH - 2);
  }

  const C = {
    designation: hasBg ? L.colDes || G.designation : G.designationNoBg,
    prix: hasBg ? L.colPrix || G.prix : G.prixNoBg,
    unite: hasBg ? L.colUnite || G.unite : G.uniteNoBg,
    allergene: L.colAllergen || G.allergen,
  };

  const fidelite = GABARITS_A7_FIDELITE.includes(item.gabarit);
  // Memes positions avec ou sans image de fond (valeurs du modele PowerPoint).
  const yDesFR = CH * (L.yDesFR ?? 0.18);
  const yDesAR = CH * (L.yDesAR ?? 0.28);
  const priceY = CH * (L.priceY ?? 0.4);
  const priceX = L.priceX != null ? CW * L.priceX : null;
  const uniteX = CW * (L.uniteX ?? 0.97);
  const uniteY = CH * (L.uniteY ?? 0.4);
  const fzDesFR = L.fzDesFR ?? 24;
  const fzDesAR = L.fzDesAR ?? 22;
  const fzIngFR = L.fzIngFR ?? 8;
  const fzIngAR = L.fzIngAR ?? 7;
  const fzUnite = L.fzUnite ?? 16;
  const maxDesW = CW * 0.9;

  /* --- Designation FR --- */
  ctx.fillStyle = C.designation;
  ctx.textBaseline = 'top';
  // Hauteur disponible : jusqu'a la designation arabe (ou jusqu'au prix).
  const hautFR = item.designationAr && yDesAR > yDesFR ? yDesAR - yDesFR : priceY > yDesFR ? priceY - yDesFR : Infinity;
  const hautAR = priceY > yDesAR ? priceY - yDesAR : Infinity;
  designationCentree(ctx, item.designationFr.slice(0, 60).toUpperCase(), CW / 2, yDesFR, maxDesW, fzDesFR, 11, police900, hautFR);

  /* --- Designation AR --- */
  if (item.designationAr) {
    ctx.fillStyle = C.designation;
    ctx.direction = 'rtl';
    designationCentree(ctx, item.designationAr.slice(0, 60), CW / 2, yDesAR, maxDesW, fzDesAR, 9, police500Ar, hautAR);
    ctx.direction = 'ltr';
  }

  /* --- Prix --- */
  const prix = formaterPrix(item.prix) || '0,00';
  const virgule = prix.indexOf(',');
  const entier = virgule > 0 ? prix.slice(0, virgule) : prix;
  const decimales = virgule > 0 ? prix.slice(virgule) : ',00';
  const fzInt = L.fzPrixInt ?? 52;
  const fzDec = L.fzPrixDec ?? 16;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = C.prix;
  ctx.font = police900(fzInt);
  const wInt = ctx.measureText(entier).width;
  ctx.font = police900(fzDec);
  const wDec = ctx.measureText(decimales).width;
  const wDh = ctx.measureText(' dh').width;
  const departX = priceX ?? (CW - (wInt + wDec + wDh)) / 2;
  const baseY = priceY + fzInt * 0.8;
  const hausse = (fzInt - fzDec) * 0.3;
  ctx.font = police900(fzInt);
  ctx.fillText(entier, departX, baseY);
  ctx.font = police900(fzDec);
  ctx.fillText(decimales, departX + wInt, baseY - hausse);
  ctx.fillText(' dh', departX + wInt + wDec, baseY - hausse);

  /* --- Unite --- */
  ctx.textBaseline = 'middle';
  ctx.font = police900(fzUnite);
  ctx.fillStyle = C.unite;
  ctx.textAlign = 'right';
  ctx.fillText((item.unite || 'PIÈCE').toUpperCase(), uniteX, uniteY);
  ctx.textAlign = 'left';

  /* --- Prix au poids (gabarits fidelite) --- */
  if (fidelite && item.grammage) {
    const g = versNombre(item.grammage);
    const p = versNombre(item.prix);
    if (!Number.isNaN(g) && !Number.isNaN(p)) {
      // A gauche de la zone fidelite, reduit si besoin pour ne pas la chevaucher.
      const texte = `× ${String(item.grammage).replace('.', ',')} kg = ${formaterPrix(p * g)} dh`;
      const maxW = (L.fidX ?? 0.6) * CW - 10;
      let fz = 18;
      ctx.font = `900 ${fz}px ${POLICE}`;
      while (fz > 8 && ctx.measureText(texte).width > maxW) {
        fz -= 0.5;
        ctx.font = `900 ${fz}px ${POLICE}`;
      }
      ctx.fillStyle = hasBg ? '#ffffff' : '#1d4ed8';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(texte, 6, priceY + fzInt + 8);
    }
  }

  /* --- Fidelite --- */
  const pct = versNombre(item.fidelite);
  const prixN = versNombre(item.prix);
  if (pct > 0 && prixN > 0) {
    const gain = (prixN * pct) / 100;
    if (fidelite) {
      const texte = gain.toFixed(2).replace('.', ',');
      const i = texte.indexOf(',');
      const ent = texte.slice(0, i);
      const dec = `${texte.slice(i)}dh`;
      const fX = (L.fidX ?? 0.6) * CW;
      const fY = (L.fidY ?? 0.48) * CH;
      const fW = (L.fidW ?? 0.38) * CW;
      const fH = (L.fidH ?? 0.29) * CH;
      const fzI = L.fzFidInt ?? 24;
      const fzD = L.fzFidDec ?? 10;
      if (!hasBg) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,68,151,0.12)';
        ctx.strokeStyle = 'rgba(0,68,151,0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(fX, fY, fW, fH, 6);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      ctx.save();
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = hasBg ? '#ffffff' : '#004497';
      ctx.font = police900(fzI);
      const iW = ctx.measureText(ent).width;
      ctx.font = police900(fzD);
      const dW = ctx.measureText(dec).width;
      const sx = fX + (fW - iW - dW) / 2;
      const by = fY + fH * 0.55 + fzI * 0.45;
      ctx.font = police900(fzI);
      ctx.fillText(ent, sx, by);
      ctx.font = police900(fzD);
      ctx.fillText(dec, sx + iW, by - (fzI - fzD) * 0.28);
      ctx.font = `bold ${fzD - 1}px sans-serif`;
      ctx.fillStyle = hasBg ? 'rgba(255,255,220,0.9)' : '#f59e0b';
      ctx.textBaseline = 'top';
      ctx.fillText(`${pct}%`, fX + 3, fY + 3);
      ctx.restore();
    } else {
      const libelle = `${pct}% = ${gain.toFixed(2).replace('.', ',')}dh`;
      ctx.save();
      ctx.font = 'bold 9px sans-serif';
      const tw = ctx.measureText(libelle).width + 10;
      const bx = CW - 3;
      const by = CH * (L.allergyY ?? 0.72) - 14;
      ctx.fillStyle = 'rgba(245,158,11,0.15)';
      ctx.strokeStyle = 'rgba(245,158,11,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(bx - tw, by - 6, tw, 14, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#b45309';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(libelle, bx - 5, by + 1);
      ctx.restore();
    }
  }

  /* --- Ingredients FR / AR dans des cadres blancs arrondis --- */
  const boxW = L.ingBoxW ?? 211.5;
  const boxH = L.ingBoxH ?? 50;
  const boxX = L.ingBoxX ?? (CW - boxW) / 2;
  const boxY = CH * (L.ingY ?? 0.75);
  const PX = 5;
  const PY = 4;
  const R = 6;
  const cadre = (y: number, h: number, texte: string, rtl: boolean, depart: number) => {
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(boxX, y, boxW, h, R);
    ctx.fill();
    if (!hasBg) {
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }
    ctx.clip();
    const base: Omit<StyleTexte, 'taille'> = {
      famille: rtl ? POLICE_AR : 'Arial, Helvetica, sans-serif',
      poidsNormal: rtl ? '500' : '400',
      couleur: '#222222',
      couleurAllergene: C.allergene,
      interligne: rtl ? 1.3 : 1.2,
    };
    const maxW = boxW - PX * 2;
    const fz = tailleAjustee(ctx, texte, maxW, h - PY * 2, base, depart, 5, rtl);
    ecrireIngredients(ctx, texte, rtl ? boxX + PX + maxW : boxX + PX, y + PY, maxW, { ...base, taille: fz }, rtl);
    ctx.restore();
  };
  const ingFr = item.ingredientsFr.trim();
  const ingAr = item.ingredientsAr.trim();
  // Les deux cadres doivent tenir dans l'etiquette (bande de 10 px gardee
  // en bas pour le code article) : sinon leurs hauteurs sont reduites au prorata.
  let hFr = boxH;
  let hAr = L.ingArBoxH ?? 44;
  const ecart = 4;
  const dispo = CH - 10 - boxY;
  if (ingFr && ingAr && hFr + ecart + hAr > dispo) {
    const r = (dispo - ecart) / (hFr + hAr);
    hFr *= r;
    hAr *= r;
  } else if (ingFr && !ingAr) hFr = Math.min(hFr, dispo);
  else if (ingAr && !ingFr) hAr = Math.min(hAr, dispo);
  if (ingFr) cadre(boxY, hFr, ingFr, false, fzIngFR);
  if (ingAr) cadre(ingFr ? boxY + hFr + ecart : boxY, hAr, ingAr, true, fzIngAR);

  /* --- Origine + drapeau --- */
  if (item.origine.trim() && !rc.drapeau) {
    // Drapeau indisponible (hors ligne, pays inconnu) : origine en toutes lettres.
    ctx.save();
    ctx.font = `700 ${L.fzDrapName ?? 10}px ${POLICE}`;
    ctx.fillStyle = L.colDrapText || (hasBg ? '#ffffff' : '#000000');
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(`Origine : ${item.origine.trim()}`, CW - 6, CH * (L.drapY ?? 0.03) + 14);
    ctx.restore();
  }
  if (rc.drapeau) {
    const x = CW * (L.drapX ?? 0.78);
    const y = CH * (L.drapY ?? 0.03);
    const w = CW * (L.drapW ?? 0.18);
    const h = CH * (L.drapH ?? 0.055);
    ctx.save();
    ctx.drawImage(rc.drapeau, x, y, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 0.6;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = L.colDrapText || '#000000';
    ctx.textAlign = 'center';
    ctx.font = `700 ${L.fzDrapLabel ?? 10}px ${POLICE}`;
    ctx.textBaseline = 'bottom';
    ctx.fillText('Origine :', x + w / 2, y - 2);
    ctx.font = `700 ${L.fzDrapName ?? 10}px ${POLICE}`;
    ctx.textBaseline = 'top';
    ctx.fillText(item.origine.trim(), x + w / 2, y + h + 2);
    ctx.restore();
  }

  /* --- Code article --- */
  ctx.font = '7px ui-monospace, Consolas, monospace';
  ctx.fillStyle = hasBg ? '#F5E6C8' : '#888888';
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'left';
  ctx.fillText(item.code, 6, CH - 2);

  /* --- Signature --- */
  if (rc.signature) {
    ctx.save();
    const fz = Math.round(CW * 0.042);
    ctx.font = `600 ${fz}px ui-monospace, Consolas, monospace`;
    const tw = ctx.measureText(rc.signature).width;
    const sx = CW - tw - 10;
    const sy = CH - fz - 4;
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.roundRect(sx - 4, sy - 2, tw + 8, fz + 4, 3);
    ctx.fill();
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = '#f5c518';
    ctx.textBaseline = 'top';
    ctx.fillText(rc.signature, sx, sy);
    ctx.restore();
  }
}
