/**
 * Détection des allergènes (14 groupes réglementaires), FR + AR.
 * Un mot est un allergène s'il correspond à un terme de la liste (exact ou
 * préfixe selon le terme), sauf exceptions connues (laitue, noix de coco…).
 * Les expressions de plusieurs mots (crème fraîche, قشدة طازجة) sont gérées
 * par une seconde passe dans segmenterAllergenes.
 */

interface Groupe {
  nom: string;          // libellé affiché
  exacts?: string[];    // mot entier (pluriel S/X toléré)
  prefixes?: string[];  // le mot commence par…
  exclus?: string[];    // préfixes de faux positifs
}

const GROUPES_FR: readonly Groupe[] = [
  { nom: 'GLUTEN', exacts: ['BLE', 'ORGE', 'AVOINE', 'SEIGLE', 'EPEAUTRE', 'KAMUT', 'FROMENT'], prefixes: ['GLUTEN', 'CHAPELURE'] },
  { nom: 'CRUSTACÉS', prefixes: ['CRUSTACE', 'CREVETTE', 'CRABE', 'HOMARD', 'LANGOUSTE', 'LANGOUSTINE', 'ECREVISSE'], exacts: ['GAMBAS'] },
  { nom: 'POISSON', prefixes: ['POISSON', 'SAUMON', 'THON', 'TRUITE', 'ANCHOIS', 'SARDINE', 'CABILLAUD', 'MAQUEREAU', 'MORUE', 'SURIMI'], exclus: ['POISSONNER'] },
  { nom: 'ŒUFS', prefixes: ['OEUF'] },
  { nom: 'LAIT', prefixes: ['LAIT', 'FROMAGE', 'BEURRE', 'CREME', 'YAOURT', 'LACTOSE', 'CASEINE'], exclus: ['LAITUE', 'LAITERON'] },
  { nom: 'ARACHIDES', prefixes: ['ARACHIDE', 'CACAHUETE'] },
  { nom: 'SOJA', prefixes: ['SOJA'] },
  { nom: 'FRUITS À COQUE', prefixes: ['AMANDE', 'NOIX', 'NOISETTE', 'CAJOU', 'PISTACHE', 'PECAN', 'MACADAMIA'] },
  { nom: 'CÉLERI', prefixes: ['CELERI'] },
  { nom: 'MOUTARDE', prefixes: ['MOUTARDE'] },
  { nom: 'SÉSAME', prefixes: ['SESAME'] },
  { nom: 'SULFITES', prefixes: ['SULFITE'] },
  { nom: 'LUPIN', prefixes: ['LUPIN'] },
  { nom: 'MOLLUSQUES', prefixes: ['MOLLUSQUE', 'CALAMAR', 'POULPE', 'SEICHE', 'ESCARGOT'], exacts: ['MOULE', 'HUITRE'] },
];

/** Termes arabes (avant normalisation). Mots simples uniquement. */
const GROUPES_AR_BRUT: readonly { nom: string; termes: string[] }[] = [
  { nom: 'GLUTEN', termes: ['الغلوتين', 'غلوتين', 'قمح', 'شعير', 'شوفان', 'جاودار', 'شابلور'] },
  { nom: 'CRUSTACÉS', termes: ['قشريات', 'جمبري', 'روبيان', 'كراب', 'سلطعون', 'كركند'] },
  { nom: 'POISSON', termes: ['سمك', 'سلمون', 'تونة', 'تونا', 'أنشوجة', 'سردين'] },
  { nom: 'ŒUFS', termes: ['بيض'] },
  { nom: 'LAIT', termes: ['حليب', 'لبن', 'جبن', 'قشدة', 'كريمة', 'زبدة', 'لاكتوز', 'زبادي'] },
  { nom: 'ARACHIDES', termes: ['سوداني'] },
  { nom: 'SOJA', termes: ['صويا', 'صوجا', 'سويا'] },
  { nom: 'FRUITS À COQUE', termes: ['مكسرات', 'لوز', 'جوز', 'بندق', 'كاجو', 'فستق', 'بيكان'] },
  { nom: 'CÉLERI', termes: ['كرفس'] },
  { nom: 'MOUTARDE', termes: ['خردل'] },
  { nom: 'SÉSAME', termes: ['سمسم', 'طحينة', 'طحينية'] },
  { nom: 'SULFITES', termes: ['كبريتيت', 'سلفيت'] },
  { nom: 'LUPIN', termes: ['ترمس'] },
  { nom: 'MOLLUSQUES', termes: ['رخويات', 'حبار', 'أخطبوط', 'محار'] },
];

/**
 * Expressions : si le 1er mot est détecté comme allergène, le 2e mot (juste
 * après, séparé par des espaces) est marqué avec le même groupe.
 */
const SUITES_FR: readonly { debut: string; suite: string }[] = [
  { debut: 'CREME', suite: 'FRAICH' }, // crème fraîche(s)
];
const SUITES_AR: readonly { debut: string; suites: string[] }[] = [
  { debut: 'قشدة', suites: ['طازجة', 'طرية'] }, // قشدة طازجة / قشدة طرية
];

/* ------------------------------ Normalisation ----------------------------- */

/** FR : majuscules, sans accents ni ponctuation, Œ → OE. */
export function normaliserMot(mot: string): string {
  return mot
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/Œ/g, 'OE')
    .replace(/Æ/g, 'AE')
    .replace(/[^A-Z]/g, '');
}

/** AR : sans voyelles brèves, sans tatwil, alef/ya/ta marbouta unifiés. */
export function normaliserAr(mot: string): string {
  return mot
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim();
}

const GROUPES_AR = GROUPES_AR_BRUT.map((g) => ({
  nom: g.nom,
  termes: g.termes.map(normaliserAr),
}));

const SUITES_AR_NORM = SUITES_AR.map((e) => ({
  debut: normaliserAr(e.debut),
  suites: e.suites.map(normaliserAr),
}));

/** Listes « à plat » (compatibilité), expressions comprises. */
export const ALLERGENES_FR: readonly string[] = [
  ...GROUPES_FR.flatMap((g) => [...(g.exacts ?? []), ...(g.prefixes ?? [])]),
  'CREME FRAICHE',
];
export const ALLERGENES_AR: readonly string[] = [
  ...GROUPES_AR_BRUT.flatMap((g) => g.termes),
  'قشدة طازجة',
  'قشدة طرية',
];

/* -------------------------------- Détection ------------------------------- */

const RE_ARABE = /[\u0600-\u06FF]/;
const SUFFIXES_AR = ['', 'ه', 'ات', 'ين', 'ون', 'يه', 'ي', 'ها'];

function groupeFr(w: string): string | null {
  if (w.length < 3) return null;
  for (const g of GROUPES_FR) {
    if (g.exclus?.some((x) => w.startsWith(x))) continue;
    if (g.exacts?.some((t) => w === t || w === t + 'S' || w === t + 'X')) return g.nom;
    if (g.prefixes?.some((t) => w.startsWith(t))) return g.nom;
  }
  return null;
}

function groupeAr(w: string): string | null {
  if (w.length < 2) return null;
  // Variantes sans préfixe collé (و، ف، ب، ل، ك) et sans article « ال »
  const candidats = [w];
  if (/^[وفبلك]/.test(w)) candidats.push(w.slice(1));
  for (const c of [...candidats]) if (c.startsWith('ال')) candidats.push(c.slice(2));

  for (const g of GROUPES_AR) {
    for (const t of g.termes) {
      for (const c of candidats) {
        if (c.startsWith(t) && SUFFIXES_AR.includes(c.slice(t.length))) return g.nom;
      }
    }
  }
  return null;
}

export function estAllergeneFr(mot: string): boolean {
  return groupeFr(normaliserMot(mot)) !== null;
}

export function estAllergeneAr(mot: string): boolean {
  return groupeAr(normaliserAr(mot)) !== null;
}

/** Groupe d'allergène du mot n°k, en tenant compte des mots qui suivent. */
function groupeDuMot(mots: string[], k: number): string | null {
  const brut = mots[k];

  if (RE_ARABE.test(brut)) {
    const w = normaliserAr(brut);
    const g = groupeAr(w);
    if (g && w === 'جوز' && ['الهند', 'الطيب'].includes(normaliserAr(mots[k + 1] ?? ''))) {
      return null; // noix de coco / muscade
    }
    return g;
  }

  const w = normaliserMot(brut);
  const g = groupeFr(w);
  if (g && w === 'NOIX') {
    // « noix de coco », « noix de muscade », « noix de Saint-Jacques »
    let j = k + 1;
    while (['DE', 'DU', 'D', 'DES'].includes(normaliserMot(mots[j] ?? ''))) j++;
    const suivant = normaliserMot(mots[j] ?? '');
    if (suivant === 'COCO' || suivant === 'MUSCADE') return null;
    if (suivant === 'SAINT') return 'MOLLUSQUES';
  }
  return g;
}

/* --------------------------------- Affichage ------------------------------ */

export interface Segment {
  texte: string;
  allergene: string | null; // libellé du groupe, ou null si mot ordinaire
}

/**
 * Découpe un texte d'ingrédients en segments (mots + séparateurs) en
 * conservant EXACTEMENT le texte d'origine. À utiliser pour mettre les
 * allergènes en gras / majuscules à l'affichage.
 *
 * Exemple React :
 *   segmenterAllergenes(txt).map((s, i) =>
 *     s.allergene ? <strong key={i}>{s.texte.toUpperCase()}</strong> : s.texte)
 */
export function segmenterAllergenes(texte: string): Segment[] {
  // Les indices impairs sont les mots (lettres/accents, FR ou AR),
  // tout le reste (espaces, ponctuation, apostrophes, chiffres…) sépare.
  const parts = texte.split(/([\p{L}\p{M}]+)/u);
  const mots = parts.filter((_, i) => i % 2 === 1);
  const segments: Segment[] = [];
  let k = 0;
  parts.forEach((p, i) => {
    if (i % 2 === 0) {
      if (p) segments.push({ texte: p, allergene: null });
    } else {
      segments.push({ texte: p, allergene: groupeDuMot(mots, k++) });
    }
  });

  // Seconde passe : expressions de plusieurs mots (crème fraîche, قشدة طازجة…)
  for (let i = 0; i < segments.length - 2; i++) {
    const a = segments[i];
    const sep = segments[i + 1];
    const b = segments[i + 2];
    if (!a.allergene || b.allergene || !/^\s+$/.test(sep.texte)) continue;

    if (RE_ARABE.test(a.texte)) {
      const d = normaliserAr(a.texte);
      const s = normaliserAr(b.texte);
      if (SUITES_AR_NORM.some((e) => d.includes(e.debut) && e.suites.includes(s))) {
        b.allergene = a.allergene;
      }
    } else {
      const d = normaliserMot(a.texte);
      const s = normaliserMot(b.texte);
      if (SUITES_FR.some((e) => d.startsWith(e.debut) && s.startsWith(e.suite))) {
        b.allergene = a.allergene;
      }
    }
  }
  return segments;
}

/** Liste des groupes d'allergènes trouvés (sans doublons) pour affichage. */
export function detecterAllergenes(ingredients: string): string[] {
  const trouves: string[] = [];
  for (const s of segmenterAllergenes(ingredients)) {
    if (s.allergene && !trouves.includes(s.allergene)) trouves.push(s.allergene);
  }
  return trouves;
}
