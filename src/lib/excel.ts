/**
 * Lecture / ecriture de classeurs Excel (SheetJS, charge a la demande).
 */

export type Ligne = string[];

/** Premiere feuille du classeur, toutes cellules en texte. */
export async function lireFeuille(fichier: File): Promise<Ligne[]> {
  const XLSX = await import('xlsx');
  const donnees = new Uint8Array(await fichier.arrayBuffer());
  const classeur = XLSX.read(donnees, { type: 'array' });
  const nom = classeur.SheetNames[0];
  if (!nom) return [];
  const feuille = classeur.Sheets[nom];
  if (!feuille) return [];
  const lignes = XLSX.utils.sheet_to_json<unknown[]>(feuille, { header: 1, defval: '', raw: false });
  return lignes.map((l) => l.map((c) => String(c ?? '').trim()));
}

/** Retire la ligne d'en-tete si la premiere cellule n'est pas un code numerique. */
export function sansEntete(lignes: Ligne[]): Ligne[] {
  const premiere = lignes[0]?.[0] ?? '';
  return premiere && !/^\d/.test(premiere) ? lignes.slice(1) : lignes;
}

export async function ecrireClasseur(lignes: (string | number)[][], nomFeuille: string, nomFichier: string): Promise<void> {
  const XLSX = await import('xlsx');
  const feuille = XLSX.utils.aoa_to_sheet(lignes);
  const classeur = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(classeur, feuille, nomFeuille.slice(0, 31));
  XLSX.writeFile(classeur, nomFichier);
}

/** Nombre « 12,5 » / « 12.5 » -> 12.5 ; 0 si vide ou invalide. */
export function nombre(v: string | undefined): number {
  const n = parseFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}
