/**
 * Detection des allergenes (14 groupes reglementaires)
 * Reprise de la macro VBA SetShapeTextWithAllergens et de l'ancienne
 * application : un mot est un allergene s'il est egal a un terme de la liste
 * ou commence par lui (« OEUFS », « LAITIER »…).
 *
 * Les termes composes (ex. « CREME FRAICHE ») sont geres par
 * marquerAllergenesFr() : tous les mots du terme sont marques.
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

/** Termes composes (contenant un espace), decoupes en mots normalises. */
const TERMES_COMPOSES_FR: readonly (readonly string[])[] = ALLERGENES_FR
  .filter((a) => a.includes(' '))
  .map((a) => a.split(' ').filter(Boolean));

/** Majuscules, sans accents ni ponctuation (Œ conserve). */
export function normaliserMot(mot: string): string {
  return mot
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-ZŒ]/g, '');
}

/** Test d'un mot isole (les termes composes ne peuvent pas matcher ici). */
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

/**
 * Pour une liste de mots (deja decoupes), renvoie un tableau de booleens :
 * true si le mot doit etre affiche en rouge.
 * Gere les termes composes (« CREME FRAICHE » → les 2 mots sont marques).
 */
export function marquerAllergenesFr(mots: readonly string[]): boolean[] {
  const normalises = mots.map(normaliserMot);
  const flags: boolean[] = new Array(mots.length).fill(false);

  for (let i = 0; i < mots.length; i++) {
    // 1) termes composes : on regarde les mots suivants
    for (const terme of TERMES_COMPOSES_FR) {
      if (i + terme.length > mots.length) continue;
      const ok = terme.every((t, k) => {
        const w = normalises[i + k];
        return w === t || w.startsWith(t);
      });
      if (ok) {
        for (let k = 0; k < terme.length; k++) flags[i + k] = true;
      }
    }

    // 2) mot simple (comportement existant)
    if (!flags[i] && estAllergeneFr(mots[i])) flags[i] = true;
  }
  return flags;
}

/** Liste des allergenes trouves dans une liste d'ingredients (pour affichage). */
export function detecterAllergenes(ingredients: string): string[] {
  const mots = ingredients.split(/[\s,;.()/]+/).filter(Boolean);
  const flags = marquerAllergenesFr(mots);
  const trouves: string[] = [];
  mots.forEach((mot, i) => {
    const n = normaliserMot(mot);
    if (flags[i] && n && !trouves.includes(n)) trouves.push(n);
  });
  return trouves;
}
