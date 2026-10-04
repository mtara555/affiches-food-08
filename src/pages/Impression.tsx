import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { Apercu } from '../components/Apercu';
import { ReglagesVrac } from '../components/saisie/ReglagesVrac';
import { notifier } from '../components/Notifications';
import { useDonnees } from '../context/DonneesContext';
import { listerElements, modifierCampagne, obtenirCampagne, reglagesVrac } from '../lib/campagnes';
import type { Campagne, Element } from '../lib/types';
import { FORMATS, FORMATS_ORDONNES, TYPES_CAMPAGNE, type FormatAffiche, type ParametresVrac } from '../config/constants';
import { messageErreur } from '../lib/firebase';
import { tracer } from '../lib/journal';
import { dessinerElement, facteurImpression } from '../rendu';
import { disposerVrac, ouvrir, partager, pdfAffiches, pdfBalisage, pdfEtiquettesA7, pdfVrac, telecharger, type ResultatPdf } from '../rendu/pdf';
import './Impression.css';

const LARGEUR_VIGNETTE = { A7: 150, AFFICHE: 170, BALISAGE: 330, VRAC: 170 } as const;

export function Impression() {
  const { campagneId = '' } = useParams<{ campagneId: string }>();
  const donnees = useDonnees();
  const [campagne, setCampagne] = useState<Campagne | null>(null);
  const [elements, setElements] = useState<Element[]>([]);
  const [exclus, setExclus] = useState<Set<string>>(new Set());
  const [erreur, setErreur] = useState<string | null>(null);
  const [progression, setProgression] = useState<{ fait: number; total: number } | null>(null);
  const [resultat, setResultat] = useState<ResultatPdf | null>(null);

  const charger = useCallback(async () => {
    try {
      const [c, e] = await Promise.all([obtenirCampagne(campagneId), listerElements<Element>(campagneId)]);
      if (!c) setErreur('Campagne introuvable.');
      setCampagne(c);
      setElements(e);
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }, [campagneId]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const selection = useMemo(() => elements.filter((e) => !exclus.has(e.id)), [elements, exclus]);
  const vrac = useMemo(() => (campagne ? reglagesVrac(campagne) : undefined), [campagne]);

  // Enregistre les reglages vrac apres une courte pause (evite une ecriture a chaque frappe).
  const minuteurVrac = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(minuteurVrac.current), []);

  function changerVrac(v: ParametresVrac) {
    if (!campagne) return;
    setResultat(null);
    setCampagne({ ...campagne, largeurMm: v.largeurMm, hauteurMm: v.hauteurMm, avecIngredients: v.avecIngredients });
    window.clearTimeout(minuteurVrac.current);
    const id = campagne.id;
    minuteurVrac.current = window.setTimeout(() => {
      modifierCampagne(id, { largeurMm: v.largeurMm, hauteurMm: v.hauteurMm, avecIngredients: v.avecIngredients }).catch((e) =>
        notifier(messageErreur(e), 'erreur'),
      );
    }, 600);
  }

  function basculer(id: string) {
    setResultat(null);
    setExclus((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function changerFormat(f: FormatAffiche) {
    if (!campagne) return;
    setResultat(null);
    setCampagne({ ...campagne, format: f });
    try {
      await modifierCampagne(campagne.id, { format: f });
    } catch (e) {
      notifier(messageErreur(e), 'erreur');
    }
  }

  async function generer(): Promise<ResultatPdf | null> {
    if (!campagne || !selection.length) return null;
    setResultat(null);
    setProgression({ fait: 0, total: selection.length });
    const k = facteurImpression(campagne.type, campagne.format, vrac);
    const dessiner = (canvas: HTMLCanvasElement, i: number) =>
      dessinerElement(campagne.type, selection[i] as Element, donnees, canvas, k, { signature: true, vrac });
    const suivi = (fait: number, total: number) => setProgression({ fait, total });
    try {
      const r =
        campagne.type === 'A7'
          ? await pdfEtiquettesA7(selection.length, dessiner, campagne.nom, donnees.parametres.piedDePage, suivi)
          : campagne.type === 'VRAC'
            ? await pdfVrac(selection.length, dessiner, campagne.nom, campagne.largeurMm, campagne.hauteurMm, donnees.parametres.piedDePage, suivi)
            : campagne.type === 'AFFICHE'
              ? await pdfAffiches(selection.length, campagne.format, dessiner, campagne.nom, suivi)
              : await pdfBalisage(selection.length, dessiner, campagne.nom, suivi);
      setResultat(r);
      tracer('export', 'impression', `« ${campagne.nom} » : PDF de ${selection.length} element(s), ${r.pages} page(s)`);
      if (campagne.statut === 'brouillon') {
        void modifierCampagne(campagne.id, { statut: 'imprimee' }).catch(() => undefined);
      }
      return r;
    } catch (e) {
      notifier(`Generation du PDF impossible : ${messageErreur(e)}`, 'erreur');
      return null;
    } finally {
      setProgression(null);
    }
  }

  async function action(quoi: 'ouvrir' | 'telecharger' | 'partager') {
    // Fenetre ouverte tout de suite (sinon bloquee apres la generation).
    const fenetre = quoi === 'ouvrir' && !resultat ? window.open('', '_blank') : null;
    const r = resultat ?? (await generer());
    if (!r || !campagne) {
      fenetre?.close();
      return;
    }
    if (quoi === 'ouvrir') ouvrir(r.blob, fenetre);
    else if (quoi === 'telecharger') telecharger(r.blob, r.nomFichier);
    else {
      const texte = `${TYPES_CAMPAGNE[campagne.type].libelle} — ${campagne.nom} (${selection.length} element(s))`;
      const res = await partager(r.blob, r.nomFichier, texte);
      if (res === 'telecharge') notifier('Partage non disponible sur cet appareil : PDF telecharge.', 'info');
    }
  }

  const type = campagne?.type ?? 'A7';
  const parPage =
    type === 'A7'
      ? 4
      : type === 'BALISAGE'
        ? 7
        : type === 'VRAC'
          ? disposerVrac(campagne?.largeurMm ?? 100, campagne?.hauteurMm ?? 140).parPage
          : FORMATS[campagne?.format ?? 'A4'].parPage;
  const largeurVignette =
    type === 'VRAC' && vrac ? Math.round(Math.max(120, Math.min(260, (230 * vrac.largeurMm) / vrac.hauteurMm))) : LARGEUR_VIGNETTE[type];
  const pages = Math.ceil(selection.length / parPage);

  return (
    <AppShell
      large
      titre={campagne ? `Impression — ${campagne.nom}` : 'Impression'}
      sousTitre={campagne ? `${TYPES_CAMPAGNE[campagne.type].libelle} · ${selection.length} / ${elements.length} selectionne(s) · ${pages} page(s)` : ''}
      actions={
        <Link to={`/saisie/${campagneId}`} className="bouton bouton--discret">
          Retour a la saisie
        </Link>
      }
    >
      {erreur ? <p className="bandeau bandeau--erreur">{erreur}</p> : null}

      {campagne ? (
        <>
          <section className="carte impression-barre">
            {campagne.type === 'AFFICHE' ? (
              <div className="champ">
                <label htmlFor="format">Format</label>
                <select id="format" value={campagne.format} onChange={(e) => void changerFormat(e.target.value as FormatAffiche)}>
                  {FORMATS_ORDONNES.map((f) => (
                    <option key={f} value={f}>{FORMATS[f].libelle}</option>
                  ))}
                </select>
              </div>
            ) : campagne.type === 'VRAC' && vrac ? (
              <ReglagesVrac valeur={vrac} surChange={changerVrac} idPrefixe="impression-vrac" />
            ) : (
              <p className="carte__texte">
                {campagne.type === 'A7' ? '4 etiquettes 74 × 105 mm par feuille A4.' : '7 bandes 150 × 40 mm par feuille A4.'}
              </p>
            )}
            <div className="impression-barre__actions">
              <button type="button" className="bouton bouton--principal" disabled={!selection.length || Boolean(progression)} onClick={() => void action('ouvrir')}>
                Ouvrir le PDF / imprimer
              </button>
              <button type="button" className="bouton bouton--discret" disabled={!selection.length || Boolean(progression)} onClick={() => void action('telecharger')}>
                Telecharger
              </button>
              <button type="button" className="bouton bouton--discret" disabled={!selection.length || Boolean(progression)} onClick={() => void action('partager')}>
                Partager (WhatsApp, e-mail…)
              </button>
            </div>
            {progression ? (
              <div className="progression">
                <div className="progression__barre" style={{ width: `${(progression.fait / progression.total) * 100}%` }} />
                <span className="progression__texte">Generation {progression.fait} / {progression.total}</span>
              </div>
            ) : resultat ? (
              <p className="bandeau bandeau--succes" style={{ margin: 0 }}>
                PDF pret : {resultat.nomFichier} ({resultat.pages} page(s)). Imprimez a l&apos;echelle 100 % (« Taille reelle »).
              </p>
            ) : null}
          </section>

          <section className="carte">
            <div className="carte__entete">
              <h2 className="carte__titre">Apercu ({elements.length})</h2>
              <button type="button" className="bouton bouton--discret bouton--petit" onClick={() => { setResultat(null); setExclus(new Set()); }}>
                Tout selectionner
              </button>
              <button type="button" className="bouton bouton--discret bouton--petit" onClick={() => { setResultat(null); setExclus(new Set(elements.map((e) => e.id))); }}>
                Tout deselectionner
              </button>
            </div>
            <div className={`vignettes vignettes--${campagne.type.toLowerCase()}`}>
              {elements.map((e, i) => (
                <label key={e.id} className={`vignette${exclus.has(e.id) ? ' est-exclue' : ''}`}>
                  <input type="checkbox" checked={!exclus.has(e.id)} onChange={() => basculer(e.id)} />
                  <Apercu type={campagne.type} element={e} largeur={largeurVignette} vrac={vrac} titre={`Element ${i + 1}`} />
                  <span className="vignette__legende">{i + 1}. {e.code || '—'}</span>
                </label>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </AppShell>
  );
}
