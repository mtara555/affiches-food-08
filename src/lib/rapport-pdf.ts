/**
 * Rapport d'activite au format PDF (tableau de bord)
 *
 * Rapport A4 pour la periode choisie (jour, semaine, mois, trimestre, annee) :
 * chiffres cles, comparaison avec la periode precedente, histogramme par type
 * de campagne, detail par heure / jour / mois, repartition par operateur et
 * liste des campagnes. Construit dans le navigateur a partir des campagnes
 * deja chargees : aucune lecture Firestore supplementaire.
 *
 * jsPDF est charge a la demande (comme pour l'impression des affiches).
 */

import type { jsPDF } from 'jspdf';
import { TYPES_CAMPAGNE, TYPES_ORDONNES, MAGASIN } from '../config/constants';
import type { Campagne } from './types';
import {
  campagnesDansPlage,
  compter,
  dateCampagne,
  parOperateur,
  totalComptes,
  type PlageRapport,
} from './statistiques';

type RGB = [number, number, number];

const ENCRE: RGB = [14, 19, 48];
const ENCRE_DOUCE: RGB = [90, 96, 120];
const TRAIT: RGB = [217, 221, 232];
const FOND_CLAIR: RGB = [243, 245, 250];
const FOND_ALTERNE: RGB = [250, 251, 253];

const LARGEUR_PAGE = 210;
const HAUTEUR_PAGE = 297;
const MARGE = 14;
const LARGEUR_UTILE = LARGEUR_PAGE - 2 * MARGE;
const BAS_UTILE = HAUTEUR_PAGE - 16;
const NB_CAMPAGNES_MAX = 60;

export interface DonneesRapport {
  readonly plage: PlageRapport;
  readonly campagnes: readonly Campagne[];
  readonly nomUtilisateur: string;
  readonly libelleRole: string;
  readonly nomApplication: string;
}

const hexVersRgb = (hex: string): RGB => {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

/** Nombre a la francaise, avec une espace simple (les espaces insecables s'impriment mal en PDF). */
const nombre = (n: number) => n.toLocaleString('fr-FR').replace(/[\u202f\u00a0]/g, ' ');
const deux = (n: number) => String(n).padStart(2, '0');

/** Retire ce que la police standard du PDF ne sait pas dessiner (arabe, tirets longs, espaces insecables). */
function texte(t: string): string {
  const propre = t
    .replace(/[\u202f\u00a0]/g, ' ')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[^\u0020-\u00ff]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return propre || '-';
}

function dateHeure(d: Date): string {
  const jour = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  return `${jour} a ${deux(d.getHours())}h${deux(d.getMinutes())}`.replace(/[\u202f\u00a0]/g, ' ');
}

const dateCourte = (d: Date | null) =>
  d ? `${deux(d.getDate())}/${deux(d.getMonth() + 1)}/${d.getFullYear()}` : '-';

function nomFichier(plage: PlageRapport): string {
  const d = plage.debut;
  return `rapport-activite-${plage.type}-${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}.pdf`;
}

/** Graduations rondes pour l'axe vertical. */
function graduations(max: number): number[] {
  if (max <= 0) return [0, 1];
  const brut = max / 4;
  const puissance = 10 ** Math.floor(Math.log10(brut));
  const pas = Math.max(1, Math.round([1, 2, 5, 10].map((m) => m * puissance).find((p) => p >= brut) ?? puissance * 10));
  const liste: number[] = [];
  for (let v = 0; v <= max + pas - 1; v += pas) liste.push(v);
  if (liste[liste.length - 1]! < max) liste.push(liste[liste.length - 1]! + pas);
  return liste;
}

function variation(actuel: number, precedent: number): string {
  if (precedent === 0) return actuel === 0 ? 'stable' : 'nouveau';
  const pct = Math.round(((actuel - precedent) / precedent) * 100);
  return `${pct > 0 ? '+' : ''}${pct} %`;
}

const LIBELLE_STATUT: Record<Campagne['statut'], string> = {
  brouillon: 'A imprimer',
  imprimee: 'Imprimee',
  archivee: 'Archivee',
};

/* -------------------------------------------------------------------------- */
/* Tableau (dessine a la main : saut de page et en-tete repete)                 */
/* -------------------------------------------------------------------------- */

interface Colonne {
  readonly titre: string;
  /** Largeur en mm ; la colonne sans largeur prend le reste. */
  readonly largeur?: number;
  readonly droite?: boolean;
}

function tableau(
  doc: jsPDF,
  y0: number,
  colonnes: readonly Colonne[],
  lignes: readonly (readonly string[])[],
  pied?: readonly string[],
): number {
  const fixes = colonnes.reduce((s, c) => s + (c.largeur ?? 0), 0);
  const libres = colonnes.filter((c) => c.largeur === undefined).length;
  const largeurs = colonnes.map((c) => c.largeur ?? (LARGEUR_UTILE - fixes) / Math.max(1, libres));
  const hauteurLigne = 6;
  let y = y0;

  const dessinerLigne = (cellules: readonly string[], style: 'tete' | 'corps' | 'pied', alterne: boolean) => {
    if (y + hauteurLigne > BAS_UTILE) {
      doc.addPage();
      y = 18;
      dessinerLigne(colonnes.map((c) => c.titre), 'tete', false);
    }
    if (style === 'tete') doc.setFillColor(...ENCRE);
    else if (style === 'pied') doc.setFillColor(...FOND_CLAIR);
    else if (alterne) doc.setFillColor(...FOND_ALTERNE);
    if (style !== 'corps' || alterne) doc.rect(MARGE, y, LARGEUR_UTILE, hauteurLigne, 'F');

    doc.setDrawColor(...TRAIT);
    doc.setLineWidth(0.1);
    doc.line(MARGE, y + hauteurLigne, MARGE + LARGEUR_UTILE, y + hauteurLigne);

    doc.setFont('helvetica', style === 'corps' ? 'normal' : 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...(style === 'tete' ? ([255, 255, 255] as RGB) : ENCRE));
    let x = MARGE;
    cellules.forEach((cellule, i) => {
      const l = largeurs[i]!;
      const droite = colonnes[i]!.droite;
      const contenu = doc.splitTextToSize(texte(cellule), l - 3)[0] as string;
      doc.text(contenu, droite ? x + l - 1.5 : x + 1.5, y + 4.1, { align: droite ? 'right' : 'left' });
      x += l;
    });
    y += hauteurLigne;
  };

  dessinerLigne(colonnes.map((c) => c.titre), 'tete', false);
  lignes.forEach((l, i) => dessinerLigne(l, 'corps', i % 2 === 1));
  if (pied) dessinerLigne(pied, 'pied', false);
  return y;
}

function titreSection(doc: jsPDF, y: number, titre: string): number {
  let yy = y;
  if (yy > BAS_UTILE - 30) {
    doc.addPage();
    yy = 20;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...ENCRE);
  doc.text(texte(titre).toUpperCase(), MARGE, yy);
  return yy + 3;
}

/* -------------------------------------------------------------------------- */
/* Document                                                                    */
/* -------------------------------------------------------------------------- */

/** Construit le document sans le telecharger. */
export async function construireRapport(d: DonneesRapport): Promise<jsPDF> {
  const { jsPDF: JsPdf } = await import('jspdf');
  const { plage } = d;
  const doc = new JsPdf({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  doc.setProperties({
    title: `Rapport d'activite - ${texte(plage.libelle)}`,
    subject: 'Elements saisis par type de campagne',
    author: texte(d.nomUtilisateur),
    creator: d.nomApplication,
  });

  const couleurs = Object.fromEntries(TYPES_ORDONNES.map((t) => [t, hexVersRgb(TYPES_CAMPAGNE[t].couleur)])) as Record<
    (typeof TYPES_ORDONNES)[number],
    RGB
  >;

  const total = compter(d.campagnes, plage.debut, plage.fin);
  const precedent = compter(d.campagnes, plage.precedente.debut, plage.precedente.fin);
  const operateurs = parOperateur(d.campagnes, plage.debut, plage.fin);
  const dansPlage = campagnesDansPlage(d.campagnes, plage.debut, plage.fin);
  const sousComptes = plage.sousIntervalles.map((s) => ({ ...s, ...compter(d.campagnes, s.debut, s.fin) }));

  /* --- En-tete --------------------------------------------------------- */
  doc.setFillColor(...ENCRE);
  doc.rect(0, 0, LARGEUR_PAGE, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text("Rapport d'activité", MARGE, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.text(texte(plage.libelle), MARGE, 22, { maxWidth: LARGEUR_UTILE - 50 });
  doc.setFontSize(9);
  doc.text(texte(MAGASIN), LARGEUR_PAGE - MARGE, 14, { align: 'right' });
  doc.text(texte(d.nomApplication), LARGEUR_PAGE - MARGE, 20, { align: 'right' });

  doc.setTextColor(...ENCRE_DOUCE);
  doc.setFontSize(8.5);
  doc.text(
    texte(`Édité le ${dateHeure(new Date())} par ${d.nomUtilisateur} (${d.libelleRole}) - éléments rattachés à la date de création des campagnes`),
    MARGE,
    37,
    { maxWidth: LARGEUR_UTILE },
  );

  /* --- Chiffres cles --------------------------------------------------- */
  const tuiles: { titre: string; valeur: string; detail: string; couleur: RGB }[] = [
    { titre: 'ÉLÉMENTS SAISIS', valeur: nombre(total.total), detail: 'sur la période', couleur: ENCRE },
    { titre: 'CAMPAGNES', valeur: nombre(total.nbCampagnes), detail: 'créées sur la période', couleur: ENCRE_DOUCE },
    { titre: 'PÉRIODE PRÉCÉDENTE', valeur: nombre(precedent.total), detail: `Évolution : ${variation(total.total, precedent.total)}`, couleur: ENCRE_DOUCE },
    { titre: 'OPÉRATEURS', valeur: nombre(operateurs.length), detail: 'ayant créé des campagnes', couleur: ENCRE_DOUCE },
  ];
  const ecart = 4;
  const largeurTuile = (LARGEUR_UTILE - ecart * 3) / 4;
  let y = 43;
  tuiles.forEach((t, i) => {
    const x = MARGE + i * (largeurTuile + ecart);
    doc.setFillColor(...FOND_CLAIR);
    doc.setDrawColor(...TRAIT);
    doc.roundedRect(x, y, largeurTuile, 24, 2, 2, 'FD');
    doc.setFillColor(...t.couleur);
    doc.rect(x, y + 3, 1.2, 18, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...ENCRE_DOUCE);
    doc.text(texte(t.titre), x + 4, y + 6.5);
    doc.setFontSize(17);
    doc.setTextColor(...t.couleur);
    doc.text(texte(t.valeur), x + 4, y + 15);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...ENCRE_DOUCE);
    doc.text(texte(t.detail), x + 4, y + 20.5);
  });
  y += 24 + 9;

  /* --- Histogramme empile --------------------------------------------- */
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...ENCRE);
  doc.text(texte(`ÉLÉMENTS PAR ${plage.colonne}`).toUpperCase(), MARGE, y);

  // Legende (alignee a droite)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  let xLegende = LARGEUR_PAGE - MARGE;
  for (const t of [...TYPES_ORDONNES].reverse()) {
    const nom = TYPES_CAMPAGNE[t].court;
    xLegende -= doc.getTextWidth(nom);
    doc.setTextColor(...ENCRE_DOUCE);
    doc.text(nom, xLegende, y);
    xLegende -= 4;
    doc.setFillColor(...couleurs[t]);
    doc.rect(xLegende, y - 2.6, 3, 3, 'F');
    xLegende -= 5;
  }
  y += 4;

  const hauteurGraphique = 52;
  const gauche = MARGE + 9;
  const largeurGraphique = LARGEUR_UTILE - 9;
  const bas = y + hauteurGraphique;
  const maxValeur = Math.max(0, ...sousComptes.map((s) => s.total));
  const ticks = graduations(maxValeur);
  const maxAxe = ticks[ticks.length - 1] ?? 1;

  doc.setDrawColor(...TRAIT);
  doc.setLineWidth(0.15);
  doc.setFontSize(7);
  doc.setTextColor(...ENCRE_DOUCE);
  for (const v of ticks) {
    const yy = bas - (v / maxAxe) * hauteurGraphique;
    doc.line(gauche, yy, gauche + largeurGraphique, yy);
    doc.text(nombre(v), gauche - 1.5, yy + 1, { align: 'right' });
  }

  const n = sousComptes.length;
  const pas = largeurGraphique / n;
  const largeurBarre = Math.min(pas * 0.7, 12);
  const cadence = n > 24 ? 3 : n > 12 ? 2 : 1;
  sousComptes.forEach((s, i) => {
    const x = gauche + i * pas + (pas - largeurBarre) / 2;
    let sommet = bas;
    for (const t of TYPES_ORDONNES) {
      const h = (s.comptes[t] / maxAxe) * hauteurGraphique;
      if (h <= 0) continue;
      doc.setFillColor(...couleurs[t]);
      doc.rect(x, sommet - h, largeurBarre, h, 'F');
      sommet -= h;
    }
    if (i % cadence === 0) {
      doc.setFontSize(n > 12 ? 6 : 7);
      doc.setTextColor(...ENCRE_DOUCE);
      doc.text(texte(s.libelle), x + largeurBarre / 2, bas + 4, { align: 'center' });
    }
  });
  doc.setDrawColor(...ENCRE_DOUCE);
  doc.setLineWidth(0.3);
  doc.line(gauche, bas, gauche + largeurGraphique, bas);
  y = bas + 11;

  /* --- Detail par sous-periode ---------------------------------------- */
  y = titreSection(doc, y, `Détail par ${plage.colonne}`) + 2;
  const colonnesType: Colonne[] = TYPES_ORDONNES.map((t) => ({ titre: TYPES_CAMPAGNE[t].court, largeur: 22, droite: true }));
  y = tableau(
    doc,
    y,
    [{ titre: plage.colonne }, ...colonnesType, { titre: 'Total', largeur: 24, droite: true }],
    sousComptes.map((s) => [s.libelle, ...TYPES_ORDONNES.map((t) => nombre(s.comptes[t])), nombre(s.total)]),
    ['Total', ...TYPES_ORDONNES.map((t) => nombre(total.comptes[t])), nombre(totalComptes(total.comptes))],
  );

  /* --- Par operateur --------------------------------------------------- */
  y = titreSection(doc, y + 9, 'Éléments par opérateur') + 2;
  if (operateurs.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...ENCRE_DOUCE);
    doc.text('Aucune campagne créée sur cette période.', MARGE, y + 3);
    y += 6;
  } else {
    y = tableau(
      doc,
      y,
      [
        { titre: 'Opérateur' },
        { titre: 'Campagnes', largeur: 30, droite: true },
        { titre: 'Éléments', largeur: 30, droite: true },
        { titre: 'Part', largeur: 24, droite: true },
      ],
      operateurs.map((o) => [
        o.nom,
        nombre(o.nbCampagnes),
        nombre(o.elements),
        total.total ? `${Math.round((o.elements / total.total) * 100)} %` : '-',
      ]),
    );
  }

  /* --- Liste des campagnes --------------------------------------------- */
  if (dansPlage.length > 0) {
    y = titreSection(doc, y + 9, 'Campagnes de la période') + 2;
    const visibles = dansPlage.slice(0, NB_CAMPAGNES_MAX);
    y = tableau(
      doc,
      y,
      [
        { titre: 'Date', largeur: 24 },
        { titre: 'Campagne' },
        { titre: 'Type', largeur: 22 },
        { titre: 'Éléments', largeur: 20, droite: true },
        { titre: 'Statut', largeur: 24 },
        { titre: 'Opérateur', largeur: 32 },
      ],
      visibles.map((c) => [
        dateCourte(dateCampagne(c)),
        c.nom,
        TYPES_CAMPAGNE[c.type].court,
        nombre(c.nbElements),
        LIBELLE_STATUT[c.statut],
        c.creeParNom,
      ]),
    );
    if (dansPlage.length > visibles.length) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(...ENCRE_DOUCE);
      doc.text(`+ ${dansPlage.length - visibles.length} autres campagnes non listées.`, MARGE, Math.min(y + 5, BAS_UTILE + 4));
    }
  }

  /* --- Pied de page sur chaque page ----------------------------------- */
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...TRAIT);
    doc.setLineWidth(0.2);
    doc.line(MARGE, HAUTEUR_PAGE - 11, LARGEUR_PAGE - MARGE, HAUTEUR_PAGE - 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...ENCRE_DOUCE);
    doc.text(texte(`${d.nomApplication} - ${plage.libelle}`), MARGE, HAUTEUR_PAGE - 6.5);
    doc.text(`Page ${p} / ${pages}`, LARGEUR_PAGE - MARGE, HAUTEUR_PAGE - 6.5, { align: 'right' });
  }

  return doc;
}

/** Construit le rapport et le telecharge. Renvoie le nom du fichier. */
export async function genererRapportPdf(d: DonneesRapport): Promise<string> {
  const doc = await construireRapport(d);
  const fichier = nomFichier(d.plage);
  doc.save(fichier);
  return fichier;
}
