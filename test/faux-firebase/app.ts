// Faux Firebase (banc d'essai uniquement) — aucun reseau.
export type FirebaseOptions = Record<string, string>;
export interface FirebaseApp { name: string }
export function initializeApp(_o: FirebaseOptions, name = '[DEFAULT]'): FirebaseApp { return { name }; }
export async function deleteApp(_a: FirebaseApp): Promise<void> {}
