/**
 * Reprise des donnees de l'ancienne application (fichier de sauvegarde
 * « Marjane_backup_AAAA-MM-JJ.json », bouton Exporter de l'ancienne version).
 *
 * Reprend : base articles (+ gabarits imposes par produit), fonds et mises
 * en page A7, mapping des prefixes, couleurs, gabarits A4 et pictos,
 * gabarits et couleurs du balisage. Les files d'attente et l'historique local
 * ne sont pas repris (ils sont remplaces par les campagnes).
 */

import type {
  ArticleSaisi,
  CouleursA7,
  CouleursBalisage,
  ElementAffiche,
  GabaritA7,
  GabaritAffiche,
  GabaritBalisage,
  LayoutA7,
  Parametres,
  RegleMapping,
} from './types';
import { importerArticles } from './articles';
import {
  enregistrerGabaritA7,
  enregistrerGabaritAffiche,
  enregistrerGabaritBalisage,
  enregistrerPicto,
  gabaritsA7ParDefaut,
  identifiantDepuisNom,
} from './gabarits';
import { enregistrerParametres, enregistrerReglagesIa, chargerParametres, MODELE_IA_DEFAUT } from './parametres';
import { recompresserDataUrl } from './images';
import { gabaritsBalisageParDefaut } from '../rendu/balisage';

/* Forme (partielle) de l'ancienne sauvegarde. */
interface AncienArticle {
  code?: string;
  designation_fr?: string;
  designation_ar?: string;
  ingredients_fr?: string;
  ingredients_ar?: string;
  origine?: string;
  col_j?: string;
  col_h?: string;
}

interface AncienneSauvegarde {
  version?: string;
  a7?: {
    base?: AncienArticle[];
    templates?: Record<string, string>;
    mapping?: { prefix?: string; template?: string; label?: string }[];
    productTpl?: Record<string, string>;
    tplLayout?: Record<string, LayoutA7>;
    textColors?: Partial<CouleursA7>;
  };
  a4?: {
    tpls?: { id?: string; name?: string; bg?: string; bg2?: string; bgImg?: string | null; logo?: boolean; els?: Record<string, ElementAffiche> }[];
    pictos?: { id?: string; name?: string; dataUrl?: string }[];
  };
  balisage?: {
    templates?: { id?: string; name?: string; img?: string | null; axes?: GabaritBalisage['axes'] }[];
    textColors?: Partial<CouleursBalisage>;
  };
  config?: { groqKey?: string };
}

export interface ResumeSauvegarde {
  readonly articles: number;
  readonly fondsA7: number;
  readonly layoutsA7: number;
  readonly mapping: number;
  readonly gabaritsA4: number;
  readonly pictos: number;
  readonly gabaritsBalisage: number;
  readonly cleIa: boolean;
}

export async function lireSauvegarde(fichier: File): Promise<{ donnees: AncienneSauvegarde; resume: ResumeSauvegarde }> {
  let donnees: AncienneSauvegarde;
  try {
    const brut = JSON.parse(await fichier.text()) as AncienneSauvegarde & { base?: AncienArticle[] };
    // Tres ancien format (A7-v5) : les cles A7 sont a la racine.
    donnees = brut.a7 ? brut : { a7: brut as AncienneSauvegarde['a7'] };
  } catch {
    throw new Error("Ce fichier n'est pas une sauvegarde JSON valide.");
  }
  const a7 = donnees.a7 ?? {};
  return {
    donnees,
    resume: {
      articles: a7.base?.length ?? 0,
      fondsA7: Object.values(a7.templates ?? {}).filter(Boolean).length,
      layoutsA7: Object.keys(a7.tplLayout ?? {}).length,
      mapping: a7.mapping?.length ?? 0,
      gabaritsA4: donnees.a4?.tpls?.length ?? 0,
      pictos: donnees.a4?.pictos?.length ?? 0,
      gabaritsBalisage: donnees.balisage?.templates?.length ?? 0,
      cleIa: Boolean(donnees.config?.groqKey),
    },
  };
}

export async function reprendre(
  d: AncienneSauvegarde,
  auteur: string,
  etape: (texte: string) => void,
): Promise<void> {
  const a7 = d.a7 ?? {};

  /* --- Articles --- */
  const imposes = a7.productTpl ?? {};
  const articles: ArticleSaisi[] = (a7.base ?? [])
    .filter((a) => String(a.code ?? '').trim())
    .map((a) => {
      const code = String(a.code).trim();
      return {
        code,
        designationFr: a.designation_fr ?? '',
        designationAr: a.designation_ar ?? '',
        ingredientsFr: a.ingredients_fr ?? '',
        ingredientsAr: a.ingredients_ar ?? '',
        origine: a.origine ?? '',
        colJ: a.col_j ?? '',
        gabaritA7: imposes[code] ?? a.col_h ?? '',
      };
    });
  if (articles.length) {
    await importerArticles(articles, auteur, (f, t) => etape(`Articles : ${f} / ${t}`));
  }

  /* --- Gabarits A7 (fond + mise en page) --- */
  const defauts = new Map(gabaritsA7ParDefaut().map((g) => [g.id, g]));
  const ids = new Set([...Object.keys(a7.templates ?? {}), ...Object.keys(a7.tplLayout ?? {})]);
  let n = 0;
  for (const id of ids) {
    n++;
    etape(`Gabarits A7 : ${n} / ${ids.size} (${id})`);
    const source = a7.templates?.[id];
    const base: GabaritA7 = defauts.get(id) ?? { id, nom: id, image: null, layout: {}, ordre: 100 + n };
    await enregistrerGabaritA7({
      ...base,
      image: source ? await recompresserDataUrl(source, 1600) : null,
      layout: { ...(a7.tplLayout?.[id] ?? {}) },
    });
  }

  /* --- Parametres (mapping + couleurs) --- */
  etape('Parametres…');
  const actuels = await chargerParametres();
  const mapping: RegleMapping[] | undefined = a7.mapping
    ?.filter((m) => m.prefix && m.template)
    .map((m) => ({ prefixe: String(m.prefix), gabarit: String(m.template), libelle: m.label ?? '' }));
  const nouveaux: Parametres = {
    ...actuels,
    mapping: mapping?.length ? mapping : actuels.mapping,
    couleursA7: { ...actuels.couleursA7, ...(a7.textColors ?? {}) },
    couleursBalisage: { ...actuels.couleursBalisage, ...(d.balisage?.textColors ?? {}) },
  };
  await enregistrerParametres(nouveaux);

  /* --- Gabarits d'affiche A4 --- */
  const tpls = d.a4?.tpls ?? [];
  for (let i = 0; i < tpls.length; i++) {
    const t = tpls[i];
    if (!t) continue;
    etape(`Gabarits affiche : ${i + 1} / ${tpls.length}`);
    const g: GabaritAffiche = {
      id: identifiantDepuisNom(t.id || t.name || `A4_${i}`),
      nom: t.name || t.id || `Gabarit ${i + 1}`,
      bg: t.bg || '#991b1b',
      bg2: t.bg2 || '#7f1d1d',
      image: t.bgImg ? await recompresserDataUrl(t.bgImg, 1754) : null,
      logo: Boolean(t.logo),
      els: (t.els ?? {}) as GabaritAffiche['els'],
      ordre: i + 1,
    };
    await enregistrerGabaritAffiche(g);
  }

  /* --- Pictos --- */
  const pictos = d.a4?.pictos ?? [];
  for (let i = 0; i < pictos.length; i++) {
    const p = pictos[i];
    if (!p?.dataUrl) continue;
    etape(`Pictos : ${i + 1} / ${pictos.length}`);
    // L'identifiant d'origine est garde : les affiches importees y font reference.
    await enregistrerPicto({
      id: identifiantDepuisNom(p.id || p.name || `PICTO_${i}`),
      nom: p.name || `Picto ${i + 1}`,
      image: await recompresserDataUrl(p.dataUrl, 600, true),
    });
  }

  /* --- Gabarits de balisage --- */
  const defautsBalisage = new Map(gabaritsBalisageParDefaut().map((g) => [g.id, g]));
  const bal = d.balisage?.templates ?? [];
  for (let i = 0; i < bal.length; i++) {
    const t = bal[i];
    if (!t?.id) continue;
    etape(`Gabarits balisage : ${i + 1} / ${bal.length}`);
    const base = defautsBalisage.get(t.id);
    await enregistrerGabaritBalisage({
      id: identifiantDepuisNom(t.id),
      nom: base?.nom ?? t.name ?? t.id,
      image: t.img ? await recompresserDataUrl(t.img, 1800) : null,
      axes: t.axes ?? {},
      libelleDroit: base?.libelleDroit ?? 'Allergènes',
      ordre: base?.ordre ?? 10 + i,
    });
  }

  /* --- Cle IA --- */
  if (d.config?.groqKey) {
    etape('Cle de traduction IA…');
    await enregistrerReglagesIa({ cleGroq: d.config.groqKey, modele: MODELE_IA_DEFAUT });
  }
}
