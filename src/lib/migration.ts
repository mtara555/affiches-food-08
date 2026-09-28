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

/** Rejette si une ecriture reste bloquee (reseau coupe, onglet en veille…). */
function avecDelai<T>(promesse: Promise<T>, libelle: string, ms = 60_000): Promise<T> {
  return new Promise<T>((resoudre, rejeter) => {
    const t = window.setTimeout(
      () => rejeter(new Error(`${libelle} : pas de reponse du serveur apres ${ms / 1000} s (reseau ?).`)),
      ms,
    );
    promesse.then(
      (v) => {
        window.clearTimeout(t);
        resoudre(v);
      },
      (e: unknown) => {
        window.clearTimeout(t);
        rejeter(e);
      },
    );
  });
}

export interface OptionsReprise {
  /** Reprendre la base articles (64 ecritures). */
  readonly articles: boolean;
  /** Reprendre gabarits, pictos, parametres et cle IA. */
  readonly reglages: boolean;
}

export interface RapportReprise {
  readonly articles: number;
  readonly elements: number;
  readonly avertissements: string[];
}

export async function reprendre(
  d: AncienneSauvegarde,
  auteur: string,
  etape: (texte: string) => void,
  options: OptionsReprise = { articles: true, reglages: true },
): Promise<RapportReprise> {
  const a7 = d.a7 ?? {};
  const avertissements: string[] = [];
  let nbArticles = 0;
  let nbElements = 0;

  /** Execute une etape ; en cas d'echec, note l'avertissement et continue. */
  const essayer = async (libelle: string, action: () => Promise<void>) => {
    try {
      await action();
      nbElements++;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      // Serveur muet : inutile d'enchainer les autres ecritures (elles attendraient aussi).
      if (/pas de reponse du serveur/.test(message)) throw new Error(`${message} Reprise interrompue : verifiez le reseau puis relancez (sans les articles).`);
      avertissements.push(`${libelle} : ${message}`);
    }
  };

  /* --- Articles --- */
  if (options.articles) {
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
      etape(`Articles : 0 / ${articles.length}`);
      // Pas de delai global : 64 transactions, chacune suivie.
      nbArticles = await importerArticles(articles, auteur, (f, t) => etape(`Articles : ${f} / ${t}`));
    }
  }

  if (!options.reglages) return { articles: nbArticles, elements: nbElements, avertissements };

  /* --- Gabarits A7 (fond + mise en page) --- */
  const defauts = new Map(gabaritsA7ParDefaut().map((g) => [g.id, g]));
  const ids = [...new Set([...Object.keys(a7.templates ?? {}), ...Object.keys(a7.tplLayout ?? {})])];
  for (let n = 0; n < ids.length; n++) {
    const id = ids[n] as string;
    await essayer(`Gabarit A7 ${id}`, async () => {
      const source = a7.templates?.[id];
      const base: GabaritA7 = defauts.get(id) ?? { id, nom: id, image: null, layout: {}, ordre: 100 + n };
      etape(`Gabarits A7 : ${n + 1} / ${ids.length} (${id}) — image`);
      const image = source ? await recompresserDataUrl(source, 1600) : null;
      etape(`Gabarits A7 : ${n + 1} / ${ids.length} (${id}) — enregistrement`);
      await avecDelai(
        enregistrerGabaritA7({ ...base, image, layout: JSON.parse(JSON.stringify(a7.tplLayout?.[id] ?? {})) as LayoutA7 }),
        `Gabarit A7 ${id}`,
      );
    });
  }

  /* --- Parametres (mapping + couleurs) --- */
  await essayer('Parametres', async () => {
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
    await avecDelai(enregistrerParametres(nouveaux), 'Parametres');
  });

  /* --- Gabarits d'affiche A4 --- */
  const tpls = d.a4?.tpls ?? [];
  for (let i = 0; i < tpls.length; i++) {
    const t = tpls[i];
    if (!t) continue;
    const nom = t.name || t.id || `Gabarit ${i + 1}`;
    await essayer(`Gabarit affiche ${nom}`, async () => {
      etape(`Gabarits affiche : ${i + 1} / ${tpls.length} (${nom}) — image`);
      const image = t.bgImg ? await recompresserDataUrl(t.bgImg, 1754) : null;
      const g: GabaritAffiche = {
        id: identifiantDepuisNom(t.id || t.name || `A4_${i}`),
        nom,
        bg: t.bg || '#991b1b',
        bg2: t.bg2 || '#7f1d1d',
        image,
        logo: Boolean(t.logo),
        els: JSON.parse(JSON.stringify(t.els ?? {})) as GabaritAffiche['els'],
        ordre: i + 1,
      };
      etape(`Gabarits affiche : ${i + 1} / ${tpls.length} (${nom}) — enregistrement`);
      await avecDelai(enregistrerGabaritAffiche(g), `Gabarit affiche ${nom}`);
    });
  }

  /* --- Pictos --- */
  const pictos = d.a4?.pictos ?? [];
  for (let i = 0; i < pictos.length; i++) {
    const p = pictos[i];
    if (!p?.dataUrl) continue;
    const dataUrl = p.dataUrl;
    await essayer(`Picto ${p.name ?? i + 1}`, async () => {
      etape(`Pictos : ${i + 1} / ${pictos.length}`);
      await avecDelai(
        enregistrerPicto({
          id: identifiantDepuisNom(p.id || p.name || `PICTO_${i}`),
          nom: p.name || `Picto ${i + 1}`,
          image: await recompresserDataUrl(dataUrl, 600, true),
        }),
        `Picto ${p.name ?? i + 1}`,
      );
    });
  }

  /* --- Gabarits de balisage --- */
  const defautsBalisage = new Map(gabaritsBalisageParDefaut().map((g) => [g.id, g]));
  const bal = d.balisage?.templates ?? [];
  for (let i = 0; i < bal.length; i++) {
    const t = bal[i];
    if (!t?.id) continue;
    const id = t.id;
    await essayer(`Balisage ${id}`, async () => {
      etape(`Gabarits balisage : ${i + 1} / ${bal.length} (${id})`);
      const base = defautsBalisage.get(id);
      await avecDelai(
        enregistrerGabaritBalisage({
          id: identifiantDepuisNom(id),
          nom: base?.nom ?? t.name ?? id,
          image: t.img ? await recompresserDataUrl(t.img, 1800) : null,
          axes: JSON.parse(JSON.stringify(t.axes ?? {})) as GabaritBalisage['axes'],
          libelleDroit: base?.libelleDroit ?? 'Allergènes',
          ordre: base?.ordre ?? 10 + i,
        }),
        `Balisage ${id}`,
      );
    });
  }

  /* --- Cle IA --- */
  if (d.config?.groqKey) {
    const cle = d.config.groqKey;
    await essayer('Cle IA', async () => {
      etape('Cle de traduction IA…');
      await avecDelai(enregistrerReglagesIa({ cleGroq: cle, modele: MODELE_IA_DEFAUT }), 'Cle IA');
    });
  }

  return { articles: nbArticles, elements: nbElements, avertissements };
}
