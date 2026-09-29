/**
 * AFFICHES FOOD & NON FOOD — Constantes de l'application
 *
 * Valeurs structurantes du projet. Les reglages modifiables (mapping des
 * prefixes, seuils d'economie, couleurs, signature) ont ici leur valeur par
 * defaut ; ils sont lus depuis Firestore (collection `parametres`) et
 * modifiables par un administrateur.
 */

export const APP_NAME = 'AFFICHES FOOD';
export const APP_VERSION = '3.2.0';
export const APP_FULL_NAME = `${APP_NAME} v${APP_VERSION}`;
export const MAGASIN = 'Marjane Tanger Medina 08';

/**
 * Domaine ajoute aux identifiants saisis sans « @ ».
 * Firebase exige une adresse e-mail : « karim » devient « karim@marjane08.local ».
 * Aucun e-mail n'est jamais envoye a ces adresses.
 */
export const DOMAINE_IDENTIFIANT = 'marjane08.local';

/* -------------------------------------------------------------------------- */
/* Types de campagne                                                           */
/* -------------------------------------------------------------------------- */

export type TypeCampagne = 'A7' | 'AFFICHE' | 'BALISAGE';

export interface DefinitionType {
  readonly code: TypeCampagne;
  readonly libelle: string;
  readonly court: string;
  readonly description: string;
  readonly couleur: string;
}

export const TYPES_CAMPAGNE: Readonly<Record<TypeCampagne, DefinitionType>> = {
  A7: {
    code: 'A7',
    libelle: 'Etiquettes A7 (Food)',
    court: 'A7',
    description: 'Etiquettes prix 74 × 105 mm bilingues, ingredients et allergenes — 4 par feuille A4.',
    couleur: '#b45309',
  },
  AFFICHE: {
    code: 'AFFICHE',
    libelle: 'Affiches promo A3 / A4 / A5',
    court: 'Affiche',
    description: 'Affiches prix barre / prix promo, economie « وفر », fidelite, pictos et code-barres.',
    couleur: '#152b7a',
  },
  BALISAGE: {
    code: 'BALISAGE',
    libelle: 'Balisage BOUL / PAT',
    court: 'Balisage',
    description: 'Bandeaux 150 × 40 mm boulangerie / patisserie avec ingredients — 7 par feuille A4.',
    couleur: '#5c2d0a',
  },
} as const;

export const TYPES_ORDONNES: readonly TypeCampagne[] = ['A7', 'AFFICHE', 'BALISAGE'];

/* -------------------------------------------------------------------------- */
/* Formats d'affiche (homothetiques : A3 et A5 = A4 agrandie / reduite)         */
/* -------------------------------------------------------------------------- */

export type FormatAffiche = 'A3' | 'A4' | 'A5';

export interface DefinitionFormat {
  readonly code: FormatAffiche;
  readonly largeurMm: number;
  readonly hauteurMm: number;
  readonly libelle: string;
  /** Page PDF utilisee a l'impression. */
  readonly page: 'a3' | 'a4';
  readonly parPage: number;
}

export const FORMATS: Readonly<Record<FormatAffiche, DefinitionFormat>> = {
  A3: { code: 'A3', largeurMm: 297, hauteurMm: 420, libelle: 'A3 — 297 × 420 mm', page: 'a3', parPage: 1 },
  A4: { code: 'A4', largeurMm: 210, hauteurMm: 297, libelle: 'A4 — 210 × 297 mm', page: 'a4', parPage: 1 },
  A5: { code: 'A5', largeurMm: 148, hauteurMm: 210, libelle: 'A5 — 148 × 210 mm (2 par A4)', page: 'a4', parPage: 2 },
};

export const FORMATS_ORDONNES: readonly FormatAffiche[] = ['A3', 'A4', 'A5'];

/* -------------------------------------------------------------------------- */
/* Etiquettes A7                                                               */
/* -------------------------------------------------------------------------- */

export const UNITES: readonly string[] = ['pièce', 'kg', '100g', 'L', 'pack', 'barquette', 'tranche'];

/** Gabarits A7 extraits du modele PowerPoint A7_AVRIL2026. */
export const GABARITS_A7: readonly string[] = [
  'PAT',
  'PAT_M',
  'BOUL',
  'B_AGN',
  'B_FIL',
  'B_FIL_MN',
  'B_BCK',
  'B_VOL',
  'B_VOL-MN',
  'FROM',
  'TRAIT',
  'FROM_CAN',
  'GLACE',
];

/** Gabarits A7 avec zone fidelite (Rectangle 11) et prix au poids. */
export const GABARITS_A7_FIDELITE: readonly string[] = ['B_FIL', 'B_FIL_MN', 'FROM_CAN'];

/* -------------------------------------------------------------------------- */
/* Roles                                                                       */
/* -------------------------------------------------------------------------- */

export type Role = 'administrateur' | 'operateur' | 'aucun';

export const LIBELLE_ROLE: Readonly<Record<Role, string>> = {
  administrateur: 'Administrateur',
  operateur: 'Operateur',
  aucun: 'Aucun acces',
};

/* -------------------------------------------------------------------------- */
/* Formatage                                                                   */
/* -------------------------------------------------------------------------- */

export const LOCALE = 'fr-MA';
