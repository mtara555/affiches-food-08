/**
 * Reglages d'un picto : taille (coefficient) et suppression du fond blanc,
 * avec apercu en direct (damier = transparence reelle) et sur une vraie affiche.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Picto } from '../../lib/types';
import { useDonnees } from '../../context/DonneesContext';
import { chargerImage } from '../../rendu/commun';
import { dimensionsSource, hauteurEffective, PICTO_TAILLE, PICTO_TOLERANCE, sourcePicto, tailleEffective } from '../../rendu/detourage';
import { Apercu } from '../Apercu';
import { Curseur } from './Reglages';

/** Raccourcis de taille (appliques a la largeur ; la hauteur suit si les proportions sont liees). */
const PRESETS: readonly { libelle: string; valeur: number }[] = [
  { libelle: 'Petit', valeur: 0.7 },
  { libelle: 'Moyen', valeur: 1 },
  { libelle: 'Grand', valeur: 1.4 },
  { libelle: 'Tres grand', valeur: 1.8 },
];

/** Miniature d'un picto telle qu'elle sera imprimee (fond retire ou non), sur damier. */
export function MiniaturePicto({ picto }: { readonly picto: Picto }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const jeton = useRef(0);
  const { id, image, sansFond, tolerance } = picto;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const n = ++jeton.current;
    void sourcePicto({ id, nom: '', image, sansFond, tolerance }).then((src) => {
      if (n !== jeton.current) return; // un dessin plus recent est en cours
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!src) return;
      const { l, h } = dimensionsSource(src);
      const echelle = Math.min(canvas.width / l, canvas.height / h);
      const w = l * echelle;
      const hh = h * echelle;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(src, (canvas.width - w) / 2, (canvas.height - hh) / 2, w, hh);
    });
  }, [id, image, sansFond, tolerance]);

  return <canvas ref={ref} width={300} height={180} className="galerie__picto" role="img" aria-label={picto.nom} />;
}

interface Props {
  readonly picto: Picto;
  readonly surEnregistrer: (p: Picto) => Promise<void>;
  readonly surFermer: () => void;
}

export function EditeurPicto({ picto, surEnregistrer, surFermer }: Props) {
  const d = useDonnees();
  // undefined = valeur par defaut (rien n'est ecrit dans Firestore).
  const [taille, setTaille] = useState<number | undefined>(picto.taille);
  // Proportions liees = la hauteur suit la largeur (aucune hauteur stockee).
  const [lie, setLie] = useState<boolean>(picto.hauteur === undefined);
  const [hauteur, setHauteur] = useState<number | undefined>(picto.hauteur);
  const [sansFond, setSansFond] = useState<boolean>(picto.sansFond === true);
  const [tolerance, setTolerance] = useState<number | undefined>(picto.tolerance);
  const [gabaritId, setGabaritId] = useState<string>(d.gabaritsAffiche[0]?.id ?? '');
  const [envoi, setEnvoi] = useState(false);

  const edite = useMemo<Picto>(
    () => ({
      id: picto.id,
      nom: picto.nom,
      image: picto.image,
      // Les valeurs par defaut ne sont pas stockees : un picto « neutre » reste identique a un ancien picto.
      ...(taille !== undefined && taille !== PICTO_TAILLE.defaut ? { taille } : {}),
      // Hauteur independante : stockee seulement quand les proportions sont deliees.
      ...(!lie ? { hauteur: hauteur ?? PICTO_TAILLE.defaut } : {}),
      ...(sansFond ? { sansFond: true } : {}),
      ...(sansFond && tolerance !== undefined && tolerance !== PICTO_TOLERANCE.defaut ? { tolerance } : {}),
    }),
    [picto.id, picto.nom, picto.image, taille, lie, hauteur, sansFond, tolerance],
  );

  const surcharge = useMemo(() => ({ pictos: new Map(d.mapPictos).set(edite.id, edite) }), [d.mapPictos, edite]);
  const exemple = useMemo(
    () => ({
      code: '6111234567890',
      desFR: 'Exemple produit',
      desAR: 'منتج',
      barre: 29.9,
      promo: 19.9,
      fidelite: 0,
      secteur: 'food' as const,
      picto: edite.id,
      gabarit: gabaritId,
    }),
    [edite.id, gabaritId],
  );

  const pourcent = Math.round(tailleEffective(edite) * 100);
  const pourcentH = Math.round(hauteurEffective(edite) * 100);

  function changerLiaison(lier: boolean) {
    setLie(lier);
    // Deliement : la hauteur part de la valeur courante de la largeur (aucun saut visible).
    if (!lier) setHauteur(taille ?? PICTO_TAILLE.defaut);
  }

  /** Hauteur qui donne au picto les proportions de son image (supprime la deformation). */
  async function proportionsOrigine() {
    const img = await chargerImage(picto.image);
    if (!img || !img.naturalHeight) return;
    const ratioImage = img.naturalWidth / img.naturalHeight;
    const l = taille ?? PICTO_TAILLE.defaut;
    // La boite de base est 5 x 3 : largeur = l, hauteur = h x 3/5 (en unites de largeur de base).
    const h = l / ((3 / 5) * ratioImage);
    setLie(false);
    setHauteur(Math.min(PICTO_TAILLE.max, Math.max(PICTO_TAILLE.min, Math.round(h * 100) / 100)));
  }

  async function enregistrer() {
    setEnvoi(true);
    try {
      await surEnregistrer(edite);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="modale" role="dialog" aria-modal="true">
      <div className="modale__carte modale__carte--large editeur">
        <div className="editeur__colonne">
          <h2 className="modale__titre">Picto « {picto.nom} »</h2>

          <fieldset className="editeur__groupe">
            <legend>Largeur et hauteur</legend>
            <label className="case">
              <input type="checkbox" checked={lie} onChange={(e) => changerLiaison(e.target.checked)} />
              Conserver les proportions (la hauteur suit la largeur)
            </label>
            <Curseur
              libelle="Largeur (1 = taille du gabarit)"
              valeur={taille}
              defaut={PICTO_TAILLE.defaut}
              min={PICTO_TAILLE.min}
              max={PICTO_TAILLE.max}
              pas={PICTO_TAILLE.pas}
              surChange={setTaille}
            />
            {!lie ? (
              <Curseur
                libelle="Hauteur (1 = taille du gabarit)"
                valeur={hauteur}
                defaut={PICTO_TAILLE.defaut}
                min={PICTO_TAILLE.min}
                max={PICTO_TAILLE.max}
                pas={PICTO_TAILLE.pas}
                surChange={setHauteur}
              />
            ) : null}
            <div className="galerie__actions">
              {PRESETS.map((p) => (
                <button
                  key={p.libelle}
                  type="button"
                  className={`bouton bouton--petit ${pourcent === Math.round(p.valeur * 100) ? 'bouton--principal' : 'bouton--discret'}`}
                  onClick={() => setTaille(p.valeur)}
                >
                  {p.libelle} ({Math.round(p.valeur * 100)} %)
                </button>
              ))}
            </div>
            <div className="galerie__actions">
              <button type="button" className="bouton bouton--discret bouton--petit" onClick={() => void proportionsOrigine()}>
                Proportions de l&apos;image d&apos;origine
              </button>
            </div>
            <p className="champ__aide">
              Largeur {pourcent} % · Hauteur {pourcentH} %. S&apos;applique a la boite 5 × 3 reglee dans chaque gabarit d&apos;affiche (onglet Picto), centre
              conserve. Si le picto parait deforme, utilisez « Proportions de l&apos;image d&apos;origine ».
            </p>
          </fieldset>

          <fieldset className="editeur__groupe">
            <legend>Arriere-plan</legend>
            <label className="case">
              <input type="checkbox" checked={sansFond} onChange={(e) => setSansFond(e.target.checked)} />
              Retirer le fond blanc (transparence reelle)
            </label>
            {sansFond ? (
              <>
                <Curseur
                  libelle="Tolerance du blanc"
                  valeur={tolerance}
                  defaut={PICTO_TOLERANCE.defaut}
                  min={PICTO_TOLERANCE.min}
                  max={PICTO_TOLERANCE.max}
                  pas={PICTO_TOLERANCE.pas}
                  surChange={setTolerance}
                />
                <p className="champ__aide">
                  Augmentez si un halo clair reste autour du dessin ; diminuez si des zones claires du dessin disparaissent. Seul le blanc relie au bord de
                  l&apos;image est retire : le blanc a l&apos;interieur du dessin est conserve. L&apos;image d&apos;origine n&apos;est pas modifiee.
                </p>
              </>
            ) : (
              <p className="champ__aide">Le picto est imprime tel quel, avec son fond.</p>
            )}
          </fieldset>

          <div className="actions-formulaire">
            <button type="button" className="bouton bouton--principal" disabled={envoi} onClick={() => void enregistrer()}>
              {envoi ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button type="button" className="bouton bouton--discret" disabled={envoi} onClick={surFermer}>
              Annuler
            </button>
          </div>
        </div>

        <div className="editeur__apercu">
          <strong className="galerie__detail">Picto (damier = transparent)</strong>
          <div style={{ width: 260 }}>
            <MiniaturePicto picto={edite} />
          </div>
          <strong className="galerie__detail">Sur une affiche</strong>
          {d.gabaritsAffiche.length > 1 ? (
            <select value={gabaritId} onChange={(e) => setGabaritId(e.target.value)} aria-label="Gabarit d'affiche pour l'apercu">
              {d.gabaritsAffiche.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nom}
                </option>
              ))}
            </select>
          ) : null}
          <Apercu type="AFFICHE" element={exemple} largeur={260} surcharge={surcharge} titre="Apercu du picto sur une affiche" />
        </div>
      </div>
    </div>
  );
}
