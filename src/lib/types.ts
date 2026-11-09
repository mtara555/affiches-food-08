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
  /**
   * Ingredients en francais (defaut : oui). Faux = arabe seul : un seul cadre, avec le titre
   * « المكونات : (المواد المسببة للحساسية تحمل اللون الأحمر) » en tete.
   */
  ingFr?: boolean;
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
  /**
   * Designations FR / AR : centre horizontal (fraction de la largeur). Absent = centre de la page.
   * Permet d'aligner le texte sur un cadre decentre du fond.
   */
  cx?: number;
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

/**
 * Langue detectee d'une designation (voir detecterLangueDesignation) :
 * 'ar' = au moins un caractere arabe, 'fr' = latin / chiffres / ponctuation,
 * 'mixte' = arabe ET lettres latines, 'vide' = rien apres trim.
 */
export type LangueDesignation = 'ar' | 'fr' | 'mixte' | 'vide';

/**
 * Organigramme de la zone economie (optionnel, retro-compatible) : forme rouge en biais
 * (« Organigramme1 » du depot AFFICHES-EM-supabase) portant le montant economise et « وفر ».
 * x, y, w, h sont en millimetres sur l'A4 de reference (210 × 297) ;
 * le rendu les convertit pour A3 / A5 (homothetiques).
 */
export interface OrganigrammeAffiche {
  /** Image importee qui REMPLACE la forme rouge (data URL), ou null. */
  image: string | null;
  /** Couleur de la forme (defaut #FF0000). */
  couleur?: string;
  /** Pente du bord haut : fraction de h dont le coin haut-gauche est descendu (defaut 0,2). */
  pente?: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Panneau fidelite (optionnel, retro-compatible) : quand un pourcentage de fidelite est saisi,
 * le bloc des prix devient « prix a gauche (bleu) + gain a droite (rose) » avec la carte de fidelite.
 * Toutes les positions sont des fractions de la page (largeur W, hauteur H) ; absent = defaut.
 */
export interface PanneauFidelite {
  actif: boolean;
  /** Image de la carte (data URL) ; null = carte fournie avec l'application. */
  carte?: string | null;
  couleurRose?: string;
  /** Couleur des libelles « ربح / على بطاقتكم » et de la rature du prix barre. */
  couleurTexte?: string;
  /** Couleur du montant du gain. */
  couleurGain?: string;
  /** Couleur des prix (barre et promo) sur la zone bleue. */
  couleurPrix?: string;
  /** Couleur de la rature du prix barre. */
  couleurRature?: string;
  /** Bloc complet (bleu + rose). */
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  /** Part de la largeur du bloc occupee par la zone bleue (0,3 a 0,8). */
  coupure?: number;
  /** Carte : centre (x, y en fractions de W et H), taille (fractions de W), angle en degres. */
  carteX?: number;
  carteY?: number;
  carteW?: number;
  carteH?: number;
  carteAngle?: number;
  /** Taille des libelles arabes (px, repere 420 x 594). */
  fsLibelle?: number;
}

export interface GabaritAffiche {
  readonly id: string;
  readonly nom: string;
  readonly bg: string;
  readonly bg2: string;
  readonly image: string | null;
  /** Style « Marjane » : bandeau d en-tete jaune / bleu (fond sans image). */
  readonly logo: boolean;
  readonly els: Partial<Record<CleElementAffiche, ElementAffiche>>;
  /** Organigramme de la zone economie ; absent sur les anciens gabarits (= aucun). */
  readonly organigramme?: OrganigrammeAffiche;
  /** Panneau fidelite ; absent sur les anciens gabarits (= desactive). */
  readonly fidelite?: PanneauFidelite;
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
  /** Coefficient de largeur (0,3 a 2,5 ; absent = 1) applique a la largeur definie par le gabarit d'affiche. */
  readonly taille?: number;
  /**
   * Coefficient de hauteur (meme echelle que `taille`). Absent = suit `taille`
   * (proportions conservees, comportement d'origine). Present = hauteur independante.
   */
  readonly hauteur?: number;
  /** Retire le fond blanc a l'affichage (l'image d'origine n'est pas modifiee). */
  readonly sansFond?: boolean;
  /** Tolerance du detourage (0 a 60 ; absent = valeur par defaut). */
  readonly tolerance?: number;
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
  /** Campagnes « Vrac » : dimensions de l'affiche (mm) et presence des ingredients. */
  readonly largeurMm: number;
  readonly hauteurMm: number;
  readonly avecIngredients: boolean;
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
