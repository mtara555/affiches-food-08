/**
 * Edition d'un gabarit de balisage 150 × 40 mm : image de fond et zones
 * de texte (repere 450 × 120 px, 3 px/mm).
 */

import { useMemo, useState } from 'react';
import type { CleAxeBalisage, GabaritBalisage } from '../../lib/types';
import { AXES_DEFAUT, CLES_AXES } from '../../rendu/balisage';
import { Apercu } from '../Apercu';
import { ChoixImage, Curseur } from './Reglages';

interface Props {
  readonly gabarit: GabaritBalisage;
  readonly nouveau: boolean;
  readonly surEnregistrer: (g: GabaritBalisage) => Promise<void>;
  readonly surFermer: () => void;
}

export function EditeurBalisage({ gabarit, nouveau, surEnregistrer, surFermer }: Props) {
  const [g, setG] = useState<GabaritBalisage>(gabarit);
  const [envoi, setEnvoi] = useState(false);
  const surcharge = useMemo(() => ({ balisage: g }), [g]);
  const exemple = useMemo(
    () => ({
      code: '',
      gabarit: g.id,
      desFR: 'Pain complet aux céréales',
      desAR: 'خبز كامل بالحبوب',
      ingFR: 'Farine de BLÉ complète, eau, graines de SÉSAME, graines de lin, levure, sel, gluten.',
      ingAR: 'دقيق القمح الكامل، ماء، سمسم، بذور الكتان، خميرة، ملح',
    }),
    [g.id],
  );

  function maj(cle: CleAxeBalisage, champ: 'x' | 'y' | 'w' | 'h' | 'fs', v: number | undefined) {
    setG((x) => {
      const axe = { ...(x.axes[cle] ?? {}) } as Record<string, number>;
      if (v === undefined) delete axe[champ];
      else axe[champ] = v;
      return { ...x, axes: { ...x.axes, [cle]: axe } };
    });
  }

  return (
    <div className="modale" role="dialog" aria-modal="true">
      <div className="modale__carte modale__carte--large editeur editeur--horizontal">
        <div className="editeur__apercu">
          <Apercu type="BALISAGE" element={exemple} largeur={600} surcharge={surcharge} />
        </div>
        <div className="editeur__colonne">
          <h2 className="modale__titre">{nouveau ? 'Nouveau gabarit de balisage' : `Balisage ${g.nom}`}</h2>
          <div className="grille">
            <div className="champ">
              <label htmlFor="nom-ba">Nom</label>
              <input id="nom-ba" type="text" value={g.nom} onChange={(e) => setG({ ...g, nom: e.target.value })} />
            </div>
            <div className="champ">
              <label htmlFor="lib-ba">Bandeau droit (fond dessine)</label>
              <input id="lib-ba" type="text" value={g.libelleDroit} onChange={(e) => setG({ ...g, libelleDroit: e.target.value })} />
            </div>
          </div>
          <ChoixImage
            image={g.image}
            surChange={(image) => setG({ ...g, image })}
            coteMax={1800}
            aide="Diapositive du modele PowerPoint (150 × 40 mm) exportee en image, sans les textes."
          />
          <div className="grille grille--axes">
            {CLES_AXES.map((cle) => {
              const d = AXES_DEFAUT[cle];
              const s = g.axes[cle] ?? {};
              return (
                <fieldset key={cle} className="editeur__groupe">
                  <legend>{d.libelle}</legend>
                  <Curseur libelle="Gauche (px)" valeur={s.x} defaut={d.x} min={0} max={450} pas={1} surChange={(v) => maj(cle, 'x', v)} />
                  <Curseur libelle="Haut (px)" valeur={s.y} defaut={d.y} min={0} max={120} pas={1} surChange={(v) => maj(cle, 'y', v)} />
                  <Curseur libelle="Largeur (px)" valeur={s.w} defaut={d.w} min={10} max={450} pas={1} surChange={(v) => maj(cle, 'w', v)} />
                  <Curseur libelle="Hauteur (px)" valeur={s.h} defaut={d.h} min={8} max={120} pas={1} surChange={(v) => maj(cle, 'h', v)} />
                  <Curseur libelle="Taille" valeur={s.fs} defaut={d.fs} min={4} max={30} pas={0.5} surChange={(v) => maj(cle, 'fs', v)} />
                </fieldset>
              );
            })}
          </div>
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
            <button type="button" className="bouton bouton--discret" onClick={() => setG({ ...g, axes: {} })}>
              Zones par defaut
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
