/**
 * Statistiques du tableau de bord et du rapport PDF.
 *
 * Source : la liste des campagnes (aucune lecture supplementaire de Firestore).
 * Les elements d'une campagne sont rattaches a la DATE DE CREATION de la
 * campagne (champ `creeLe`, a defaut `majLe`) : une campagne = un lot saisi
 * pour une semaine. Tous les calculs sont faits dans le navigateur.
 */

import { TYPES_ORDONNES, type TypeCampagne } from '../config/constants';
import type { Campagne } from './types';

export type Comptes = Record<TypeCampagne, number>;

export const comptesVides = (): Comptes => ({ A7: 0, VRAC: 0, AFFICHE: 0, BALISAGE: 0 });
export const totalComptes = (c: Comptes): number => TYPES_ORDONNES.reduce((s, t) => s + c[t], 0);

/** Date de rattachement d'une campagne aux statistiques. */
export const dateCampagne = (c: Campagne): Date | null => c.creeLe ?? c.majLe;

/* -------------------------------------------------------------------------- */
/* Dates                                                                       */
/* -------------------------------------------------------------------------- */

const debutJour = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const ajouterJours = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
/** Lundi de la semaine de d. */
const debutSemaine = (d: Date) => ajouterJours(debutJour(d), -((d.getDay() + 6) % 7));

/** Numero de semaine ISO 8601. */
function numeroSemaine(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const jour = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - jour);
  const debutAnnee = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - debutAnnee.getTime()) / 86400000 + 1) / 7);
}

const fmt = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('fr-FR', options);
const fJour = fmt({ day: '2-digit', month: '2-digit' });
const fJourLong = fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fMois = fmt({ month: 'short' });
const fMoisLong = fmt({ month: 'long', year: 'numeric' });
const fMoisSeul = fmt({ month: 'long' });
const fCourt = fmt({ day: 'numeric', month: 'short' });
const fJourCourt = fmt({ weekday: 'short', day: '2-digit', month: '2-digit' });
const fJourMois = fmt({ day: 'numeric', month: 'long' });
const premiereMajuscule = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

/* -------------------------------------------------------------------------- */
/* Histogramme du tableau de bord                                              */
/* -------------------------------------------------------------------------- */

export type Periode = 'jour' | 'semaine' | 'mois' | 'annee';

export const LIBELLE_PERIODE: Readonly<Record<Periode, string>> = {
  jour: 'Jour',
  semaine: 'Semaine',
  mois: 'Mois',
  annee: 'Annee',
};

export const ETENDUE_PERIODE: Readonly<Record<Periode, string>> = {
  jour: '30 derniers jours',
  semaine: '12 dernieres semaines',
  mois: '12 derniers mois',
  annee: 'toutes les annees',
};

export interface Intervalle {
  readonly cle: string;
  /** Libelle court de l'axe. */
  readonly libelle: string;
  /** Libelle complet de l'infobulle et du tableau. */
  readonly libelleLong: string;
  readonly debut: Date;
  readonly fin: Date;
  /** Elements par type de campagne. */
  readonly comptes: Comptes;
  /** Nombre de campagnes creees. */
  nbCampagnes: number;
}

function intervalle(cle: string, libelle: string, libelleLong: string, debut: Date, fin: Date): Intervalle {
  return { cle, libelle, libelleLong, debut, fin, comptes: comptesVides(), nbCampagnes: 0 };
}

function construireIntervalles(periode: Periode, campagnes: readonly Campagne[]): Intervalle[] {
  const maintenant = new Date();
  const liste: Intervalle[] = [];

  if (periode === 'jour') {
    const aujourdhui = debutJour(maintenant);
    for (let i = 29; i >= 0; i--) {
      const debut = ajouterJours(aujourdhui, -i);
      liste.push(intervalle(debut.toISOString(), fJour.format(debut), fJourLong.format(debut), debut, ajouterJours(debut, 1)));
    }
  } else if (periode === 'semaine') {
    const lundi = debutSemaine(maintenant);
    for (let i = 11; i >= 0; i--) {
      const debut = ajouterJours(lundi, -7 * i);
      const fin = ajouterJours(debut, 7);
      liste.push(
        intervalle(
          debut.toISOString(),
          `S${numeroSemaine(debut)}`,
          `Semaine ${numeroSemaine(debut)} — du ${fCourt.format(debut)} au ${fCourt.format(ajouterJours(fin, -1))}`,
          debut,
          fin,
        ),
      );
    }
  } else if (periode === 'mois') {
    for (let i = 11; i >= 0; i--) {
      const debut = new Date(maintenant.getFullYear(), maintenant.getMonth() - i, 1);
      liste.push(
        intervalle(
          debut.toISOString(),
          fMois.format(debut).replace('.', ''),
          fMoisLong.format(debut),
          debut,
          new Date(debut.getFullYear(), debut.getMonth() + 1, 1),
        ),
      );
    }
  } else {
    const anneeCourante = maintenant.getFullYear();
    let premiere = anneeCourante;
    for (const c of campagnes) {
      const d = dateCampagne(c);
      if (d && d.getFullYear() < premiere) premiere = d.getFullYear();
    }
    for (let a = Math.min(premiere, anneeCourante - 2); a <= anneeCourante; a++) {
      liste.push(intervalle(String(a), String(a), `Annee ${a}`, new Date(a, 0, 1), new Date(a + 1, 0, 1)));
    }
  }
  return liste;
}

/** Repartit les elements des campagnes dans les intervalles de la periode. */
export function regrouper(periode: Periode, campagnes: readonly Campagne[]): Intervalle[] {
  const intervalles = construireIntervalles(periode, campagnes);
  if (intervalles.length === 0) return intervalles;
  const debutTotal = intervalles[0]!.debut.getTime();
  const finTotal = intervalles[intervalles.length - 1]!.fin.getTime();

  for (const c of campagnes) {
    const d = dateCampagne(c);
    if (!d) continue;
    const t = d.getTime();
    if (t < debutTotal || t >= finTotal) continue;
    const cible = intervalles.find((i) => t >= i.debut.getTime() && t < i.fin.getTime());
    if (!cible) continue;
    cible.comptes[c.type] += c.nbElements;
    cible.nbCampagnes += 1;
  }
  return intervalles;
}

/* -------------------------------------------------------------------------- */
/* Rapport PDF : jour, semaine, mois, trimestre ou annee au choix               */
/* -------------------------------------------------------------------------- */

export type PeriodeRapport = 'jour' | 'semaine' | 'mois' | 'trimestre' | 'annee';

export const LIBELLE_PERIODE_RAPPORT: Readonly<Record<PeriodeRapport, string>> = {
  jour: 'Jour',
  semaine: 'Semaine',
  mois: 'Mois',
  trimestre: 'Trimestre',
  annee: 'Annee',
};

export interface SousIntervalle {
  readonly libelle: string;
  readonly debut: Date;
  readonly fin: Date;
}

export interface PlageRapport {
  readonly type: PeriodeRapport;
  /** Premier instant de la periode (inclus). */
  readonly debut: Date;
  /** Premier instant apres la periode (exclu). */
  readonly fin: Date;
  /** Titre lisible : « Semaine 47 — du 23 novembre au dimanche 29 novembre 2026 ». */
  readonly libelle: string;
  /** Periode de meme nature juste avant (pour la comparaison). */
  readonly precedente: { readonly debut: Date; readonly fin: Date };
  /** Nom de la colonne du detail : Heure, Jour ou Mois. */
  readonly colonne: string;
  readonly sousIntervalles: readonly SousIntervalle[];
}

function sousIntervallesParMois(annee: number, premierMois: number, nombre: number): SousIntervalle[] {
  const liste: SousIntervalle[] = [];
  for (let i = 0; i < nombre; i++) {
    const debut = new Date(annee, premierMois + i, 1);
    liste.push({
      libelle: nombre > 3 ? fMois.format(debut).replace('.', '') : premiereMajuscule(fMoisSeul.format(debut)),
      debut,
      fin: new Date(annee, premierMois + i + 1, 1),
    });
  }
  return liste;
}

/**
 * Periode du rapport qui CONTIENT la date de reference : le jour, la semaine
 * (lundi au dimanche), le mois, le trimestre civil ou l'annee de cette date.
 */
export function calculerPlage(type: PeriodeRapport, reference: Date): PlageRapport {
  const jour = debutJour(reference);

  if (type === 'jour') {
    const sous: SousIntervalle[] = [];
    for (let h = 0; h < 24; h++) {
      sous.push({
        libelle: `${String(h).padStart(2, '0')}h`,
        debut: new Date(jour.getFullYear(), jour.getMonth(), jour.getDate(), h),
        fin: new Date(jour.getFullYear(), jour.getMonth(), jour.getDate(), h + 1),
      });
    }
    return {
      type,
      debut: jour,
      fin: ajouterJours(jour, 1),
      libelle: premiereMajuscule(fJourLong.format(jour)),
      precedente: { debut: ajouterJours(jour, -1), fin: jour },
      colonne: 'Heure',
      sousIntervalles: sous,
    };
  }

  if (type === 'semaine') {
    const debut = debutSemaine(jour);
    const fin = ajouterJours(debut, 7);
    const sous: SousIntervalle[] = [];
    for (let i = 0; i < 7; i++) {
      const d = ajouterJours(debut, i);
      sous.push({
        libelle: premiereMajuscule(fJourCourt.format(d).replace('.', '')),
        debut: d,
        fin: ajouterJours(d, 1),
      });
    }
    return {
      type,
      debut,
      fin,
      libelle: `Semaine ${numeroSemaine(debut)} — du ${fJourMois.format(debut)} au ${fJourLong.format(ajouterJours(fin, -1))}`,
      precedente: { debut: ajouterJours(debut, -7), fin: debut },
      colonne: 'Jour',
      sousIntervalles: sous,
    };
  }

  if (type === 'mois') {
    const debut = new Date(jour.getFullYear(), jour.getMonth(), 1);
    const fin = new Date(jour.getFullYear(), jour.getMonth() + 1, 1);
    const sous: SousIntervalle[] = [];
    for (let d = debut; d < fin; d = ajouterJours(d, 1)) {
      sous.push({ libelle: fJour.format(d), debut: d, fin: ajouterJours(d, 1) });
    }
    return {
      type,
      debut,
      fin,
      libelle: premiereMajuscule(fMoisLong.format(debut)),
      precedente: { debut: new Date(debut.getFullYear(), debut.getMonth() - 1, 1), fin: debut },
      colonne: 'Jour',
      sousIntervalles: sous,
    };
  }

  if (type === 'trimestre') {
    const trimestre = Math.floor(jour.getMonth() / 3);
    const debut = new Date(jour.getFullYear(), trimestre * 3, 1);
    const dernierMois = new Date(jour.getFullYear(), trimestre * 3 + 2, 1);
    return {
      type,
      debut,
      fin: new Date(jour.getFullYear(), trimestre * 3 + 3, 1),
      libelle: `Trimestre ${trimestre + 1} ${debut.getFullYear()} — ${fMoisSeul.format(debut)} a ${fMoisSeul.format(dernierMois)}`,
      precedente: { debut: new Date(debut.getFullYear(), debut.getMonth() - 3, 1), fin: debut },
      colonne: 'Mois',
      sousIntervalles: sousIntervallesParMois(debut.getFullYear(), trimestre * 3, 3),
    };
  }

  const debut = new Date(jour.getFullYear(), 0, 1);
  return {
    type,
    debut,
    fin: new Date(jour.getFullYear() + 1, 0, 1),
    libelle: `Annee ${debut.getFullYear()}`,
    precedente: { debut: new Date(debut.getFullYear() - 1, 0, 1), fin: debut },
    colonne: 'Mois',
    sousIntervalles: sousIntervallesParMois(debut.getFullYear(), 0, 12),
  };
}

/** Campagnes creees dans [debut, fin[, de la plus ancienne a la plus recente. */
export function campagnesDansPlage(campagnes: readonly Campagne[], debut: Date, fin: Date): Campagne[] {
  const d = debut.getTime();
  const f = fin.getTime();
  return campagnes
    .filter((c) => {
      const t = dateCampagne(c)?.getTime();
      return t !== undefined && t >= d && t < f;
    })
    .sort((a, b) => dateCampagne(a)!.getTime() - dateCampagne(b)!.getTime());
}

/** Elements par type et nombre de campagnes creees dans [debut, fin[. */
export function compter(
  campagnes: readonly Campagne[],
  debut: Date,
  fin: Date,
): { comptes: Comptes; total: number; nbCampagnes: number } {
  const comptes = comptesVides();
  const dans = campagnesDansPlage(campagnes, debut, fin);
  for (const c of dans) comptes[c.type] += c.nbElements;
  return { comptes, total: totalComptes(comptes), nbCampagnes: dans.length };
}

export interface LigneOperateur {
  readonly nom: string;
  readonly nbCampagnes: number;
  readonly elements: number;
}

/** Elements et campagnes par operateur (createur de la campagne), du plus actif au moins actif. */
export function parOperateur(campagnes: readonly Campagne[], debut: Date, fin: Date): LigneOperateur[] {
  const table = new Map<string, { nom: string; nbCampagnes: number; elements: number }>();
  for (const c of campagnesDansPlage(campagnes, debut, fin)) {
    const cle = c.creePar || c.creeParNom || '?';
    const ligne = table.get(cle) ?? { nom: c.creeParNom || 'Inconnu', nbCampagnes: 0, elements: 0 };
    ligne.nbCampagnes += 1;
    ligne.elements += c.nbElements;
    table.set(cle, ligne);
  }
  return [...table.values()].sort((a, b) => b.elements - a.elements || a.nom.localeCompare(b.nom));
}
