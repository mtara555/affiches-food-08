/**
 * Reglages d'une campagne « Affiches vrac » : largeur, hauteur (mm) et
 * presence des ingredients. Utilise a la creation de la campagne et a
 * l'impression. `surChange` n'est appele que pour des valeurs valides.
 */

import { useEffect, useState } from 'react';
import './ReglagesVrac.css';
import { VRAC_MAX_MM, VRAC_MIN_MM, VRAC_PRESETS, type ParametresVrac } from '../../config/constants';
import { versNombre } from '../../rendu/commun';
import { disposerVrac } from '../../rendu/pdf';

interface Props {
  readonly valeur: ParametresVrac;
  readonly surChange: (v: ParametresVrac) => void;
  /** Identifiant unique des champs (plusieurs instances possibles). */
  readonly idPrefixe?: string;
}

const enTexte = (n: number) => String(n).replace('.', ',');

/** Nombre de mm valide (arrondi au dixieme) ou NaN. */
function lireMm(texte: string): number {
  const n = versNombre(texte);
  if (!Number.isFinite(n) || n < VRAC_MIN_MM || n > VRAC_MAX_MM) return NaN;
  return Math.round(n * 10) / 10;
}

export function ReglagesVrac({ valeur, surChange, idPrefixe = 'vrac' }: Props) {
  const [largeur, setLargeur] = useState(enTexte(valeur.largeurMm));
  const [hauteur, setHauteur] = useState(enTexte(valeur.hauteurMm));

  // Valeurs modifiees de l'exterieur (liste de formats, rechargement) : on realigne les champs.
  useEffect(() => {
    if (lireMm(largeur) !== valeur.largeurMm) setLargeur(enTexte(valeur.largeurMm));
    if (lireMm(hauteur) !== valeur.hauteurMm) setHauteur(enTexte(valeur.hauteurMm));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valeur.largeurMm, valeur.hauteurMm]);

  const lOk = lireMm(largeur);
  const hOk = lireMm(hauteur);
  const valide = !Number.isNaN(lOk) && !Number.isNaN(hOk);
  const dispo = valide ? disposerVrac(lOk, hOk) : null;
  const preset = VRAC_PRESETS.findIndex((p) => p.largeurMm === valeur.largeurMm && p.hauteurMm === valeur.hauteurMm);

  function saisir(cote: 'l' | 'h', texte: string) {
    if (cote === 'l') setLargeur(texte);
    else setHauteur(texte);
    const nl = cote === 'l' ? lireMm(texte) : lOk;
    const nh = cote === 'h' ? lireMm(texte) : hOk;
    if (!Number.isNaN(nl) && !Number.isNaN(nh)) surChange({ ...valeur, largeurMm: nl, hauteurMm: nh });
  }

  return (
    <div className="reglages-vrac">
      <div className="formulaire-ligne">
        <div className="champ">
          <label htmlFor={`${idPrefixe}-format`}>Format courant</label>
          <select
            id={`${idPrefixe}-format`}
            value={preset >= 0 ? String(preset) : 'perso'}
            onChange={(e) => {
              const p = VRAC_PRESETS[Number(e.target.value)];
              if (p) surChange({ ...valeur, largeurMm: p.largeurMm, hauteurMm: p.hauteurMm });
            }}
          >
            <option value="perso" disabled={preset >= 0}>Personnalise</option>
            {VRAC_PRESETS.map((p, i) => (
              <option key={p.libelle} value={String(i)}>{p.libelle}</option>
            ))}
          </select>
        </div>
        <div className="champ">
          <label htmlFor={`${idPrefixe}-largeur`}>Largeur (mm)</label>
          <input
            id={`${idPrefixe}-largeur`}
            type="text"
            inputMode="decimal"
            value={largeur}
            aria-invalid={Number.isNaN(lOk)}
            onChange={(e) => saisir('l', e.target.value)}
          />
        </div>
        <div className="champ">
          <label htmlFor={`${idPrefixe}-hauteur`}>Hauteur (mm)</label>
          <input
            id={`${idPrefixe}-hauteur`}
            type="text"
            inputMode="decimal"
            value={hauteur}
            aria-invalid={Number.isNaN(hOk)}
            onChange={(e) => saisir('h', e.target.value)}
          />
        </div>
        <div className="champ">
          <span className="reglages-vrac__titre" id={`${idPrefixe}-mode`}>Contenu</span>
          <div className="segments" role="group" aria-labelledby={`${idPrefixe}-mode`}>
            <button
              type="button"
              className={`segments__bouton${valeur.avecIngredients ? ' est-actif' : ''}`}
              onClick={() => surChange({ ...valeur, avecIngredients: true })}
            >
              Avec ingredients
            </button>
            <button
              type="button"
              className={`segments__bouton${!valeur.avecIngredients ? ' est-actif' : ''}`}
              onClick={() => surChange({ ...valeur, avecIngredients: false })}
            >
              Sans ingredients
            </button>
          </div>
        </div>
      </div>
      <p className={`champ__aide${valide ? '' : ' champ__aide--alerte'}`}>
        {!valide
          ? `Largeur et hauteur : entre ${VRAC_MIN_MM} et ${VRAC_MAX_MM} mm.`
          : dispo?.pageSurMesure
            ? 'Trop grande pour un A4 : une affiche par page, a sa taille exacte.'
            : `${dispo?.parPage} affiche(s) par feuille A4 (${dispo?.orientation === 'landscape' ? 'paysage' : 'portrait'}).`}
      </p>
    </div>
  );
}
