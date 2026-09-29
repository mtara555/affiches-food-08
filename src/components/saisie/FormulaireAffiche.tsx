/**
 * Saisie d'une affiche promo : code -> designations -> prix barre / promo,
 * secteur Food / Non Food (regle d'economie), fidelite, picto, gabarit.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChampCode } from '../ChampCode';
import { ChampTexte } from '../ChampTexte';
import { Apercu } from '../Apercu';
import { notifier } from '../Notifications';
import { useDonnees } from '../../context/DonneesContext';
import { normaliserCode, trouverArticle } from '../../lib/articles';
import type { ElementAfficheSaisi, Saisie } from '../../lib/types';
import { calculerEconomie } from '../../rendu/affiche';
import { formaterPrix, versNombre } from '../../rendu/commun';
import { messageErreur } from '../../lib/firebase';

interface Props {
  readonly enEdition: ElementAfficheSaisi | null;
  readonly surValider: (s: Saisie<ElementAfficheSaisi>) => Promise<void>;
  readonly surAnnuler: () => void;
}

const CLE_GABARIT = 'affiches-food.dernier-gabarit-affiche';
const CLE_SECTEUR = 'affiches-food.dernier-secteur';

function lire(cle: string, defaut: string): string {
  try {
    return localStorage.getItem(cle) || defaut;
  } catch {
    return defaut;
  }
}

function ecrire(cle: string, v: string) {
  try {
    localStorage.setItem(cle, v);
  } catch {
    /* sans importance */
  }
}

export function FormulaireAffiche({ enEdition, surValider, surAnnuler }: Props) {
  const { parametres, gabaritsAffiche, pictos } = useDonnees();
  const champCode = useRef<HTMLInputElement>(null);
  const champBarre = useRef<HTMLInputElement>(null);

  const [code, setCode] = useState('');
  const [recherche, setRecherche] = useState(false);
  const [statut, setStatut] = useState<'' | 'trouve' | 'inconnu'>('');
  const [desFR, setDesFR] = useState('');
  const [desAR, setDesAR] = useState('');
  const [barre, setBarre] = useState('');
  const [promo, setPromo] = useState('');
  const [fidelite, setFidelite] = useState('');
  const [secteur, setSecteur] = useState<'food' | 'nonfood'>(() => (lire(CLE_SECTEUR, 'food') === 'nonfood' ? 'nonfood' : 'food'));
  const [picto, setPicto] = useState('');
  const [gabarit, setGabarit] = useState(() => lire(CLE_GABARIT, ''));
  const [envoi, setEnvoi] = useState(false);

  const gabaritEffectif = gabaritsAffiche.some((g) => g.id === gabarit) ? gabarit : (gabaritsAffiche[0]?.id ?? '');

  useEffect(() => {
    if (!enEdition) return;
    setCode(enEdition.code);
    setStatut('');
    setDesFR(enEdition.desFR);
    setDesAR(enEdition.desAR);
    setBarre(enEdition.barre ? String(enEdition.barre).replace('.', ',') : '');
    setPromo(enEdition.promo ? String(enEdition.promo).replace('.', ',') : '');
    setFidelite(enEdition.fidelite ? String(enEdition.fidelite) : '');
    setSecteur(enEdition.secteur);
    setPicto(enEdition.picto);
    setGabarit(enEdition.gabarit);
  }, [enEdition]);

  function reinitialiser() {
    setCode('');
    setStatut('');
    setDesFR('');
    setDesAR('');
    setBarre('');
    setPromo('');
    setFidelite('');
    setPicto('');
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
      }
      window.setTimeout(() => champBarre.current?.focus(), 40);
    } catch (e) {
      notifier(messageErreur(e), 'erreur');
    } finally {
      setRecherche(false);
    }
  }

  const saisie = useMemo<Saisie<ElementAfficheSaisi>>(
    () => ({
      code: normaliserCode(code),
      desFR: desFR.trim(),
      desAR: desAR.trim(),
      barre: Math.max(0, versNombre(barre) || 0),
      promo: Math.max(0, versNombre(promo) || 0),
      fidelite: Math.max(0, versNombre(fidelite) || 0),
      secteur,
      picto,
      gabarit: gabaritEffectif,
    }),
    [code, desFR, desAR, barre, promo, fidelite, secteur, picto, gabaritEffectif],
  );

  const eco = calculerEconomie(saisie, parametres);

  async function valider() {
    if (!saisie.desFR && !saisie.desAR) {
      notifier('Saisissez au moins une designation.', 'erreur');
      return;
    }
    if (!(saisie.promo > 0)) {
      notifier('Le prix promo est obligatoire.', 'erreur');
      return;
    }
    setEnvoi(true);
    try {
      await surValider(saisie);
      ecrire(CLE_GABARIT, gabaritEffectif);
      ecrire(CLE_SECTEUR, secteur);
      reinitialiser();
    } catch (e) {
      notifier(messageErreur(e), 'erreur');
    } finally {
      setEnvoi(false);
    }
  }

  const entree = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void valider();
    }
  };

  return (
    <div className="saisie">
      <div className="saisie__formulaire">
        <ChampCode ref={champCode} valeur={code} surChange={(v) => { setCode(v); setStatut(''); }} surRecherche={(v) => void chercher(v)} enRecherche={recherche} etiquette="Code article / gencode" />
        {statut === 'inconnu' ? (
          <p className="bandeau bandeau--alerte">Code absent du catalogue : saisissez la designation manuellement.</p>
        ) : null}

        <div className="grille">
          <ChampTexte id="af-desfr" libelle="Designation FR" valeur={desFR} surChange={setDesFR} maxLength={80} />
          <ChampTexte id="af-desar" libelle="Designation AR" valeur={desAR} surChange={setDesAR} arabe sourceTraduction={desFR} maxLength={80} />
        </div>

        <div className="segments segments--large" role="group" aria-label="Secteur">
          <button type="button" className={`segments__bouton${secteur === 'food' ? ' est-actif' : ''}`} onClick={() => setSecteur('food')}>
            Food · economie des {parametres.seuilEconomieFoodDh} DH
          </button>
          <button type="button" className={`segments__bouton${secteur === 'nonfood' ? ' est-actif' : ''}`} onClick={() => setSecteur('nonfood')}>
            Non Food · economie des {parametres.seuilEconomieNonFoodPct} %
          </button>
        </div>

        <div className="grille-prix">
          <div className="champ">
            <label htmlFor="barre">Prix barre (DH)</label>
            <input ref={champBarre} id="barre" type="text" inputMode="decimal" placeholder="29,90" value={barre} onChange={(e) => setBarre(e.target.value)} />
          </div>
          <div className="champ">
            <label htmlFor="promo">Prix promo (DH)</label>
            <input id="promo" type="text" inputMode="decimal" placeholder="19,90" value={promo} onChange={(e) => setPromo(e.target.value)} onKeyDown={entree} />
          </div>
          <div className="champ">
            <label htmlFor="fid">Fidelite (%)</label>
            <input id="fid" type="text" inputMode="decimal" placeholder="—" value={fidelite} onChange={(e) => setFidelite(e.target.value)} onKeyDown={entree} />
          </div>
          <div className="champ">
            <label htmlFor="gab">Gabarit</label>
            <select id="gab" value={gabaritEffectif} onChange={(e) => setGabarit(e.target.value)}>
              {gabaritsAffiche.map((g) => (
                <option key={g.id} value={g.id}>{g.nom}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="regles-grille">
          <div className={`regle${eco.afficher ? ' est-active' : ''}`}>
            <span className="regle__libelle">Bandeau economie « وفر »</span>
            <span className="regle__valeur">
              {eco.afficher ? `${formaterPrix(eco.ecart)} DH affiche` : eco.ecart > 0 ? `${formaterPrix(eco.ecart)} DH — ${eco.motif}` : 'masque — ' + eco.motif}
            </span>
          </div>
          <div className={`regle${eco.gainFidelite > 0 ? ' est-active' : ''}`}>
            <span className="regle__libelle">Gain fidelite</span>
            <span className="regle__valeur">{eco.gainFidelite > 0 ? `${formaterPrix(eco.gainFidelite)} DH` : 'aucun'}</span>
          </div>
        </div>

        <p className="sous-titre">Picto (5 × 3 cm)</p>
        <div className="choix-pictos">
          <button type="button" className={`choix-picto${picto === '' ? ' est-choisi' : ''}`} onClick={() => setPicto('')}>
            <span>Aucun</span>
          </button>
          {pictos.map((p) => (
            <button type="button" key={p.id} className={`choix-picto${picto === p.id ? ' est-choisi' : ''}`} onClick={() => setPicto(p.id)} title={p.nom}>
              <img src={p.image} alt="" />
              <span>{p.nom}</span>
            </button>
          ))}
        </div>
        {pictos.length === 0 ? <p className="champ__aide">Aucun picto : un administrateur peut en ajouter dans « Gabarits & pictos ».</p> : null}

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
        <p className="sous-titre">Apercu affiche</p>
        <Apercu type="AFFICHE" element={saisie} largeur={300} />
      </div>
    </div>
  );
}
