/**
 * Code 39 (ID-39, ISO/IEC 16388) dessine nativement sur canevas.
 * Chaque caractere = 5 barres + 4 espaces (9 elements dont 3 larges),
 * separes par un espace etroit. Rapport large / etroit = 3.
 */

const MOTIFS: Readonly<Record<string, string>> = {
  '0': 'NNNWWNWNN', '1': 'WNNWNNNNW', '2': 'NNWWNNNNW', '3': 'WNWWNNNNN',
  '4': 'NNNWWNNNW', '5': 'WNNWWNNNN', '6': 'NNWWWNNNN', '7': 'NNNWNNWNW',
  '8': 'WNNWNNWNN', '9': 'NNWWNNWNN', A: 'WNNNNWNNW', B: 'NNWNNWNNW',
  C: 'WNWNNWNNN', D: 'NNNNNWWNW', E: 'WNNNNWWNN', F: 'NNWNNWWNN',
  G: 'NNNWNWWNW', H: 'WNNWNWNNN', I: 'NNWWNWNNN', J: 'NNNNNWWNN',
  K: 'WNNNNNNWW', L: 'NNWNNNNWW', M: 'WNWNNNNWN', N: 'NNNNNWNNW',
  O: 'WNNNNWNWN', P: 'NNWNNWNWN', Q: 'NNNWNWNNW', R: 'WNNWNWNNW',
  S: 'NNWWNWNNW', T: 'NNNWNWWNN', U: 'WWNNNNNNW', V: 'NWWNNNNNN',
  W: 'WWWNNNNNN', X: 'NWNNWNNNW', Y: 'WWNNWNNNN', Z: 'NWWNWNNNN',
  '-': 'NWNNNNWNW', '.': 'WWNNNNWNN', ' ': 'NWWNNNWNN', $: 'NWNWNWNNN',
  '/': 'NWNNNWNWN', '+': 'NNNWNWNWN', '%': 'NWNWNNNWN', '*': 'NWNNWNWNN',
};

const LARGE = 3;

export function nettoyerCode39(texte: string): string {
  return texte
    .toUpperCase()
    .split('')
    .filter((c) => c !== '*' && MOTIFS[c] !== undefined)
    .join('');
}

/** Largeur totale en unites etroites, start/stop compris. */
export function largeurCode39(propre: string): number {
  let unites = 0;
  for (const c of `*${propre}*`) {
    const m = MOTIFS[c];
    if (!m) continue;
    for (const b of m) unites += b === 'W' ? LARGE : 1;
    unites += 1;
  }
  return Math.max(1, unites - 1);
}

/**
 * Dessine le code centre sur (cx, cy).
 * @param unite largeur d'une barre etroite (repere courant)
 */
export function dessinerCode39(
  ctx: CanvasRenderingContext2D,
  texte: string,
  cx: number,
  cy: number,
  unite: number,
  hauteurBarres: number,
  tailleTexte: number,
  couleur = '#000000',
): void {
  const propre = nettoyerCode39(texte);
  if (!propre) return;
  const total = largeurCode39(propre) * unite;
  let x = cx - total / 2;
  const yHaut = cy - hauteurBarres / 2;
  ctx.save();
  ctx.fillStyle = couleur;
  for (const c of `*${propre}*`) {
    const m = MOTIFS[c];
    if (!m) continue;
    for (let i = 0; i < 9; i++) {
      const w = (m[i] === 'W' ? LARGE : 1) * unite;
      if (i % 2 === 0) ctx.fillRect(x, yHaut, w, hauteurBarres);
      x += w;
    }
    x += unite;
  }
  if (tailleTexte > 3) {
    ctx.font = `700 ${tailleTexte}px ui-monospace, Consolas, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(propre, cx, cy + hauteurBarres / 2 + 1.5);
  }
  ctx.restore();
}
