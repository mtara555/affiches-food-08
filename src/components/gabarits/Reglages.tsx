/**
 * Briques d'edition des gabarits : curseur + valeur, couleur, image de fond.
 */

import { useState } from 'react';
import { compresserImage, poids } from '../../lib/images';
import { notifier } from '../Notifications';

interface CurseurProps {
  readonly libelle: string;
  readonly valeur: number | undefined;
  readonly defaut: number;
  readonly min: number;
  readonly max: number;
  readonly pas: number;
  readonly surChange: (v: number | undefined) => void;
}

/** Curseur avec saisie directe ; « ↺ » revient a la valeur par defaut. */
export function Curseur({ libelle, valeur, defaut, min, max, pas, surChange }: CurseurProps) {
  const v = valeur ?? defaut;
  const decimales = pas < 0.01 ? 4 : pas < 1 ? 2 : 0;
  return (
    <div className={`curseur${valeur !== undefined && valeur !== defaut ? ' est-modifie' : ''}`}>
      <span className="curseur__libelle">{libelle}</span>
      <input type="range" min={min} max={max} step={pas} value={v} onChange={(e) => surChange(Number(e.target.value))} aria-label={libelle} />
      <input
        type="number"
        className="curseur__valeur"
        min={min}
        max={max}
        step={pas}
        value={Number(v.toFixed(decimales))}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) surChange(n);
        }}
      />
      <button type="button" className="curseur__raz" title="Valeur par defaut" onClick={() => surChange(undefined)} disabled={valeur === undefined}>
        ↺
      </button>
    </div>
  );
}

interface CouleurProps {
  readonly libelle: string;
  readonly valeur: string | undefined;
  readonly defaut: string;
  readonly surChange: (v: string | undefined) => void;
}

export function Couleur({ libelle, valeur, defaut, surChange }: CouleurProps) {
  const v = valeur || defaut;
  return (
    <div className="curseur">
      <span className="curseur__libelle">{libelle}</span>
      <span className="nuancier">
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(v) ? v : '#000000'} onChange={(e) => surChange(e.target.value)} aria-label={libelle} />
        <code>{v}</code>
      </span>
      <span />
      <button type="button" className="curseur__raz" title="Couleur par defaut" onClick={() => surChange(undefined)} disabled={!valeur}>
        ↺
      </button>
    </div>
  );
}

interface ImageProps {
  readonly image: string | null;
  readonly surChange: (dataUrl: string | null) => void;
  readonly coteMax: number;
  readonly aide: string;
  readonly transparence?: boolean;
}

export function ChoixImage({ image, surChange, coteMax, aide, transparence }: ImageProps) {
  const [traitement, setTraitement] = useState(false);
  return (
    <div className="choix-image">
      <div className="choix-image__actions">
        <label className={`bouton bouton--discret bouton--petit${traitement ? ' est-desactive' : ''}`}>
          {traitement ? 'Compression…' : image ? "Remplacer l'image" : 'Choisir une image de fond'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="visually-hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              setTraitement(true);
              try {
                surChange(await compresserImage(f, coteMax, transparence));
              } catch (err) {
                notifier(err instanceof Error ? err.message : 'Image illisible.', 'erreur');
              } finally {
                setTraitement(false);
              }
            }}
          />
        </label>
        {image ? (
          <button type="button" className="bouton bouton--danger bouton--petit" onClick={() => surChange(null)}>
            Retirer ({poids(image)})
          </button>
        ) : null}
      </div>
      <p className="champ__aide">{aide}</p>
    </div>
  );
}
