/**
 * Champ texte (ou zone multiligne) avec, en option, un bouton de traduction
 * IA vers l'arabe a partir d'un autre champ.
 */

import { useState } from 'react';
import { traduireEnArabe, type NatureTexte } from '../lib/traduction';
import { notifier } from './Notifications';

interface Props {
  readonly id: string;
  readonly libelle: string;
  readonly valeur: string;
  readonly surChange: (v: string) => void;
  readonly multiligne?: boolean;
  readonly arabe?: boolean;
  readonly placeholder?: string;
  /** Texte francais a traduire (active le bouton « Traduire »). */
  readonly sourceTraduction?: string;
  readonly nature?: NatureTexte;
  readonly large?: boolean;
  readonly aide?: string;
  readonly maxLength?: number;
}

export function ChampTexte({
  id,
  libelle,
  valeur,
  surChange,
  multiligne,
  arabe,
  placeholder,
  sourceTraduction,
  nature = 'designation',
  large,
  aide,
  maxLength,
}: Props) {
  const [traduction, setTraduction] = useState(false);

  async function traduire() {
    if (!sourceTraduction?.trim()) {
      notifier('Saisissez d’abord le texte francais.', 'erreur');
      return;
    }
    setTraduction(true);
    try {
      surChange(await traduireEnArabe(sourceTraduction, nature));
      notifier('Traduction arabe generee — verifiez-la avant impression.', 'info');
    } catch (e) {
      notifier(e instanceof Error ? e.message : 'Traduction impossible.', 'erreur');
    } finally {
      setTraduction(false);
    }
  }

  const commun = {
    id,
    value: valeur,
    placeholder,
    maxLength,
    dir: arabe ? ('rtl' as const) : undefined,
    lang: arabe ? 'ar' : undefined,
    className: arabe ? 'texte-arabe' : undefined,
  };

  return (
    <div className={`champ${large ? ' champ--large' : ''}`}>
      <label htmlFor={id} className="champ__libelle">
        <span>{libelle}</span>
        {sourceTraduction !== undefined ? (
          <button type="button" className="lien-bouton" onClick={() => void traduire()} disabled={traduction}>
            {traduction ? 'Traduction…' : 'Traduire FR → AR (IA)'}
          </button>
        ) : null}
      </label>
      {multiligne ? (
        <textarea {...commun} rows={3} onChange={(e) => surChange(e.target.value)} />
      ) : (
        <input {...commun} type="text" onChange={(e) => surChange(e.target.value)} />
      )}
      {aide ? <p className="champ__aide">{aide}</p> : null}
    </div>
  );
}
