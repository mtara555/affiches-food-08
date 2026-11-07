/**
 * Traduction FR -> AR commerciale par IA (Groq gratuit ou OpenAI payant, au choix dans Parametres).
 *
 * Les cles sont definies par un administrateur (Parametres) et partagees avec les
 * utilisateurs actifs ; a defaut, une cle personnelle peut etre gardee sur
 * l'appareil. Les textes envoyes sont des designations et ingredients de
 * produits, jamais de donnees personnelles.
 */

import { chargerReglagesIa, MODELES_IA_DEFAUT, type FournisseurIa } from './parametres';

const CLE_LOCALE: Readonly<Record<FournisseurIa, string>> = { groq: 'affiches-food.cle-groq', openai: 'affiches-food.cle-openai' };

export function cleLocale(f: FournisseurIa = 'groq'): string {
  try {
    return localStorage.getItem(CLE_LOCALE[f]) ?? '';
  } catch {
    return '';
  }
}

export function definirCleLocale(cle: string, f: FournisseurIa = 'groq'): void {
  try {
    if (cle.trim()) localStorage.setItem(CLE_LOCALE[f], cle.trim());
    else localStorage.removeItem(CLE_LOCALE[f]);
  } catch {
    /* stockage indisponible */
  }
}

/** Les deux services parlent le meme protocole (chat completions) ; seuls l'adresse et deux parametres different. */
const FOURNISSEURS: Readonly<Record<FournisseurIa, { nom: string; url: string }>> = {
  groq: { nom: 'Groq', url: 'https://api.groq.com/openai/v1/chat/completions' },
  openai: { nom: 'OpenAI', url: 'https://api.openai.com/v1/chat/completions' },
};

interface ReglageActif {
  fournisseur: FournisseurIa;
  cle: string;
  modele: string;
}

let reglages: Promise<ReglageActif> | null = null;

async function obtenirCle(): Promise<ReglageActif> {
  reglages ??= chargerReglagesIa().then((r) =>
    r.fournisseur === 'openai'
      ? { fournisseur: 'openai' as const, cle: r.cleOpenai, modele: r.modeleOpenai || MODELES_IA_DEFAUT.openai }
      : { fournisseur: 'groq' as const, cle: r.cleGroq, modele: r.modeleGroq || MODELES_IA_DEFAUT.groq },
  );
  const r = await reglages;
  return { ...r, cle: r.cle || cleLocale(r.fournisseur) };
}

/** A appeler apres modification des reglages IA. */
export function oublierReglagesIa(): void {
  reglages = null;
}

const CONSIGNE_DESIGNATION = `Tu es un expert en traduction commerciale pour la grande distribution au Maroc (hypermarche Marjane).
Donne le NOM COMMERCIAL du produit en arabe : uniquement le type de produit (avec sa variete ou sa qualite), comme sur une etiquette de rayon.
Regles strictes :
- N'inclus JAMAIS : la marque ou le fabricant, les mots promotionnels (PACK, PROMO, LOT, OFFRE, NOUVEAU…), les mesures et quantites (poids, volume, dimensions, nombre de pieces ou de portions, conditionnement : 250G, 1L, 1/2L, X6, 8 PORTIONS), les codes et references, et tout chiffre.
- Arabe commercial courant (arabe standard, termes d'etiquette de supermarche marocain), 2 a 4 mots, sans guillemets.
- Reponds UNIQUEMENT par la traduction arabe, sans explication.
Exemples :
"PACK PROMO : SALIM LAIT UHT ENTIER 1/2L X6" -> "حليب معقم"
"BEURRE DE CUISINE 250G" -> "زبدة الطهي"
"JUS D'ORANGE 1L" -> "عصير البرتقال"
"FROMAGE FONDU 8 PORTIONS" -> "جبن مذاب"
"HUILE DE TABLE LESIEUR 5L" -> "زيت المائدة"
"YAOURT NATURE DANONE X8" -> "زبادي طبيعي"`;

const CONSIGNE_INGREDIENTS = `Tu es traducteur pour l'etiquetage alimentaire au Maroc.
Traduis la liste d'ingredients francaise en arabe standard, dans le meme ordre, separee par des virgules arabes (،).
Conserve les pourcentages et les codes additifs (E330…). Reponds UNIQUEMENT par la traduction.`;

export type NatureTexte = 'designation' | 'ingredients';


const CHIFFRES = '0-9٠-٩';
const UNITES_AR = 'كيلوغرام|كيلو|كغ|غرام|غ|مغ|لتر|ملل|مل|سل|ل|متر|سم|ملم|قطعة|قطع|حبة|حبات|وحدة|وحدات|كبسولة|كبسولات|kg|gr|g|mg|ml|cl|l|cm|mm|m|pcs';
const MESURE = new RegExp(`(?:[x×]\\s*)?[${CHIFFRES}]+(?:[.,،٫/][${CHIFFRES}]+)*\\s*(?:[x×]\\s*[${CHIFFRES}]+)?\\s*(?:${UNITES_AR})?`, 'gi');

/**
 * Filet de securite : retire des designations arabes toute mesure ou quantite (250غ, 1ل, 1/2ل × 6, 8 قطع)
 * qui aurait echappe a la consigne. Si rien ne reste, la traduction d'origine est conservee.
 */
export function retirerMesures(arabe: string): string {
  const propre = arabe
    .replace(MESURE, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s:،,;\-–/×x]+|[\s:،,;\-–/×x]+$/gi, '')
    .trim();
  return propre || arabe.trim();
}

export async function traduireEnArabe(texte: string, nature: NatureTexte = 'designation'): Promise<string> {
  const source = texte.trim();
  if (!source) throw new Error('Saisissez d’abord le texte francais.');
  const { fournisseur, cle, modele } = await obtenirCle();
  const { nom, url } = FOURNISSEURS[fournisseur];
  if (!cle) {
    throw new Error(`Traduction IA non configuree : un administrateur doit saisir la cle ${nom} dans Parametres.`);
  }
  const maxTokens = nature === 'designation' ? 120 : 700;
  let reponse: Response;
  try {
    reponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cle}` },
      body: JSON.stringify({
        model: modele,
        // OpenAI recent n'accepte que « max_completion_tokens » ; Groq garde « max_tokens ».
        ...(fournisseur === 'openai' ? { max_completion_tokens: maxTokens } : { max_tokens: maxTokens }),
        // Traduction reproductible (0) ; les modeles « raisonnement » d'OpenAI (gpt-5, o3…) n'acceptent que la valeur par defaut.
        ...(fournisseur === 'groq' || /chat/i.test(modele) ? { temperature: 0 } : {}),
        messages: [
          { role: 'system', content: nature === 'designation' ? CONSIGNE_DESIGNATION : CONSIGNE_INGREDIENTS },
          { role: 'user', content: source.slice(0, nature === 'designation' ? 160 : 1500) },
        ],
      }),
    });
  } catch {
    throw new Error('Service de traduction injoignable (reseau). Verifiez la connexion.');
  }
  if (!reponse.ok) {
    // Message d'erreur du service (ex. insufficient_quota, model_not_found).
    const erreur = (await reponse.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
    const code = erreur.error?.code ?? '';
    if (reponse.status === 401) throw new Error(`Cle ${nom} invalide. Verifiez-la dans Parametres.`);
    if (code === 'insufficient_quota') throw new Error(`Credit ${nom} epuise : rechargez le compte.`);
    if (reponse.status === 429) throw new Error(`Limite ${nom} atteinte. Patientez une minute.`);
    if (reponse.status === 404 || code === 'model_not_found') throw new Error(`Modele « ${modele} » introuvable : verifiez le nom dans Parametres.`);
    throw new Error(`Service de traduction indisponible (${reponse.status}${erreur.error?.message ? ` : ${erreur.error.message.slice(0, 120)}` : ''}).`);
  }
  const json = (await reponse.json()) as { choices?: { message?: { content?: string } }[] };
  const brut = (json.choices?.[0]?.message?.content ?? '').trim().replace(/^["«]|["»]$/g, '');
  if (!brut) throw new Error('Reponse vide du service de traduction.');
  // Designation : nom commercial seul, sans mesure ni quantite (les ingredients gardent pourcentages et codes additifs).
  return nature === 'designation' ? retirerMesures(brut) : brut;
}
