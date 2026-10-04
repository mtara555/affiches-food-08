/**
 * Saisie d'une etiquette A7 : code -> fiche article -> prix -> Entree.
 * Enchainement clavier identique a l'ancienne application (douchette + Entree).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChampCode } from '../ChampCode';
import { ChampTexte } from '../ChampTexte';
import { Apercu } from '../Apercu';
import { notifier } from '../Notifications';
import { useDonnees } from '../../context/DonneesContext';
import { enregistrerArticle, gabaritA7Pour, normaliserCode, trouverArticle } from '../../lib/articles';
import type { Article, ElementA7, Saisie } from '../../lib/types';
import { GABARITS_A7_FIDELITE, UNITES, type ParametresVrac } from '../../config/constants';
import { formaterPrix, versNombre } from '../../rendu/commun';
import { detecterAllergenes } from '../../rendu/allergenes';
import { messageErreur } from '../../lib/firebase';

interface Props {
  readonly enEdition: ElementA7 | null;
  readonly auteur: string;
  readonly surValider: (s: Saisie<ElementA7>) => Promise<void>;
  readonly surAnnuler: () => void;
  /** Campagne « vrac » : dimensions personnalisees, avec ou sans ingredients (sinon A7). */
  readonly vrac?: ParametresVrac;
}

const CLE_UNITE = 'affiches-food.derniere-unite';

function uniteMemorisee(): string {
  try {
    return localStorage.getItem(CLE_UNITE) || 'pièce';
  } catch {
    return 'pièce';
  }
}

export function FormulaireA7({ enEdition, auteur, surValider, surAnnuler, vrac }: Props) {
  const { parametres, gabaritsA7 } = useDonnees();
  const champCode = useRef<HTMLInputElement>(null);
  const champPrix = useRef<HTMLInputElement>(null);

  const [code, setCode] = useState('');
  const [article, setArticle] = useState<Article | null>(null);
  const [recherche, setRecherche] = useState(false);
  const [introuvable, setIntrouvable] = useState(false);
  const [ajouterAuCatalogue, setAjouterAuCatalogue] = useState(true);

  const [designationFr, setDesignationFr] = useState('');
  const [designationAr, setDesignationAr] = useState('');
  const [ingredientsFr, setIngredientsFr] = useState('');
  const [ingredientsAr, setIngredientsAr] = useState('');
  const [origine, setOrigine] = useState('');
  const [prix, setPrix] = useState('');
  const [unite, setUnite] = useState(uniteMemorisee);
  const [gabaritChoisi, setGabaritChoisi] = useState('');
  const [grammage, setGrammage] = useState('');
  const [fidelite, setFidelite] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [details, setDetails] = useState(false);

  const gabaritAuto = gabaritA7Pour(normaliserCode(code), article ?? { gabaritA7: '', designationFr }, parametres.mapping);
  const gabarit = gabaritChoisi || gabaritAuto;
  const avecFidelite = GABARITS_A7_FIDELITE.includes(gabarit);
  const sansIngredients = vrac ? !vrac.avecIngredients : false;

  function remplirDepuis(a: Article | null) {
    setDesignationFr(a?.designationFr ?? '');
    setDesignationAr(a?.designationAr ?? '');
    setIngredientsFr(a?.ingredientsFr ?? '');
    setIngredientsAr(a?.ingredientsAr ?? '');
    setOrigine(a?.origine ?? '');
  }

  function reinitialiser() {
    setCode('');
    setArticle(null);
    setIntrouvable(false);
    remplirDepuis(null);
    setPrix('');
    setGabaritChoisi('');
    setGrammage('');
    setFidelite('');
    setDetails(false);
    window.setTimeout(() => champCode.current?.focus(), 30);
  }

  // Chargement d'un element a corriger.
  useEffect(() => {
    if (!enEdition) return;
    setCode(enEdition.code);
    setArticle(null);
    setIntrouvable(false);
    setDesignationFr(enEdition.designationFr);
    setDesignationAr(enEdition.designationAr);
    setIngredientsFr(enEdition.ingredientsFr);
    setIngredientsAr(enEdition.ingredientsAr);
    setOrigine(enEdition.origine);
    setPrix(enEdition.prix);
    setUnite(enEdition.unite);
    setGabaritChoisi(enEdition.gabarit);
    setGrammage(enEdition.grammage);
    setFidelite(enEdition.fidelite);
    setDetails(true);
  }, [enEdition]);

  async function chercher(valeur: string) {
    const c = normaliserCode(valeur);
    if (!c) return;
    setRecherche(true);
    try {
      const a = await trouverArticle(c);
      setArticle(a);
      setIntrouvable(!a);
      remplirDepuis(a);
      setGabaritChoisi('');
      if (!a) setDetails(true);
      window.setTimeout(() => (a ? champPrix.current : null)?.focus(), 40);
    } catch (e) {
      notifier(messageErreur(e), 'erreur');
    } finally {
      setRecherche(false);
    }
  }

  const saisie = useMemo<Saisie<ElementA7>>(
    () => ({
      code: normaliserCode(code),
      designationFr,
      designationAr,
      ingredientsFr,
      ingredientsAr,
      origine,
      prix: formaterPrix(prix),
      unite,
      gabarit,
      grammage: avecFidelite ? grammage.trim() : '',
      fidelite: fidelite.trim(),
    }),
    [code, designationFr, designationAr, ingredientsFr, ingredientsAr, origine, prix, unite, gabarit, grammage, fidelite, avecFidelite],
  );

  const allergenes = useMemo(() => detecterAllergenes(ingredientsFr), [ingredientsFr]);
  const gain = versNombre(prix) > 0 && versNombre(fidelite) > 0 ? (versNombre(prix) * versNombre(fidelite)) / 100 : 0;

  async function valider() {
    if (!saisie.code) {
      notifier('Scannez ou saisissez un code article.', 'erreur');
      champCode.current?.focus();
      return;
    }
    if (!(versNombre(prix) > 0)) {
      notifier('Saisissez un prix valide.', 'erreur');
      champPrix.current?.focus();
      return;
    }
    setEnvoi(true);
    try {
      if (introuvable && ajouterAuCatalogue && designationFr.trim()) {
        await enregistrerArticle(
          { code: saisie.code, designationFr, designationAr, ingredientsFr, ingredientsAr, origine, colJ: '', gabaritA7: gabaritChoisi },
          auteur,
        );
      }
      await surValider(saisie);
      try {
        localStorage.setItem(CLE_UNITE, unite);
      } catch {
        /* sans importance */
      }
      reinitialiser();
    } catch (e) {
      notifier(messageErreur(e), 'erreur');
    } finally {
      setEnvoi(false);
    }
  }

  const aDesDonnees = Boolean(saisie.code);
  // Apercu : 250 px de large (portrait) ; limite en hauteur pour les formats paysage ou tres hauts.
  const largeurApercu = vrac ? Math.round(Math.max(140, Math.min(250, (360 * vrac.largeurMm) / vrac.hauteurMm))) : 250;

  return (
    <div className="saisie">
      <div className="saisie__formulaire">
        <ChampCode ref={champCode} valeur={code} surChange={(v) => { setCode(v); setArticle(null); setIntrouvable(false); }} surRecherche={(v) => void chercher(v)} enRecherche={recherche} />

        {article ? (
          <div className="fiche-article">
            <div className="fiche-article__entete">
              <span className="fiche-article__marque">Article trouve · gabarit {gabarit}</span>
              <span className="fiche-article__designation">{article.designationFr || '—'}</span>
              {article.designationAr ? <span className="fiche-article__reference texte-arabe" dir="rtl">{article.designationAr}</span> : null}
            </div>
            {allergenes.length && !sansIngredients ? (
              <div className="pastilles">
                {allergenes.map((a) => (
                  <span className="pastille pastille--allergene" key={a}>{a}</span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {introuvable ? (
          <p className="bandeau bandeau--alerte">
            Code inconnu du catalogue : completez la designation ci-dessous.
            <label className="case case--inline">
              <input type="checkbox" checked={ajouterAuCatalogue} onChange={(e) => setAjouterAuCatalogue(e.target.checked)} />
              Enregistrer aussi cet article dans le catalogue
            </label>
          </p>
        ) : null}

        <div className="grille-prix">
          <div className="champ">
            <label htmlFor="prix">Prix (DH)</label>
            <input
              ref={champPrix}
              id="prix"
              type="text"
              inputMode="decimal"
              placeholder="12,50"
              value={prix}
              onChange={(e) => setPrix(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void valider();
                }
              }}
            />
          </div>
          <div className="champ">
            <label htmlFor="unite">Unite</label>
            <select id="unite" value={unite} onChange={(e) => setUnite(e.target.value)}>
              {UNITES.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          <div className="champ">
            <label htmlFor="gabarit">Gabarit</label>
            <select id="gabarit" value={gabaritChoisi} onChange={(e) => setGabaritChoisi(e.target.value)}>
              <option value="">Automatique ({gabaritAuto})</option>
              {gabaritsA7.map((g) => (
                <option key={g.id} value={g.id}>{g.id} — {g.nom}</option>
              ))}
            </select>
          </div>
          <div className="champ">
            <label htmlFor="fidelite">Fidelite (%)</label>
            <input id="fidelite" type="text" inputMode="decimal" placeholder="—" value={fidelite} onChange={(e) => setFidelite(e.target.value)} />
            {gain > 0 ? <p className="champ__aide">Gain client : {formaterPrix(gain)} DH</p> : null}
          </div>
          {avecFidelite ? (
            <div className="champ">
              <label htmlFor="grammage">Poids (kg)</label>
              <input id="grammage" type="text" inputMode="decimal" placeholder="1,2" value={grammage} onChange={(e) => setGrammage(e.target.value)} />
            </div>
          ) : null}
        </div>

        <button type="button" className="lien-bouton lien-bouton--discret" onClick={() => setDetails((d) => !d)}>
          {details ? 'Masquer' : 'Modifier'} designations{sansIngredients ? '' : ', ingredients'} et origine
        </button>

        {details ? (
          <div className="grille grille--details">
            <ChampTexte id="a7-desfr" libelle="Designation FR" valeur={designationFr} surChange={setDesignationFr} maxLength={60} />
            <ChampTexte id="a7-desar" libelle="Designation AR" valeur={designationAr} surChange={setDesignationAr} arabe sourceTraduction={designationFr} maxLength={60} />
            {sansIngredients ? null : (
              <>
                <ChampTexte id="a7-ingfr" libelle="Ingredients FR" valeur={ingredientsFr} surChange={setIngredientsFr} multiligne />
                <ChampTexte id="a7-ingar" libelle="Ingredients AR" valeur={ingredientsAr} surChange={setIngredientsAr} multiligne arabe sourceTraduction={ingredientsFr} nature="ingredients" />
              </>
            )}
            <ChampTexte id="a7-origine" libelle="Origine (pays)" valeur={origine} surChange={setOrigine} placeholder="France, Maroc…" />
          </div>
        ) : null}

        <div className="actions-formulaire">
          <button type="button" className="bouton bouton--principal" onClick={() => void valider()} disabled={envoi || !aDesDonnees}>
            {envoi ? 'Enregistrement…' : enEdition ? 'Enregistrer les modifications' : 'Ajouter a la campagne'}
          </button>
          <button type="button" className="bouton bouton--discret" onClick={() => { reinitialiser(); surAnnuler(); }}>
            {enEdition ? 'Annuler la modification' : 'Effacer'}
          </button>
        </div>
      </div>

      <div className="saisie__apercu">
        <p className="sous-titre">{vrac ? `Apercu vrac ${vrac.largeurMm} × ${vrac.hauteurMm} mm` : 'Apercu A7'} · {gabarit}</p>
        {aDesDonnees ? (
          <Apercu type={vrac ? 'VRAC' : 'A7'} element={saisie} largeur={largeurApercu} vrac={vrac} />
        ) : (
          <div className="apercu-vide apercu-vide--a7" style={{ width: largeurApercu, aspectRatio: vrac ? `${vrac.largeurMm} / ${vrac.hauteurMm}` : undefined }}>
            Scannez un article
          </div>
        )}
      </div>
    </div>
  );
}
