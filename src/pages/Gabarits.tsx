import { useState } from 'react';
import { AppShell } from '../components/AppShell';
import { Apercu } from '../components/Apercu';
import { notifier } from '../components/Notifications';
import { EditeurA7 } from '../components/gabarits/EditeurA7';
import { EditeurAffiche } from '../components/gabarits/EditeurAffiche';
import { EditeurBalisage } from '../components/gabarits/EditeurBalisage';
import { useDonnees } from '../context/DonneesContext';
import {
  enregistrerGabaritA7,
  enregistrerGabaritAffiche,
  enregistrerGabaritBalisage,
  enregistrerPicto,
  gabaritsAfficheEnregistres,
  identifiantDepuisNom,
  supprimerGabaritAffiche,
  supprimerGabaritBalisage,
  supprimerPicto,
} from '../lib/gabarits';
import { compresserImage, poids } from '../lib/images';
import type { GabaritA7, GabaritAffiche, GabaritBalisage } from '../lib/types';
import { elementsParDefaut } from '../rendu/affiche';
import { GABARITS_A7_FIDELITE } from '../config/constants';
import { messageErreur } from '../lib/firebase';
import { tracer } from '../lib/journal';
import './Gabarits.css';

type Onglet = 'A7' | 'AFFICHE' | 'BALISAGE' | 'PICTOS';

const ONGLETS: readonly { cle: Onglet; libelle: string }[] = [
  { cle: 'A7', libelle: 'Etiquettes A7' },
  { cle: 'AFFICHE', libelle: 'Affiches' },
  { cle: 'BALISAGE', libelle: 'Balisage' },
  { cle: 'PICTOS', libelle: 'Pictos' },
];

const exempleA7 = (g: GabaritA7) => ({
  code: '2690012000000',
  designationFr: 'CROISSANT PUR BEURRE',
  designationAr: 'كرواسون بالزبدة',
  prix: '3,50',
  unite: 'pièce',
  gabarit: g.id,
  grammage: '',
  fidelite: GABARITS_A7_FIDELITE.includes(g.id) ? '10' : '',
  ingredientsFr: 'Farine de BLÉ, beurre (LAIT), sucre, OEUFS, levure, sel.',
  ingredientsAr: 'دقيق القمح، زبدة، سكر، بيض، خميرة، ملح',
  origine: '',
});

export function Gabarits() {
  const d = useDonnees();
  const [onglet, setOnglet] = useState<Onglet>('A7');
  const [a7, setA7] = useState<GabaritA7 | null>(null);
  const [affiche, setAffiche] = useState<{ g: GabaritAffiche; nouveau: boolean } | null>(null);
  const [balisage, setBalisage] = useState<{ g: GabaritBalisage; nouveau: boolean } | null>(null);
  const [envoiPicto, setEnvoiPicto] = useState(false);

  async function executer(action: () => Promise<unknown>, message: string, journal: string) {
    try {
      await action();
      tracer('modification', 'gabarits', journal);
      notifier(message);
      await d.recharger();
      return true;
    } catch (e) {
      notifier(messageErreur(e), 'erreur');
      return false;
    }
  }

  async function enregistrerAffiche(g: GabaritAffiche) {
    // Premier enregistrement : les gabarits par defaut (encore virtuels) sont
    // enregistres aussi, sinon ils disparaitraient de la liste.
    const ok = await executer(
      async () => {
        if (!(await gabaritsAfficheEnregistres())) {
          await Promise.all(d.gabaritsAffiche.filter((x) => x.id !== g.id).map((x) => enregistrerGabaritAffiche(x)));
        }
        await enregistrerGabaritAffiche(g);
      },
      'Gabarit d’affiche enregistre.',
      `Gabarit affiche « ${g.nom} » enregistre`,
    );
    if (ok) setAffiche(null);
  }

  function nouvelleAffiche() {
    const nom = window.prompt('Nom du nouveau gabarit :', 'PROMO SPECIALE');
    if (!nom?.trim()) return;
    const id = identifiantDepuisNom(nom);
    if (d.gabaritsAffiche.some((g) => g.id === id)) {
      notifier('Un gabarit porte deja ce nom.', 'erreur');
      return;
    }
    setAffiche({
      nouveau: true,
      g: { id, nom: nom.trim().toUpperCase(), bg: '#991b1b', bg2: '#7f1d1d', image: null, logo: false, els: elementsParDefaut(), ordre: d.gabaritsAffiche.length + 1 },
    });
  }

  function nouveauBalisage() {
    const nom = window.prompt('Nom du nouveau gabarit de balisage :', 'VIENNOISERIE');
    if (!nom?.trim()) return;
    const id = identifiantDepuisNom(nom);
    if (d.gabaritsBalisage.some((g) => g.id === id)) {
      notifier('Un gabarit porte deja ce nom.', 'erreur');
      return;
    }
    setBalisage({ nouveau: true, g: { id, nom: nom.trim().toUpperCase(), image: null, axes: {}, libelleDroit: 'Allergènes', ordre: d.gabaritsBalisage.length + 1 } });
  }

  async function ajouterPictos(fichiers: FileList) {
    setEnvoiPicto(true);
    try {
      for (const f of Array.from(fichiers)) {
        const image = await compresserImage(f, 600, true);
        const nom = f.name.replace(/\.[^.]+$/, '').slice(0, 30);
        await enregistrerPicto({ id: `${identifiantDepuisNom(nom)}_${Date.now().toString(36)}`, nom, image });
      }
      tracer('creation', 'gabarits', `${fichiers.length} picto(s) ajoute(s)`);
      notifier(`${fichiers.length} picto(s) ajoute(s).`);
      await d.recharger();
    } catch (e) {
      notifier(messageErreur(e), 'erreur');
    } finally {
      setEnvoiPicto(false);
    }
  }

  return (
    <AppShell large titre="Gabarits & pictos" sousTitre="Fonds, positions et couleurs communs a tous les postes">
      <div className="segments segments--large onglets">
        {ONGLETS.map((o) => (
          <button key={o.cle} type="button" className={`segments__bouton${onglet === o.cle ? ' est-actif' : ''}`} onClick={() => setOnglet(o.cle)}>
            {o.libelle}
          </button>
        ))}
      </div>

      {onglet === 'A7' ? (
        <section className="carte">
          <p className="carte__texte">
            13 gabarits issus du modele PowerPoint. Ajoutez l&apos;image de fond de chaque diapositive, puis ajustez si besoin.
            Le choix du gabarit se fait par la fiche article, puis par le prefixe du code (Parametres).
          </p>
          <div className="galerie">
            {d.gabaritsA7.map((g) => (
              <button key={g.id} type="button" className="galerie__carte" onClick={() => setA7(g)}>
                <Apercu type="A7" element={exempleA7(g)} largeur={140} />
                <span className="galerie__nom">{g.id}</span>
                <span className="galerie__detail">{g.nom}{g.image ? ` · fond ${poids(g.image)}` : ' · sans fond'}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {onglet === 'AFFICHE' ? (
        <section className="carte">
          <div className="carte__entete">
            <p className="carte__texte">Les affiches A3 et A5 reprennent la mise en page A4 a l&apos;echelle.</p>
            <button type="button" className="bouton bouton--principal" onClick={nouvelleAffiche}>Nouveau gabarit</button>
          </div>
          <div className="galerie">
            {d.gabaritsAffiche.map((g) => (
              <div key={g.id} className="galerie__carte">
                <button type="button" className="galerie__bouton" onClick={() => setAffiche({ g, nouveau: false })}>
                  <Apercu
                    type="AFFICHE"
                    element={{ code: '6111234567890', desFR: 'Exemple produit', desAR: 'منتج', barre: 29.9, promo: 19.9, fidelite: 0, secteur: 'food', picto: '', gabarit: g.id }}
                    largeur={150}
                  />
                  <span className="galerie__nom">{g.nom}</span>
                </button>
                {d.gabaritsAffiche.length > 1 ? (
                  <button
                    type="button"
                    className="bouton bouton--danger bouton--petit"
                    onClick={() => {
                      if (window.confirm(`Supprimer le gabarit « ${g.nom} » ?`)) {
                        void executer(
                          async () => {
                            if (!(await gabaritsAfficheEnregistres())) {
                              await Promise.all(d.gabaritsAffiche.filter((x) => x.id !== g.id).map((x) => enregistrerGabaritAffiche(x)));
                            }
                            await supprimerGabaritAffiche(g.id);
                          },
                          'Gabarit supprime.',
                          `Gabarit affiche « ${g.nom} » supprime`,
                        );
                      }
                    }}
                  >
                    Supprimer
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {onglet === 'BALISAGE' ? (
        <section className="carte">
          <div className="carte__entete">
            <p className="carte__texte">Bandes 150 × 40 mm. BOULANGERIE et PATISSERIE sont toujours disponibles.</p>
            <button type="button" className="bouton bouton--principal" onClick={nouveauBalisage}>Nouveau gabarit</button>
          </div>
          <div className="galerie galerie--balisage">
            {d.gabaritsBalisage.map((g) => (
              <div key={g.id} className="galerie__carte">
                <button type="button" className="galerie__bouton" onClick={() => setBalisage({ g, nouveau: false })}>
                  <Apercu type="BALISAGE" element={{ code: '', gabarit: g.id, desFR: 'Baguette tradition', desAR: 'خبز تقليدي', ingFR: 'Farine de BLÉ, eau, levain, sel.', ingAR: 'دقيق القمح، ماء، خميرة، ملح' }} largeur={360} />
                  <span className="galerie__nom">{g.nom}</span>
                </button>
                {g.id !== 'BOUL' && g.id !== 'PAT' ? (
                  <button
                    type="button"
                    className="bouton bouton--danger bouton--petit"
                    onClick={() => {
                      if (window.confirm(`Supprimer le gabarit « ${g.nom} » ?`)) {
                        void executer(() => supprimerGabaritBalisage(g.id), 'Gabarit supprime.', `Gabarit balisage « ${g.nom} » supprime`);
                      }
                    }}
                  >
                    Supprimer
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {onglet === 'PICTOS' ? (
        <section className="carte">
          <div className="carte__entete">
            <p className="carte__texte">Pictos des affiches (format 5 × 3 cm). PNG detoure conseille.</p>
            <label className={`bouton bouton--principal${envoiPicto ? ' est-desactive' : ''}`}>
              {envoiPicto ? 'Envoi…' : 'Ajouter des pictos'}
              <input type="file" accept="image/png,image/jpeg,image/webp" multiple className="visually-hidden" onChange={(e) => { const f = e.target.files; if (f?.length) void ajouterPictos(f); e.target.value = ''; }} />
            </label>
          </div>
          {d.pictos.length === 0 ? <p className="carte__texte carte__texte--discret">Aucun picto.</p> : null}
          <div className="galerie galerie--pictos">
            {d.pictos.map((p) => (
              <div key={p.id} className="galerie__carte">
                <img src={p.image} alt="" className="galerie__picto" />
                <span className="galerie__nom">{p.nom}</span>
                <div className="galerie__actions">
                  <button
                    type="button"
                    className="bouton bouton--discret bouton--petit"
                    onClick={() => {
                      const nom = window.prompt('Nouveau nom :', p.nom);
                      if (nom?.trim()) void executer(() => enregistrerPicto({ ...p, nom: nom.trim() }), 'Picto renomme.', `Picto « ${p.nom} » renomme « ${nom} »`);
                    }}
                  >
                    Renommer
                  </button>
                  <button
                    type="button"
                    className="bouton bouton--danger bouton--petit"
                    onClick={() => {
                      if (window.confirm(`Supprimer le picto « ${p.nom} » ?`)) void executer(() => supprimerPicto(p.id), 'Picto supprime.', `Picto « ${p.nom} » supprime`);
                    }}
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {a7 ? (
        <EditeurA7
          gabarit={a7}
          surFermer={() => setA7(null)}
          surEnregistrer={async (g) => {
            if (await executer(() => enregistrerGabaritA7(g), 'Gabarit A7 enregistre.', `Gabarit A7 ${g.id} enregistre`)) setA7(null);
          }}
        />
      ) : null}
      {affiche ? (
        <EditeurAffiche gabarit={affiche.g} nouveau={affiche.nouveau} surFermer={() => setAffiche(null)} surEnregistrer={enregistrerAffiche} />
      ) : null}
      {balisage ? (
        <EditeurBalisage
          gabarit={balisage.g}
          nouveau={balisage.nouveau}
          surFermer={() => setBalisage(null)}
          surEnregistrer={async (g) => {
            if (await executer(() => enregistrerGabaritBalisage(g), 'Gabarit de balisage enregistre.', `Gabarit balisage ${g.id} enregistre`)) setBalisage(null);
          }}
        />
      ) : null}
    </AppShell>
  );
}
