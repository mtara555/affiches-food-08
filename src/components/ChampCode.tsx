/**
 * Champ « code article » : saisie clavier / douchette (Entree), recherche,
 * et scan par la camera du telephone.
 */

import { forwardRef, useState } from 'react';
import { ScannerCodeBarre } from './ScannerCodeBarre';

interface Props {
  readonly valeur: string;
  readonly surChange: (v: string) => void;
  /** Recherche demandee (Entree, bouton, scan, sortie du champ). */
  readonly surRecherche: (code: string) => void;
  readonly enRecherche?: boolean;
  readonly etiquette?: string;
}

export const ChampCode = forwardRef<HTMLInputElement, Props>(function ChampCode(
  { valeur, surChange, surRecherche, enRecherche, etiquette = 'Code article' },
  ref,
) {
  const [scanner, setScanner] = useState(false);
  const camera = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);

  return (
    <>
      <div className="ligne-ean">
        <div className="champ champ--extensible">
          <label htmlFor="code-article">{etiquette}</label>
          <input
            ref={ref}
            id="code-article"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="Scanner ou saisir le code puis Entree"
            value={valeur}
            onChange={(e) => surChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                surRecherche(valeur);
              }
            }}
          />
        </div>
        <button
          type="button"
          className="bouton bouton--discret"
          onClick={() => surRecherche(valeur)}
          disabled={enRecherche || !valeur.trim()}
        >
          {enRecherche ? 'Recherche…' : 'Rechercher'}
        </button>
        {camera ? (
          <button type="button" className="bouton bouton--principal bouton--scanner" onClick={() => setScanner(true)} title="Scanner avec la camera">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
              <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
              <path d="M7 8v8M10 8v8M13 8v8M17 8v8" />
            </svg>
            Scanner
          </button>
        ) : null}
      </div>
      <ScannerCodeBarre
        ouvert={scanner}
        surFermer={() => setScanner(false)}
        surCode={(code) => {
          setScanner(false);
          surChange(code);
          surRecherche(code);
        }}
      />
    </>
  );
});
