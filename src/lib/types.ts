/**
 * Modele de donnees partage (Firestore <-> ecrans <-> moteurs de rendu)
 */

import type { FormatAffiche, TypeCampagne } from '../config/constants';

/* -------------------------------------------------------------------------- */
/* Catalogue                                                                   */
/* -------------------------------------------------------------------------- */

/** Article du catalogue — identifiant du document = code article (EAN / code interne). */
export interface Article {
  readonly code: string;
  readonly designationFr: string;
  readonly designationAr: string;
  readonly ingredientsFr: string;
  readonly ingredientsAr: string;
  /** Pays d'origine en toutes lettres (drapeau sur l'etiquette A7). */
  readonly origine: string;
  /** Colonne J de l'ancien classeur (information libre). */
  readonly colJ: string;
  /** Gabarit A7 impose (ancienne colonne H) — prioritaire sur le mapping des prefixes. */
  readonly gabaritA7: string;
  readonly majLe?: Date | null;
  readonly majPar?: string;
}

export type ArticleSaisi = Omit<Article, 'majLe' | 'majPar'>;

export const ARTICLE_VIDE: ArticleSaisi = {
  code: '',
  designationFr: '',
  designationAr: '',
  ingredientsFr: '',
  ingredientsAr: '',
  origine: '',
  colJ: '',
  gabaritA7: '',
};

/* -------------------------------------------------------------------------- */
/* Gabarits                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Mise en page A7 — coordonnees en fraction du canevas (0..1) et tailles de
 * police en pixels du canevas de reference 222 × 315 (3 px/mm).
 * Valeurs par defaut extraites du modele PowerPoint (voir rendu/a7-layout.ts).
 */
export interface LayoutA7 {
  yDesFR?: number;
  yDesAR?: number;
  fzDesFR?: number;
  fzDesAR?: number;
  priceY?: number;
  priceX?: number | null;
  uniteX?: number;
  uniteY?: number;
  fzUnite?: number;
  ingY?: number;
  ingBoxW?: number;
  ingBoxH?: number;
  ingBoxX?: number;
  ingArY?: number;
  ingArBoxH?: number;
  fzIngFR?: number;
  fzIngAR?: number;
  fzPrixInt?: number;
  fzPrixDec?: number;
  allergyY?: number;
  fidX?: number;
  fidY?: number;
  fidW?: number;
  fidH?: number;
  fzFidInt?: number;
  fzFidDec?: number;
  fidLabelArabicY?: number;
  fidRbhY?: number;
  drapX?: number;
  drapY?: number;
  drapW?: number;
  drapH?: number;
  fzDrapLabel?: number;
  fzDrapName?: number;
  colDrapText?: string;
  /** Couleurs propres au gabarit (sinon couleurs globales). */
  colDes?: string;
  colPrix?: string;
  colUnite?: string;
  colIngFr?: string;
  colIngAr?: string;
  colAllergen?: string;
}

export interface GabaritA7 {
  /** Code du gabarit : PAT, BOUL, FROM… */
  readonly id: string;
  readonly nom: string;
  /** Image de fond (data URL JPEG compressee) ou null (fond dessine). */
  readonly image: string | null;
  readonly layout: LayoutA7;
  readonly ordre: number;
}

/** Element positionnable d'une affiche (fractions du canevas 420 × 594). */
export interface ElementAffiche {
  x: number;
  y: number;
  fs?: number;
  color?: string;
  /** Rapport taille decimales / entier (prix). */
  decScale?: number;
  /** Picto : largeur en fraction. */
  w?: number;
  h?: number;
  /** Rectangle economie. */
  diffRectX?: number;
  diffRectY?: number;
  diffRectW?: number;
  diffRectH?: number;
  bgColor?: string;
}

export type CleElementAffiche = 'desFR' | 'desAR' | 'prixBarre' | 'prixPromo' | 'diff' | 'fidelite' | 'gencode' | 'picto';

export interface GabaritAffiche {
  readonly id: string;
  readonly nom: string;
  readonly bg: string;
  readonly bg2: string;
  readonly image: string | null;
  /** Style « Marjane » : bandeau d en-tete jaune / bleu (fond sans image). */
  readonly logo: boolean;
  readonly els: Partial<Record<CleElementAffiche, ElementAffiche>>;
  readonly ordre: number;
}

export interface AxeBalisage {
  x: number;
  y: number;
  w: number;
  h: number;
  fs: number;
}

export type CleAxeBalisage = 'desFR' | 'desAR' | 'ingFR' | 'ingAR';

export interface GabaritBalisage {
  readonly id: string;
  readonly nom: string;
  readonly image: string | null;
  readonly axes: Partial<Record<CleAxeBalisage, Partial<AxeBalisage>>>;
  /** Libelle du bandeau droit quand aucun fond n'est fourni. */
  readonly libelleDroit: string;
  readonly ordre: number;
}

export interface Picto {
  readonly id: string;
  readonly nom: string;
  readonly image: string;
}

/* -------------------------------------------------------------------------- */
/* Parametres                                                                  */
/* -------------------------------------------------------------------------- */

export interface RegleMapping {
  prefixe: string;
  gabarit: string;
  libelle: string;
}

export interface CouleursA7 {
  designation: string;
  designationNoBg: string;
  prix: string;
  prixNoBg: string;
  unite: string;
  uniteNoBg: string;
  ingredientsFr: string;
  ingredientsFrNoBg: string;
  ingredientsAr: string;
  ingredientsArNoBg: string;
  allergen: string;
}

export interface CouleursBalisage {
  desFR: string;
  desAR: string;
  ingFR: string;
  ingAR: string;
}

export interface Parametres {
  mapping: RegleMapping[];
  couleursA7: CouleursA7;
  couleursBalisage: CouleursBalisage;
  /** Economie affichee en Food si ecart >= X DH. */
  seuilEconomieFoodDh: number;
  /** Economie affichee en Non Food si ecart >= X % du prix barre. */
  seuilEconomieNonFoodPct: number;
  /** Texte en tete des affiches sans image de fond. */
  enteteAffiche: string;
  signatureActive: boolean;
  signatureTexte: string;
  /** Pied de page des PDF A7. */
  piedDePage: boolean;
}

/* -------------------------------------------------------------------------- */
/* Campagnes et elements                                                       */
/* -------------------------------------------------------------------------- */

export interface Campagne {
  readonly id: string;
  readonly nom: string;
  readonly type: TypeCampagne;
  /** Format d'impression pour les affiches. */
  readonly format: FormatAffiche;
  readonly statut: 'brouillon' | 'imprimee' | 'archivee';
  readonly nbElements: number;
  readonly creeLe: Date | null;
  readonly creePar: string;
  readonly creeParNom: string;
  readonly majLe: Date | null;
}

interface ElementBase {
  readonly id: string;
  readonly ordre: number;
  readonly code: string;
}

export interface ElementA7 extends ElementBase {
  readonly designationFr: string;
  readonly designationAr: string;
  /** Prix au format « 12,50 ». */
  readonly prix: string;
  readonly unite: string;
  readonly gabarit: string;
  readonly grammage: string;
  /** Pourcentage fidelite (« 10 »). */
  readonly fidelite: string;
  readonly ingredientsFr: string;
  readonly ingredientsAr: string;
  readonly origine: string;
}

export interface ElementAfficheSaisi extends ElementBase {
  readonly desFR: string;
  readonly desAR: string;
  readonly barre: number;
  readonly promo: number;
  readonly fidelite: number;
  readonly secteur: 'food' | 'nonfood';
  /** Identifiant du picto (ou ''). */
  readonly picto: string;
  readonly gabarit: string;
}

export interface ElementBalisage extends ElementBase {
  readonly gabarit: string;
  readonly desFR: string;
  readonly desAR: string;
  readonly ingFR: string;
  readonly ingAR: string;
}

export type Element = ElementA7 | ElementAfficheSaisi | ElementBalisage;

/** Donnees d'un element sans identifiant ni ordre (saisie en cours). */
export type Saisie<T extends ElementBase> = Omit<T, 'id' | 'ordre'>;

/** Un element quelconque en cours de saisie (union distribuee). */
export type SaisieElement = Saisie<ElementA7> | Saisie<ElementAfficheSaisi> | Saisie<ElementBalisage>;
