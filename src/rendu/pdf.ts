/**
 * Imposition et export PDF
 *
 *  - Etiquettes A7 : 4 par feuille A4 portrait (positions de l'ancienne application).
 *  - Affiches : A4 = 1 par page A4, A3 = 1 par page A3, A5 = 2 par A4 paysage.
 *  - Balisage 150 × 40 mm : 7 par feuille A4 portrait.
 *  - Affiches vrac (dimensions personnalisees) : grille automatique sur A4
 *    (portrait ou paysage, au plus de pieces par feuille) ; trop grandes pour
 *    un A4 -> une par page, a leur taille exacte.
 *
 * Chaque element est dessine hors ecran a haute resolution puis insere en JPEG
 * (PNG pour le balisage, texte fin). jsPDF est charge a la demande.
 */

import { FORMATS, type FormatAffiche } from '../config/constants';
import { chargerPolices } from './commun';

export type Progression = (fait: number, total: number) => void;

export interface ResultatPdf {
  readonly blob: Blob;
  readonly nomFichier: string;
  readonly pages: number;
}

/** Fonction qui dessine l'element i dans le canevas fourni. */
export type Dessinateur = (canvas: HTMLCanvasElement, index: number) => Promise<void>;

const aujourdhui = () => new Date().toISOString().slice(0, 10);
const nomPropre = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 60);

async function nouveauPdf(orientation: 'portrait' | 'landscape', format: 'a4' | 'a3' | [number, number]) {
  await chargerPolices();
  const { jsPDF } = await import('jspdf');
  return new jsPDF({ orientation, unit: 'mm', format, compress: true });
}

/** Laisse respirer l'interface entre deux elements (barre de progression). */
const pause = () => new Promise((r) => window.setTimeout(r, 0));

export async function pdfEtiquettesA7(
  total: number,
  dessiner: Dessinateur,
  nomCampagne: string,
  piedDePage: boolean,
  progression?: Progression,
): Promise<ResultatPdf> {
  const pdf = await nouveauPdf('portrait', 'a4');
  const positions: [number, number][] = [
    [5, 5],
    [79, 5],
    [5, 112],
    [79, 112],
  ];
  const canvas = document.createElement('canvas');
  for (let i = 0; i < total; i++) {
    if (i > 0 && i % 4 === 0) pdf.addPage();
    const [x, y] = positions[i % 4] ?? [5, 5];
    await dessiner(canvas, i);
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', x, y, 74, 105, undefined, 'FAST');
    progression?.(i + 1, total);
    await pause();
  }
  const pages = pdf.getNumberOfPages();
  if (piedDePage) {
    for (let p = 1; p <= pages; p++) {
      pdf.setPage(p);
      pdf.setFontSize(6);
      pdf.setTextColor(160, 160, 160);
      pdf.text(`Etiquettes A7 · ${nomCampagne} · ${new Date().toLocaleDateString('fr-FR')}`, 5, 293);
      pdf.text(`Page ${p}/${pages}`, 205, 293, { align: 'right' });
    }
  }
  return { blob: pdf.output('blob'), nomFichier: `Etiquettes_A7_${nomPropre(nomCampagne)}_${aujourdhui()}.pdf`, pages };
}

/* -------------------------------------------------------------------------- */
/* Affiches vrac : dimensions personnalisees                                   */
/* -------------------------------------------------------------------------- */

const MARGE_VRAC = 4;
const ECART_VRAC = 1.5;

export interface DispositionVrac {
  readonly orientation: 'portrait' | 'landscape';
  /** Dimensions de la page (mm). */
  readonly pageL: number;
  readonly pageH: number;
  readonly colonnes: number;
  readonly lignes: number;
  readonly parPage: number;
  /** Vrai si l'affiche ne tient pas sur un A4 : une par page, a sa taille exacte. */
  readonly pageSurMesure: boolean;
}

/** Choisit la meilleure imposition (A4 portrait ou paysage) pour une affiche l × h mm. */
export function disposerVrac(l: number, h: number): DispositionVrac {
  const essai = (pageL: number, pageH: number) => ({
    colonnes: Math.max(0, Math.floor((pageL - 2 * MARGE_VRAC + ECART_VRAC) / (l + ECART_VRAC))),
    lignes: Math.max(0, Math.floor((pageH - 2 * MARGE_VRAC + ECART_VRAC) / (h + ECART_VRAC))),
  });
  const portrait = essai(210, 297);
  const paysage = essai(297, 210);
  const nbPortrait = portrait.colonnes * portrait.lignes;
  const nbPaysage = paysage.colonnes * paysage.lignes;
  if (nbPortrait === 0 && nbPaysage === 0) {
    return { orientation: l > h ? 'landscape' : 'portrait', pageL: l, pageH: h, colonnes: 1, lignes: 1, parPage: 1, pageSurMesure: true };
  }
  const choix = nbPaysage > nbPortrait ? paysage : portrait;
  const orientation = nbPaysage > nbPortrait ? 'landscape' : 'portrait';
  return {
    orientation,
    pageL: orientation === 'landscape' ? 297 : 210,
    pageH: orientation === 'landscape' ? 210 : 297,
    colonnes: choix.colonnes,
    lignes: choix.lignes,
    parPage: choix.colonnes * choix.lignes,
    pageSurMesure: false,
  };
}

export async function pdfVrac(
  total: number,
  dessiner: Dessinateur,
  nomCampagne: string,
  largeurMm: number,
  hauteurMm: number,
  piedDePage: boolean,
  progression?: Progression,
): Promise<ResultatPdf> {
  const d = disposerVrac(largeurMm, hauteurMm);
  const pdf = await nouveauPdf(d.orientation, d.pageSurMesure ? [d.pageL, d.pageH] : 'a4');
  const canvas = document.createElement('canvas');
  // Grille centree horizontalement, alignee en haut (marge de 5 mm).
  const largeurGrille = d.colonnes * largeurMm + (d.colonnes - 1) * ECART_VRAC;
  const x0 = d.pageSurMesure ? 0 : (d.pageL - largeurGrille) / 2;
  const y0 = d.pageSurMesure ? 0 : MARGE_VRAC;
  for (let i = 0; i < total; i++) {
    const place = i % d.parPage;
    if (i > 0 && place === 0) pdf.addPage();
    const col = place % d.colonnes;
    const ligne = Math.floor(place / d.colonnes);
    await dessiner(canvas, i);
    pdf.addImage(
      canvas.toDataURL('image/jpeg', 0.92),
      'JPEG',
      x0 + col * (largeurMm + ECART_VRAC),
      y0 + ligne * (hauteurMm + ECART_VRAC),
      largeurMm,
      hauteurMm,
      undefined,
      'FAST',
    );
    progression?.(i + 1, total);
    await pause();
  }
  const pages = pdf.getNumberOfPages();
  if (piedDePage && !d.pageSurMesure) {
    for (let p = 1; p <= pages; p++) {
      pdf.setPage(p);
      pdf.setFontSize(6);
      pdf.setTextColor(160, 160, 160);
      pdf.text(`Affiches vrac ${largeurMm} × ${hauteurMm} mm · ${nomCampagne} · ${new Date().toLocaleDateString('fr-FR')}`, 5, d.pageH - 2);
      pdf.text(`Page ${p}/${pages}`, d.pageL - 5, d.pageH - 2, { align: 'right' });
    }
  }
  return {
    blob: pdf.output('blob'),
    nomFichier: `Vrac_${largeurMm}x${hauteurMm}_${nomPropre(nomCampagne)}_${aujourdhui()}.pdf`,
    pages,
  };
}

export async function pdfAffiches(
  total: number,
  format: FormatAffiche,
  dessiner: Dessinateur,
  nomCampagne: string,
  progression?: Progression,
): Promise<ResultatPdf> {
  const def = FORMATS[format];
  const a5 = format === 'A5';
  const pdf = await nouveauPdf(a5 ? 'landscape' : 'portrait', def.page);
  const canvas = document.createElement('canvas');
  for (let i = 0; i < total; i++) {
    const place = i % def.parPage;
    if (i > 0 && place === 0) pdf.addPage();
    await dessiner(canvas, i);
    const img = canvas.toDataURL('image/jpeg', 0.93);
    if (a5) {
      pdf.addImage(img, 'JPEG', place === 0 ? 0 : 148.5, 0, 148.5, 210, undefined, 'FAST');
      if (place === 1 || i === total - 1) {
        // Trait de coupe discret au milieu de la feuille.
        pdf.setDrawColor(200, 200, 200);
        pdf.setLineDashPattern([1.5, 1.5], 0);
        pdf.line(148.5, 0, 148.5, 3);
        pdf.line(148.5, 207, 148.5, 210);
      }
    } else {
      pdf.addImage(img, 'JPEG', 0, 0, def.largeurMm, def.hauteurMm, undefined, 'FAST');
    }
    progression?.(i + 1, total);
    await pause();
  }
  return {
    blob: pdf.output('blob'),
    nomFichier: `Affiches_${format}_${nomPropre(nomCampagne)}_${aujourdhui()}.pdf`,
    pages: pdf.getNumberOfPages(),
  };
}

export async function pdfBalisage(
  total: number,
  dessiner: Dessinateur,
  nomCampagne: string,
  progression?: Progression,
): Promise<ResultatPdf> {
  const pdf = await nouveauPdf('portrait', 'a4');
  const canvas = document.createElement('canvas');
  const x = 30; // centre horizontalement : (210 - 150) / 2
  const haut = 3;
  const espace = 0.5;
  for (let i = 0; i < total; i++) {
    const place = i % 7;
    if (i > 0 && place === 0) pdf.addPage();
    await dessiner(canvas, i);
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, haut + place * (40 + espace), 150, 40, undefined, 'FAST');
    progression?.(i + 1, total);
    await pause();
  }
  return {
    blob: pdf.output('blob'),
    nomFichier: `Balisage_${nomPropre(nomCampagne)}_${aujourdhui()}.pdf`,
    pages: pdf.getNumberOfPages(),
  };
}

/* -------------------------------------------------------------------------- */

export function telecharger(blob: Blob, nom: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Ouvre le PDF dans un nouvel onglet (impression directe depuis le lecteur). */
export function ouvrir(blob: Blob, fenetre?: Window | null): void {
  const url = URL.createObjectURL(blob);
  if (fenetre && !fenetre.closed) fenetre.location.href = url;
  else if (!window.open(url, '_blank')) telecharger(blob, 'affiches.pdf');
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
}

/** Partage natif (WhatsApp, e-mail…) si le navigateur le permet. */
export async function partager(blob: Blob, nom: string, texte: string): Promise<'partage' | 'telecharge'> {
  const fichier = new File([blob], nom, { type: 'application/pdf' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [fichier] })) {
    try {
      await nav.share({ title: nom, text: texte, files: [fichier] });
      return 'partage';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'partage';
    }
  }
  telecharger(blob, nom);
  return 'telecharge';
}
