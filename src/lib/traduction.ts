/**
 * Traduction FR -> AR commerciale par IA (Groq, gratuit)
 *
 * La cle est definie par un administrateur (Parametres) et partagee avec les
 * utilisateurs actifs ; a defaut, une cle personnelle peut etre gardee sur
 * l'appareil. Les textes envoyes sont des designations et ingredients de
 * produits, jamais de donnees personnelles.
 */

import { chargerReglagesIa, MODELE_IA_DEFAUT } from './parametres';

const CLE_LOCALE = 'affiches-food.cle-groq';

export function cleLocale(): string {
  try {
    return localStorage.getItem(CLE_LOCALE) ?? '';
  } catch {
    return '';
  }
}

export function definirCleLocale(cle: string): void {
  try {
    if (cle.trim()) localStorage.setItem(CLE_LOCALE, cle.trim());
    else localStorage.removeItem(CLE_LOCALE);
  } catch {
    /* stockage indisponible */
  }
}

let reglages: Promise<{ cle: string; modele: string }> | null = null;

async function obtenirCle(): Promise<{ cle: string; modele: string }> {
  reglages ??= chargerReglagesIa().then((r) => ({ cle: r.cleGroq, modele: r.modele || MODELE_IA_DEFAUT }));
  const r = await reglages;
  return { cle: r.cle || cleLocale(), modele: r.modele };
}

/** A appeler apres modification des reglages IA. */
export function oublierReglagesIa(): void {
  reglages = null;
}

const CONSIGNE_DESIGNATION = `Tu es un expert en traduction commerciale pour la grande distribution au Maroc (hypermarche Marjane).
Traduis la designation de produit francaise en arabe commercial (arabe standard, termes d'etiquette de supermarche marocain).
Regles :
- Si une marque ou un terme technique n'a pas d'equivalent arabe, conserve-le tel quel.
- Resultat court, adapte a une etiquette (60 caracteres maximum).
- Reponds UNIQUEMENT par la traduction arabe, sans guillemets ni explication.
Exemples : "BEURRE DE CUISINE 250G" -> "زبدة الطهي 250غ" ; "JUS D'ORANGE 1L" -> "عصير البرتقال 1ل" ; "FROMAGE FONDU 8 PORTIONS" -> "جبن مذاب 8 قطع"`;

const CONSIGNE_INGREDIENTS = `Tu es traducteur pour l'etiquetage alimentaire au Maroc.
Traduis la liste d'ingredients francaise en arabe standard, dans le meme ordre, separee par des virgules arabes (،).
Conserve les pourcentages et les codes additifs (E330…). Reponds UNIQUEMENT par la traduction.`;

export type NatureTexte = 'designation' | 'ingredients';

export async function traduireEnArabe(texte: string, nature: NatureTexte = 'designation'): Promise<string> {
  const source = texte.trim();
  if (!source) throw new Error('Saisissez d’abord le texte francais.');
  const { cle, modele } = await obtenirCle();
  if (!cle) {
    throw new Error("Traduction IA non configuree : un administrateur doit saisir la cle Groq dans Parametres.");
  }
  const reponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cle}` },
    body: JSON.stringify({
      model: modele,
      max_tokens: nature === 'designation' ? 120 : 700,
      temperature: 0.2,
      messages: [
        { role: 'system', content: nature === 'designation' ? CONSIGNE_DESIGNATION : CONSIGNE_INGREDIENTS },
        { role: 'user', content: source.slice(0, nature === 'designation' ? 160 : 1500) },
      ],
    }),
  });
  if (reponse.status === 401) throw new Error('Cle Groq invalide. Verifiez-la dans Parametres.');
  if (reponse.status === 429) throw new Error('Limite Groq atteinte. Patientez une minute.');
  if (!reponse.ok) throw new Error(`Service de traduction indisponible (${reponse.status}).`);
  const json = (await reponse.json()) as { choices?: { message?: { content?: string } }[] };
  const traduction = (json.choices?.[0]?.message?.content ?? '').trim().replace(/^["«]|["»]$/g, '');
  if (!traduction) throw new Error('Reponse vide du service de traduction.');
  return traduction;
}
