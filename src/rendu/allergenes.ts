/**
 * Detection des allergenes (14 groupes reglementaires)
 * Reprise de la macro VBA SetShapeTextWithAllergens et de l'ancienne
 * application : un mot est un allergene s'il est egal a un terme de la liste
 * ou commence par lui (« OEUFS », « LAITIER »…).
 */

const GROUPES_FR: readonly (readonly string[])[] = [
  ['GLUTEN', 'BLE', 'ORGE', 'AVOINE', 'SEIGLE', 'EPEAUTRE', 'KAMUT', 'CHAPELURE'],
  ['CRUSTACE', 'CREVETTE', 'CRABE', 'HOMARD', 'LANGOUSTE'],
  ['POISSON', 'SAUMON', 'THON', 'TRUITE'],
  ['ŒUF', 'OEUF'],
  ['LAIT', 'FROMAGE', 'BEURRE', 'CREME FRAICHE', 'CREME'],
  ['ARACHIDE', 'CACAHUETE'],
  ['SOJA'],
  ['AMANDE', 'NOIX', 'NOISETTE', 'CAJOU', 'PISTACHE', 'PECAN', 'MACADAMIA'],
  ['CELERI'],
  ['MOUTARDE'],
  ['SESAME'],
  ['SULFITE'],
  ['LUPIN'],
  ['MOLLUSQUE'],
];

/** Liste « a plat », en majuscules sans accents. */
export const ALLERGENES_FR: readonly string[] = GROUPES_FR.flat();

export const ALLERGENES_AR: readonly string[] = [
  'الغلوتين', 'قمح', 'شعير', 'شوفان', 'جاودار', 'شابلور',
  'قشريات', 'جمبري', 'كراب', 'سلطعون',
  'سمك', 'سلمون', 'تونة', 'تونا', 'أنشوجة',
  'بيض', 'بيضة',
  'حليب', 'لبن', 'جبن', 'جبنة', 'كريمة', 'قشدة طازجة', 'قشدة ', 'زبدة', 'لاكتوز',
  'فول سوداني', 'فستق سوداني',
  'صويا', 'صوجا', 'فول الصويا', 'سويا',
  'مكسرات', 'لوز', 'جوز', 'بندق', 'كاجو', 'فستق', 'زيت نباتي',
  'كرفس', 'خردل', 'سمسم', 'طحينة', 'طحينية',
  'كبريتيت', 'سلفيت', 'ترمس', 'لوبيا',
  'رخويات', 'حبار', 'أخطبوط', 'محار',
];

/** Majuscules, sans accents ni ponctuation (Œ conserve). */
export function normaliserMot(mot: string): string {
  return mot
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-ZŒ]/g, '');
}

export function estAllergeneFr(mot: string): boolean {
  const w = normaliserMot(mot);
  if (w.length < 3) return false;
  return ALLERGENES_FR.some((a) => w === a || w.startsWith(a));
}

export function estAllergeneAr(mot: string): boolean {
  const w = mot.trim();
  if (w.length < 2) return false;

  return ALLERGENES_AR.some((a) =>
    w === a || w.includes(a) || a.includes(w)
  );
}

/** Liste des allergenes trouves dans une liste d'ingredients (pour affichage). */
export function detecterAllergenes(ingredients: string): string[] {
  const trouves: string[] = [];
  for (const mot of ingredients.split(/[\s,;.()/]+/).filter(Boolean)) {
    const n = normaliserMot(mot);
    if (estAllergeneFr(mot) && !trouves.includes(n)) trouves.push(n);
  }
  return trouves;
}
