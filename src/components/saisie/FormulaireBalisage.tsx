/**
 * Saisie d'une bande de balisage boulangerie / patisserie (150 × 40 mm).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChampCode } from '../ChampCode';
import { ChampTexte } from '../ChampTexte';
import { Apercu } from '../Apercu';
import { notifier } from '../Notifications';
import { useDonnees } from '../../context/DonneesContext';
import { normaliserCode, trouverArticle } from '../../lib/articles';
import type { ElementBalisage, Saisie } from '../../lib/types';
import { detecterAllergenes } from '../../rendu/allergenes';
import { messageErreur } from '../../lib/firebase';

interface Props {
  readonly enEdition: ElementBalisage | null;
  readonly surValider: (s: Saisie<ElementBalisage>) => Promise<void>;
  readonly surAnnuler: () => void;
}

export function FormulaireBalisage({ enEdition, surValider, surAnnuler }: Props) {
  const { gabaritsBalisage } = useDonnees();
  const champCode = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState('');
  const [recherche, setRecherche] = useState(false);
  const [statut, setStatut] = useState<'' | 'trouve' | 'inconnu'>('');
  const [gabarit, setGabarit] = useState('BOUL');
  const [desFR, setDesFR] = useState('');
  const [desAR, setDesAR] = useState('');
  const [ingFR, setIngFR] = useState('');
  const [ingAR, setIngAR] = useState('');
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    if (!enEdition) return;
    setCode(enEdition.code);
    setStatut('');
    setGabarit(enEdition.gabarit);
    setDesFR(enEdition.desFR);
    setDesAR(enEdition.desAR);
    setIngFR(enEdition.ingFR);
    setIngAR(enEdition.ingAR);
  }, [enEdition]);

  function reinitialiser() {
    setCode('');
    setStatut('');
    setDesFR('');
    setDesAR('');
    setIngFR('');
    setIngAR('');
    window.setTimeout(() => champCode.current?.focus(), 30);
  }

  async function chercher(valeur: string) {
    const c = normaliserCode(valeur);
    if (!c) return;
    setRecherche(true);
    try {
      const a = await trouverArticle(c);
      setStatut(a ? 'trouve' : 'inconnu');
      if (a) {
        setDesFR(a.designationFr);
        setDesAR(a.designationAr);
        setIngFR(a.ingredientsFr);
        setIngAR(a.ingredientsAr);
        const g = a.gabaritA7.toUpperCase();
        if (g.startsWith('PAT')) setGabarit('PAT');
        else if (g === 'BOUL') setGabarit('BOUL');
      }
    } catch (e) {
      notifier(messageErreur(e), 'erreur');
    } finally {
      setRecherche(false);
    }
  }

  const saisie = useMemo<Saisie<ElementBalisage>>(
    () => ({ code: normaliserCode(code), gabarit, desFR: desFR.trim(), desAR: desAR.trim(), ingFR: ingFR.trim(), ingAR: ingAR.trim() }),
    [code, gabarit, desFR, desAR, ingFR, ingAR],
  );
  const allergenes = useMemo(() => detecterAllergenes(ingFR), [ingFR]);

  async function valider() {
    if (!saisie.desFR && !saisie.desAR) {
      notifier('Saisissez au moins la designation FR ou AR.', 'erreur');
      return;
    }
    setEnvoi(true);
    try {
      await surValider(saisie);
      reinitialiser();
    } catch (e) {
      notifier(messageErreur(e), 'erreur');
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="saisie saisie--balisage">
      <div className="saisie__formulaire">
        <ChampCode ref={champCode} valeur={code} surChange={(v) => { setCode(v); setStatut(''); }} surRecherche={(v) => void chercher(v)} enRecherche={recherche} />
        {statut === 'inconnu' ? <p className="bandeau bandeau--alerte">Code absent du catalogue : saisie manuelle.</p> : null}

        <div className="segments segments--large" role="group" aria-label="Gabarit">
          {gabaritsBalisage.map((g) => (
            <button key={g.id} type="button" className={`segments__bouton${gabarit === g.id ? ' est-actif' : ''}`} onClick={() => setGabarit(g.id)}>
              {g.nom}
            </button>
          ))}
        </div>

        <div className="grille">
          <ChampTexte id="ba-desfr" libelle="Designation FR" valeur={desFR} surChange={setDesFR} />
          <ChampTexte id="ba-desar" libelle="Designation AR" valeur={desAR} surChange={setDesAR} arabe sourceTraduction={desFR} />
          <ChampTexte id="ba-ingfr" libelle="Ingredients FR" valeur={ingFR} surChange={setIngFR} multiligne />
          <ChampTexte id="ba-ingar" libelle="Ingredients AR" valeur={ingAR} surChange={setIngAR} multiligne arabe sourceTraduction={ingFR} nature="ingredients" />
        </div>
        {allergenes.length ? (
          <div className="pastilles">
            <span className="champ__aide">Allergenes detectes :</span>
            {allergenes.map((a) => (
              <span className="pastille pastille--allergene" key={a}>{a}</span>
            ))}
          </div>
        ) : null}

        <div className="actions-formulaire">
          <button type="button" className="bouton bouton--principal" onClick={() => void valider()} disabled={envoi}>
            {envoi ? 'Enregistrement…' : enEdition ? 'Enregistrer les modifications' : 'Ajouter a la campagne'}
          </button>
          <button type="button" className="bouton bouton--discret" onClick={() => { reinitialiser(); surAnnuler(); }}>
            {enEdition ? 'Annuler la modification' : 'Effacer'}
          </button>
        </div>
      </div>
      <div className="saisie__apercu">
        <p className="sous-titre">Apercu balisage 150 × 40 mm</p>
        <Apercu type="BALISAGE" element={saisie} largeur={450} />
      </div>
    </div>
  );
}
