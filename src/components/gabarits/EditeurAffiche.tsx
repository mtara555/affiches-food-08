/**
 * Edition d'un gabarit d'affiche : fond (degrade ou image), position,
 * taille et couleur de chaque element, avec apercu en direct.
 */

import { useMemo, useState } from 'react';
import type { CleElementAffiche, ElementAffiche, GabaritAffiche } from '../../lib/types';
import { elementsParDefaut, RECT_ECONOMIE_DEFAUT } from '../../rendu/affiche';
import { useDonnees } from '../../context/DonneesContext';
import { Apercu } from '../Apercu';
import { ChoixImage, Couleur, Curseur } from './Reglages';

const ELEMENTS: readonly { cle: CleElementAffiche; libelle: string }[] = [
  { cle: 'desFR', libelle: 'Designation FR' },
  { cle: 'desAR', libelle: 'Designation AR' },
  { cle: 'prixBarre', libelle: 'Prix barre' },
  { cle: 'prixPromo', libelle: 'Prix promo' },
  { cle: 'diff', libelle: 'Economie « وفر »' },
  { cle: 'fidelite', libelle: 'Gain fidelite' },
  { cle: 'gencode', libelle: 'Code-barres' },
  { cle: 'picto', libelle: 'Picto' },
];

/** Elements centres horizontalement (la position X n'est pas utilisee). */
const SANS_X: readonly CleElementAffiche[] = ['desFR', 'desAR', 'diff'];
const SANS_TAILLE: readonly CleElementAffiche[] = ['gencode', 'picto'];

interface Props {
  readonly gabarit: GabaritAffiche;
  readonly nouveau: boolean;
  readonly surEnregistrer: (g: GabaritAffiche) => Promise<void>;
  readonly surFermer: () => void;
}

export function EditeurAffiche({ gabarit, nouveau, surEnregistrer, surFermer }: Props) {
  const { pictos } = useDonnees();
  const [g, setG] = useState<GabaritAffiche>(gabarit);
  const [ouvert, setOuvert] = useState<CleElementAffiche>('prixPromo');
  const [envoi, setEnvoi] = useState(false);
  const defauts = elementsParDefaut();
  const surcharge = useMemo(() => ({ affiche: g }), [g]);

  const exemple = useMemo(
    () => ({
      code: '6111234567890',
      desFR: 'Huile de table 5L',
      desAR: 'زيت المائدة 5 لتر',
      barre: 99.9,
      promo: 79.9,
      fidelite: 5,
      secteur: 'food' as const,
      picto: pictos[0]?.id ?? '',
      gabarit: g.id,
    }),
    [g.id, pictos],
  );

  function maj(cle: CleElementAffiche, champ: keyof ElementAffiche, v: number | string | undefined) {
    setG((x) => {
      const courant = { ...(x.els[cle] ?? {}) } as Record<string, unknown>;
      if (v === undefined) delete courant[champ];
      else courant[champ] = v;
      return { ...x, els: { ...x.els, [cle]: courant as unknown as ElementAffiche } };
    });
  }

  const val = (cle: CleElementAffiche, champ: keyof ElementAffiche) => g.els[cle]?.[champ] as number | undefined;

  return (
    <div className="modale" role="dialog" aria-modal="true">
      <div className="modale__carte modale__carte--large editeur">
        <div className="editeur__colonne">
          <h2 className="modale__titre">{nouveau ? 'Nouveau gabarit d’affiche' : `Gabarit ${g.nom}`}</h2>
          <div className="grille">
            <div className="champ">
              <label htmlFor="nom-af">Nom</label>
              <input id="nom-af" type="text" value={g.nom} onChange={(e) => setG({ ...g, nom: e.target.value })} />
            </div>
            <div className="champ">
              <label htmlFor="ordre-af">Ordre d&apos;affichage</label>
              <input id="ordre-af" type="number" value={g.ordre} onChange={(e) => setG({ ...g, ordre: Number(e.target.value) || 0 })} />
            </div>
          </div>
          <ChoixImage
            image={g.image}
            surChange={(image) => setG({ ...g, image })}
            coteMax={1754}
            aide="Fond A4 portrait (proportions 210 × 297). Sans image : degrade des deux couleurs ci-dessous."
          />
          {!g.image ? (
            <fieldset className="editeur__groupe">
              <legend>Fond degrade</legend>
              <Couleur libelle="Couleur haut" valeur={g.bg} defaut="#991b1b" surChange={(v) => setG({ ...g, bg: v ?? '#991b1b' })} />
              <Couleur libelle="Couleur bas" valeur={g.bg2} defaut="#7f1d1d" surChange={(v) => setG({ ...g, bg2: v ?? '#7f1d1d' })} />
              <label className="case">
                <input type="checkbox" checked={g.logo} onChange={(e) => setG({ ...g, logo: e.target.checked })} />
                Bandeau d&apos;en-tete style Marjane (sans bande de pied)
              </label>
            </fieldset>
          ) : null}

          <div className="onglets-elements">
            {ELEMENTS.map((e) => (
              <button key={e.cle} type="button" className={`segments__bouton${ouvert === e.cle ? ' est-actif' : ''}`} onClick={() => setOuvert(e.cle)}>
                {e.libelle}
              </button>
            ))}
          </div>

          <fieldset className="editeur__groupe">
            <legend>{ELEMENTS.find((e) => e.cle === ouvert)?.libelle}</legend>
            {!SANS_X.includes(ouvert) ? (
              <Curseur libelle="Position horizontale" valeur={val(ouvert, 'x')} defaut={defauts[ouvert].x} min={0} max={1} pas={0.005} surChange={(v) => maj(ouvert, 'x', v)} />
            ) : null}
            {ouvert !== 'diff' ? (
              <Curseur libelle="Position verticale" valeur={val(ouvert, 'y')} defaut={defauts[ouvert].y} min={0} max={1} pas={0.005} surChange={(v) => maj(ouvert, 'y', v)} />
            ) : null}
            {!SANS_TAILLE.includes(ouvert) ? (
              <Curseur libelle="Taille" valeur={val(ouvert, 'fs')} defaut={defauts[ouvert].fs ?? 20} min={6} max={140} pas={1} surChange={(v) => maj(ouvert, 'fs', v)} />
            ) : null}
            {ouvert === 'prixBarre' || ouvert === 'prixPromo' || ouvert === 'diff' || ouvert === 'fidelite' ? (
              <Curseur
                libelle="Taille decimales (rapport)"
                valeur={val(ouvert, 'decScale')}
                defaut={ouvert === 'prixPromo' ? 0.38 : ouvert === 'fidelite' ? 0.45 : 0.5}
                min={0.2}
                max={1}
                pas={0.01}
                surChange={(v) => maj(ouvert, 'decScale', v)}
              />
            ) : null}
            {ouvert === 'picto' ? (
              <Curseur libelle="Largeur" valeur={val('picto', 'w')} defaut={0.2} min={0.05} max={0.6} pas={0.005} surChange={(v) => maj('picto', 'w', v)} />
            ) : null}
            {ouvert === 'diff' ? (
              <>
                <Curseur libelle="Rectangle — gauche" valeur={val('diff', 'diffRectX')} defaut={RECT_ECONOMIE_DEFAUT.x} min={0} max={1} pas={0.005} surChange={(v) => maj('diff', 'diffRectX', v)} />
                <Curseur libelle="Rectangle — haut" valeur={val('diff', 'diffRectY')} defaut={RECT_ECONOMIE_DEFAUT.y} min={0} max={1} pas={0.005} surChange={(v) => maj('diff', 'diffRectY', v)} />
                <Curseur libelle="Rectangle — largeur" valeur={val('diff', 'diffRectW')} defaut={RECT_ECONOMIE_DEFAUT.w} min={0.1} max={1} pas={0.005} surChange={(v) => maj('diff', 'diffRectW', v)} />
                <Curseur libelle="Rectangle — hauteur" valeur={val('diff', 'diffRectH')} defaut={RECT_ECONOMIE_DEFAUT.h} min={0.03} max={0.4} pas={0.005} surChange={(v) => maj('diff', 'diffRectH', v)} />
                <Couleur libelle="Fond du rectangle" valeur={g.els.diff?.bgColor} defaut="#C8102E" surChange={(v) => maj('diff', 'bgColor', v)} />
              </>
            ) : null}
            {!SANS_TAILLE.includes(ouvert) ? (
              <Couleur libelle="Couleur du texte" valeur={g.els[ouvert]?.color} defaut={defauts[ouvert].color ?? '#FFFFFF'} surChange={(v) => maj(ouvert, 'color', v)} />
            ) : null}
          </fieldset>
        </div>

        <div className="editeur__apercu">
          <Apercu type="AFFICHE" element={exemple} largeur={300} surcharge={surcharge} />
          <p className="champ__aide">Exemple Food : 99,90 → 79,90 DH, fidelite 5 %.</p>
          <div className="actions-formulaire">
            <button
              type="button"
              className="bouton bouton--principal"
              disabled={envoi || !g.nom.trim()}
              onClick={async () => {
                setEnvoi(true);
                try {
                  await surEnregistrer(g);
                } finally {
                  setEnvoi(false);
                }
              }}
            >
              {envoi ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button type="button" className="bouton bouton--discret" onClick={surFermer}>
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
