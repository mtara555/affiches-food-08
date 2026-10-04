import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { useAuth } from '../context/AuthContext';
import { FormulaireA7 } from '../components/saisie/FormulaireA7';
import { FormulaireAffiche } from '../components/saisie/FormulaireAffiche';
import { FormulaireBalisage } from '../components/saisie/FormulaireBalisage';
import { ImportSaisie } from '../components/saisie/ImportSaisie';
import { notifier } from '../components/Notifications';
import {
  ajouterElements,
  listerElements,
  modifierElement,
  obtenirCampagne,
  reglagesVrac,
  reordonner,
  supprimerElement,
} from '../lib/campagnes';
import type { Campagne, Element, ElementA7, ElementAfficheSaisi, ElementBalisage, SaisieElement } from '../lib/types';
import { FORMATS, TYPES_CAMPAGNE } from '../config/constants';
import { messageErreur } from '../lib/firebase';
import { tracer } from '../lib/journal';
import { formaterPrix } from '../rendu/commun';
import './Saisie.css';


/** Resume d'un element pour le tableau. */
function resume(type: Campagne['type'], e: Element): { titre: string; ar: string; prix: string; info: string } {
  if (type === 'A7' || type === 'VRAC') {
    const x = e as ElementA7;
    return { titre: x.designationFr, ar: x.designationAr, prix: `${x.prix} DH / ${x.unite}`, info: `${x.gabarit}${x.fidelite ? ` · fid. ${x.fidelite} %` : ''}` };
  }
  if (type === 'AFFICHE') {
    const x = e as ElementAfficheSaisi;
    return {
      titre: x.desFR,
      ar: x.desAR,
      prix: `${x.barre ? `${formaterPrix(x.barre)} → ` : ''}${formaterPrix(x.promo)} DH`,
      info: `${x.secteur === 'food' ? 'Food' : 'Non Food'} · ${x.gabarit}${x.fidelite ? ` · fid. ${x.fidelite} %` : ''}`,
    };
  }
  const x = e as ElementBalisage;
  return { titre: x.desFR, ar: x.desAR, prix: '—', info: x.gabarit };
}

export function Saisie() {
  const { campagneId = '' } = useParams<{ campagneId: string }>();
  const { utilisateur } = useAuth();
  const [campagne, setCampagne] = useState<Campagne | null>(null);
  const [elements, setElements] = useState<Element[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enEdition, setEnEdition] = useState<Element | null>(null);
  const carte = useRef<HTMLElement>(null);

  const charger = useCallback(async () => {
    try {
      const [c, e] = await Promise.all([obtenirCampagne(campagneId), listerElements<Element>(campagneId)]);
      if (!c) {
        setErreur('Campagne introuvable (supprimee ?).');
        return;
      }
      setCampagne(c);
      setElements(e);
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }, [campagneId]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const valider = useCallback(
    async (s: SaisieElement) => {
      if (!campagne) return;
      if (enEdition) {
        await modifierElement(campagne.id, enEdition.id, s);
        tracer('modification', 'elements', `${campagne.nom} : ${s.code || '—'} modifie`);
        notifier('Modification enregistree.');
        setEnEdition(null);
      } else {
        const dernier = elements.length ? Math.max(...elements.map((e) => e.ordre)) + 1 : 0;
        await ajouterElements(campagne.id, [s], dernier);
        tracer('creation', 'elements', `${campagne.nom} : ${s.code || '—'} ajoute`);
        notifier('Ajoute a la campagne.');
      }
      await charger();
    },
    [campagne, enEdition, elements, charger],
  );

  async function importer(liste: SaisieElement[]) {
    if (!campagne) return;
    const dernier = elements.length ? Math.max(...elements.map((e) => e.ordre)) + 1 : 0;
    await ajouterElements(campagne.id, liste, dernier);
    tracer('creation', 'elements', `${campagne.nom} : import Excel de ${liste.length} element(s)`);
    await charger();
  }

  async function retirer(e: Element) {
    if (!campagne) return;
    try {
      await supprimerElement(campagne.id, e.id);
      tracer('suppression', 'elements', `${campagne.nom} : ${e.code || '—'} retire`);
      if (enEdition?.id === e.id) setEnEdition(null);
      await charger();
    } catch (err) {
      notifier(messageErreur(err), 'erreur');
    }
  }

  async function deplacer(index: number, sens: -1 | 1) {
    if (!campagne) return;
    const cible = index + sens;
    if (cible < 0 || cible >= elements.length) return;
    const nouvel = [...elements];
    const [x] = nouvel.splice(index, 1);
    if (!x) return;
    nouvel.splice(cible, 0, x);
    setElements(nouvel);
    try {
      await reordonner(campagne.id, nouvel.map((e) => e.id), new Map(elements.map((e, i) => [e.id, i])));
      await charger();
    } catch (err) {
      notifier(messageErreur(err), 'erreur');
    }
  }

  function editer(e: Element) {
    setEnEdition(e);
    carte.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const def = campagne ? TYPES_CAMPAGNE[campagne.type] : null;
  const vrac = campagne ? reglagesVrac(campagne) : undefined;
  const sousTitre = campagne && def
    ? `${def.libelle}${campagne.type === 'AFFICHE' ? ` · ${FORMATS[campagne.format].libelle}` : ''}${vrac ? ` · ${vrac.largeurMm} × ${vrac.hauteurMm} mm · ${vrac.avecIngredients ? 'avec' : 'sans'} ingredients` : ''} · ${elements.length} element(s)`
    : '';

  const annuler = () => setEnEdition(null);

  return (
    <AppShell
      large
      titre={campagne?.nom ?? 'Saisie'}
      sousTitre={sousTitre}
      actions={
        <>
          <Link to="/campagnes" className="bouton bouton--discret">Campagnes</Link>
          {elements.length ? (
            <Link to={`/impression/${campagneId}`} className="bouton bouton--principal">
              Apercu & impression ({elements.length})
            </Link>
          ) : null}
        </>
      }
    >
      {erreur ? <p className="bandeau bandeau--erreur" role="alert">{erreur}</p> : null}

      {campagne && utilisateur ? (
        <>
          <section ref={carte} className={`carte${enEdition ? ' carte--edition' : ''}`}>
            <h2 className="carte__titre">{enEdition ? `Modifier l'element ${enEdition.code || ''}` : 'Ajouter un element'}</h2>
            {campagne.type === 'A7' || campagne.type === 'VRAC' ? (
              <FormulaireA7 enEdition={enEdition as ElementA7 | null} auteur={utilisateur.nom} surValider={valider} surAnnuler={annuler} vrac={vrac} />
            ) : campagne.type === 'AFFICHE' ? (
              <FormulaireAffiche enEdition={enEdition as ElementAfficheSaisi | null} surValider={valider} surAnnuler={annuler} />
            ) : (
              <FormulaireBalisage enEdition={enEdition as ElementBalisage | null} surValider={valider} surAnnuler={annuler} />
            )}
          </section>

          <ImportSaisie type={campagne.type} surAjouter={importer} />

          <section className="carte">
            <h2 className="carte__titre">Elements de la campagne ({elements.length})</h2>
            {elements.length === 0 ? (
              <p className="carte__texte carte__texte--discret">Aucun element pour le moment. Scannez un premier article.</p>
            ) : (
              <table className="tableau">
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">Code</th>
                    <th scope="col">Designation</th>
                    <th scope="col">Prix</th>
                    <th scope="col">Details</th>
                    <th scope="col"><span className="visually-hidden">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {elements.map((e, i) => {
                    const r = resume(campagne.type, e);
                    return (
                      <tr key={e.id} className={enEdition?.id === e.id ? 'est-en-edition' : undefined}>
                        <td className="colonne-numero">{i + 1}</td>
                        <th scope="row" className="colonne-code">{e.code || '—'}</th>
                        <td>
                          <span className="cellule-designation">{r.titre || '—'}</span>
                          {r.ar ? <span className="reference texte-arabe" dir="rtl">{r.ar}</span> : null}
                        </td>
                        <td className="colonne-prix colonne-prix--fort">{r.prix}</td>
                        <td>{r.info}</td>
                        <td className="colonne-actions">
                          <button type="button" className="bouton bouton--discret bouton--petit" onClick={() => void deplacer(i, -1)} disabled={i === 0} title="Monter">↑</button>
                          <button type="button" className="bouton bouton--discret bouton--petit" onClick={() => void deplacer(i, 1)} disabled={i === elements.length - 1} title="Descendre">↓</button>
                          <button type="button" className="bouton bouton--discret bouton--petit" onClick={() => editer(e)}>Modifier</button>
                          <button type="button" className="bouton bouton--danger bouton--petit" onClick={() => void retirer(e)}>Retirer</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        </>
      ) : !erreur ? (
        <p className="carte__texte carte__texte--discret">Chargement…</p>
      ) : null}
    </AppShell>
  );
}
