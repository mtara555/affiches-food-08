/**
 * Drapeaux du pays d'origine (etiquettes A7)
 * Le pays est saisi en toutes lettres dans le catalogue (« France », « Maroc - Espagne »…).
 * Les images viennent de flagcdn.com et sont gardees en cache par le service worker.
 */

const PAYS: Readonly<Record<string, string>> = {
  maroc: 'ma', france: 'fr', espagne: 'es', italie: 'it', portugal: 'pt',
  belgique: 'be', 'pays-bas': 'nl', 'pays bas': 'nl', hollande: 'nl', allemagne: 'de',
  chine: 'cn', turquie: 'tr', egypte: 'eg', tunisie: 'tn', algerie: 'dz',
  mauritanie: 'mr', senegal: 'sn', 'cote d ivoire': 'ci', mali: 'ml',
  bresil: 'br', argentine: 'ar', 'etats-unis': 'us', 'etats unis': 'us', usa: 'us',
  inde: 'in', thailande: 'th', vietnam: 'vn', grece: 'gr', pologne: 'pl',
  ukraine: 'ua', russie: 'ru', 'royaume-uni': 'gb', 'royaume uni': 'gb', uk: 'gb',
  angleterre: 'gb', irlande: 'ie', suisse: 'ch', autriche: 'at',
  danemark: 'dk', suede: 'se', norvege: 'no', finlande: 'fi',
  canada: 'ca', mexique: 'mx', chili: 'cl', perou: 'pe', colombie: 'co',
  equateur: 'ec', australie: 'au', 'nouvelle-zelande': 'nz', 'nouvelle zelande': 'nz',
  japon: 'jp', 'coree du sud': 'kr', coree: 'kr', indonesie: 'id', malaisie: 'my',
  philippines: 'ph', 'arabie saoudite': 'sa', 'emirats arabes unis': 'ae', eau: 'ae',
  qatar: 'qa', jordanie: 'jo', liban: 'lb', iran: 'ir',
  pakistan: 'pk', bangladesh: 'bd', 'sri lanka': 'lk', roumanie: 'ro',
  bulgarie: 'bg', hongrie: 'hu', 'republique tcheque': 'cz', tchequie: 'cz',
  slovaquie: 'sk', croatie: 'hr', serbie: 'rs',
  'union europeenne': 'eu', ue: 'eu', 'union europeene': 'eu',
};

function normaliser(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Code ISO 3166-1 alpha-2 detecte dans une origine libre, ou null. */
export function codePays(origine: string | undefined): string | null {
  const n = normaliser(origine ?? '');
  if (!n) return null;
  if (PAYS[n]) return PAYS[n] ?? null;
  for (const partie of n.split(/,|\/| - | ou | et |&/).map((p) => p.trim()).filter(Boolean)) {
    if (PAYS[partie]) return PAYS[partie] ?? null;
  }
  for (const cle of Object.keys(PAYS)) {
    if (cle.length > 3 && n.includes(cle)) return PAYS[cle] ?? null;
  }
  return null;
}

export function urlDrapeau(code: string): string {
  return `https://flagcdn.com/w160/${code.toLowerCase()}.png`;
}
