/**
 * Edition d'un gabarit A7 : image de fond (diapositive exportee du modele
 * PowerPoint), positions, tailles et couleurs, avec apercu en direct.
 */

import { useMemo, useState } from 'react';
import type { GabaritA7, LayoutA7 } from '../../lib/types';
import { LAYOUT_A7_DEFAUT } from '../../rendu/a7-layout';
import { GABARITS_A7_FIDELITE } from '../../config/constants';
import { useDonnees } from '../../context/DonneesContext';
import { Apercu } from '../Apercu';
import { ChoixImage, Couleur, Curseur } from './Reglages';

type CleNum = { [K in keyof LayoutA7]-?: LayoutA7[K] extends number | undefined ? K : never }[keyof LayoutA7];
type CleCouleur = 'colDes' | 'colPrix' | 'colUnite' | 'colAllergen' | 'colDrapText';

interface Champ {
  readonly cle: CleNum;
  readonly libelle: string;
  readonly min: number;
  readonly max: number;
  readonly pas: number;
  readonly defaut: number;
}

/** Valeurs de secours du moteur quand le modele PowerPoint ne precise rien. */
const GROUPES: readonly { titre: string; fidelite?: boolean; champs: Champ[] }[] = [
  {
    titre: 'Designations',
    champs: [
      { cle: 'yDesFR', libelle: 'FR — position verticale', min: 0, max: 1, pas: 0.002, defaut: 0.18 },
      { cle: 'fzDesFR', libelle: 'FR — taille', min: 8, max: 48, pas: 0.5, defaut: 24 },
      { cle: 'yDesAR', libelle: 'AR — position verticale', min: 0, max: 1, pas: 0.002, defaut: 0.28 },
      { cle: 'fzDesAR', libelle: 'AR — taille', min: 8, max: 40, pas: 0.5, defaut: 22 },
    ],
  },
  {
    titre: 'Prix et unite',
    champs: [
      { cle: 'priceY', libelle: 'Prix — position verticale', min: 0, max: 1, pas: 0.002, defaut: 0.82 },
      { cle: 'fzPrixInt', libelle: 'Prix — taille entier', min: 16, max: 100, pas: 1, defaut: 68 },
      { cle: 'fzPrixDec', libelle: 'Prix — taille decimales', min: 6, max: 50, pas: 1, defaut: 26 },
      { cle: 'uniteX', libelle: 'Unite — bord droit', min: 0, max: 1, pas: 0.005, defaut: 0.85 },
      { cle: 'uniteY', libelle: 'Unite — position verticale', min: 0, max: 1, pas: 0.002, defaut: 0.78 },
      { cle: 'fzUnite', libelle: 'Unite — taille', min: 6, max: 40, pas: 0.5, defaut: 22 },
    ],
  },
  {
    titre: 'Ingredients',
    champs: [
      { cle: 'ingY', libelle: 'Cadre FR — position verticale', min: 0, max: 1, pas: 0.002, defaut: 0.44 },
      { cle: 'ingBoxX', libelle: 'Cadres — marge gauche (px)', min: 0, max: 60, pas: 0.5, defaut: 5 },
      { cle: 'ingBoxW', libelle: 'Cadres — largeur (px)', min: 100, max: 222, pas: 0.5, defaut: 211.5 },
      { cle: 'ingBoxH', libelle: 'Cadre FR — hauteur (px)', min: 16, max: 120, pas: 0.5, defaut: 50 },
      { cle: 'ingArBoxH', libelle: 'Cadre AR — hauteur (px)', min: 16, max: 120, pas: 0.5, defaut: 50 },
      { cle: 'fzIngFR', libelle: 'FR — taille max', min: 4, max: 16, pas: 0.5, defaut: 11 },
      { cle: 'fzIngAR', libelle: 'AR — taille max', min: 4, max: 16, pas: 0.5, defaut: 11 },
    ],
  },
  {
    titre: 'Zone fidelite (Rectangle 11)',
    fidelite: true,
    champs: [
      { cle: 'fidX', libelle: 'Position horizontale', min: 0, max: 1, pas: 0.002, defaut: 0.6 },
      { cle: 'fidY', libelle: 'Position verticale', min: 0, max: 1, pas: 0.002, defaut: 0.48 },
      { cle: 'fidW', libelle: 'Largeur', min: 0.1, max: 1, pas: 0.002, defaut: 0.38 },
      { cle: 'fidH', libelle: 'Hauteur', min: 0.05, max: 0.6, pas: 0.002, defaut: 0.29 },
      { cle: 'fzFidInt', libelle: 'Taille entier', min: 8, max: 48, pas: 0.5, defaut: 24 },
      { cle: 'fzFidDec', libelle: 'Taille decimales', min: 4, max: 24, pas: 0.5, defaut: 10 },
    ],
  },
  {
    titre: "Drapeau d'origine",
    champs: [
      { cle: 'drapX', libelle: 'Position horizontale', min: 0, max: 1, pas: 0.005, defaut: 0.78 },
      { cle: 'drapY', libelle: 'Position verticale', min: 0, max: 1, pas: 0.002, defaut: 0.03 },
      { cle: 'drapW', libelle: 'Largeur', min: 0.05, max: 0.5, pas: 0.005, defaut: 0.18 },
      { cle: 'drapH', libelle: 'Hauteur', min: 0.02, max: 0.3, pas: 0.002, defaut: 0.055 },
      { cle: 'fzDrapLabel', libelle: 'Taille « Origine : »', min: 4, max: 20, pas: 0.5, defaut: 10 },
      { cle: 'fzDrapName', libelle: 'Taille nom du pays', min: 4, max: 20, pas: 0.5, defaut: 10 },
    ],
  },
];

const COULEURS: readonly { cle: CleCouleur; libelle: string; globale: keyof ReturnType<typeof useDonnees>['parametres']['couleursA7'] | null }[] = [
  { cle: 'colDes', libelle: 'Designations', globale: 'designation' },
  { cle: 'colPrix', libelle: 'Prix', globale: 'prix' },
  { cle: 'colUnite', libelle: 'Unite', globale: 'unite' },
  { cle: 'colAllergen', libelle: 'Allergenes', globale: 'allergen' },
  { cle: 'colDrapText', libelle: 'Texte origine', globale: null },
];

interface Props {
  readonly gabarit: GabaritA7;
  readonly surEnregistrer: (g: GabaritA7) => Promise<void>;
  readonly surFermer: () => void;
}

export function EditeurA7({ gabarit, surEnregistrer, surFermer }: Props) {
  const { parametres } = useDonnees();
  const [g, setG] = useState<GabaritA7>(gabarit);
  const [envoi, setEnvoi] = useState(false);
  const pp = LAYOUT_A7_DEFAUT[g.id] ?? {};
  const fidelite = GABARITS_A7_FIDELITE.includes(g.id);

  const exemple = useMemo(
    () => ({
      code: '2690012000000',
      designationFr: 'CROISSANT PUR BEURRE',
      designationAr: 'كرواسون بالزبدة',
      prix: '3,50',
      unite: 'pièce',
      gabarit: g.id,
      grammage: fidelite ? '1,2' : '',
      fidelite: fidelite ? '10' : '',
      ingredientsFr: 'Farine de BLÉ, beurre (LAIT), sucre, OEUFS, levure, sel, arôme naturel.',
      ingredientsAr: 'دقيق القمح، زبدة، سكر، بيض، خميرة، ملح',
      origine: 'Maroc',
    }),
    [g.id, fidelite],
  );

  const surcharge = useMemo(() => ({ a7: g }), [g]);

  const majLayout = (cle: keyof LayoutA7, v: number | string | undefined) =>
    setG((x) => {
      const layout = { ...x.layout } as Record<string, unknown>;
      if (v === undefined) delete layout[cle];
      else layout[cle] = v;
      return { ...x, layout: layout as LayoutA7 };
    });

  return (
    <div className="modale" role="dialog" aria-modal="true">
      <div className="modale__carte modale__carte--large editeur">
        <div className="editeur__colonne">
          <h2 className="modale__titre">Gabarit A7 {g.id}</h2>
          <div className="champ">
            <label htmlFor="nom-a7">Nom</label>
            <input id="nom-a7" type="text" value={g.nom} onChange={(e) => setG({ ...g, nom: e.target.value })} />
          </div>
          <ChoixImage
            image={g.image}
            surChange={(image) => setG({ ...g, image })}
            coteMax={1600}
            aide="Exportez la diapositive du modele PowerPoint en PNG / JPG (74 × 105 mm, sans les textes). Sans image, un fond simple est dessine."
          />
          {GROUPES.filter((gr) => !gr.fidelite || fidelite).map((gr) => (
            <fieldset key={gr.titre} className="editeur__groupe">
              <legend>{gr.titre}</legend>
              {gr.champs.map((c) => (
                <Curseur
                  key={c.cle}
                  libelle={c.libelle}
                  valeur={g.layout[c.cle] as number | undefined}
                  defaut={(pp[c.cle] as number | undefined) ?? c.defaut}
                  min={c.min}
                  max={c.max}
                  pas={c.pas}
                  surChange={(v) => majLayout(c.cle, v)}
                />
              ))}
            </fieldset>
          ))}
          <fieldset className="editeur__groupe">
            <legend>Couleurs (vide = couleurs globales des Parametres)</legend>
            {COULEURS.map((c) => (
              <Couleur
                key={c.cle}
                libelle={c.libelle}
                valeur={g.layout[c.cle]}
                defaut={c.globale ? parametres.couleursA7[c.globale] : '#000000'}
                surChange={(v) => majLayout(c.cle, v)}
              />
            ))}
          </fieldset>
        </div>
        <div className="editeur__apercu">
          <Apercu type="A7" element={exemple} largeur={290} surcharge={surcharge} />
          <p className="champ__aide">Apercu avec un article d&apos;exemple. Les valeurs en jaune different du modele PowerPoint.</p>
          <div className="actions-formulaire">
            <button
              type="button"
              className="bouton bouton--principal"
              disabled={envoi}
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
            <button type="button" className="bouton bouton--discret" onClick={() => setG({ ...g, layout: {} })}>
              Valeurs PowerPoint
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
