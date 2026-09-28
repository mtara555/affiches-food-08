import { useState, type FormEvent } from 'react';
import { AppShell } from '../components/AppShell';
import { notifier } from '../components/Notifications';
import { useAuth } from '../context/AuthContext';
import { afficherIdentifiant, changerMotDePasse } from '../lib/auth';
import { LIBELLE_ROLE } from '../config/constants';
import { definirNomAppareilLocal, nomAppareilLocal } from '../lib/journal';

export function MonCompte() {
  const { utilisateur } = useAuth();
  const [ancien, setAncien] = useState('');
  const [nouveau, setNouveau] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [appareil, setAppareil] = useState(nomAppareilLocal);

  async function changer(e: FormEvent) {
    e.preventDefault();
    if (nouveau !== confirmation) {
      notifier('Les deux nouveaux mots de passe different.', 'erreur');
      return;
    }
    try {
      await changerMotDePasse(ancien, nouveau);
      notifier('Mot de passe modifie.');
      setAncien('');
      setNouveau('');
      setConfirmation('');
    } catch (err) {
      notifier(err instanceof Error ? err.message : 'Modification impossible.', 'erreur');
    }
  }

  if (!utilisateur) return null;

  return (
    <AppShell titre="Mon compte" sousTitre={`${utilisateur.nom} · ${afficherIdentifiant(utilisateur.email)} · ${LIBELLE_ROLE[utilisateur.role]}`}>
      <section className="carte">
        <h2 className="carte__titre">Changer mon mot de passe</h2>
        <form onSubmit={changer} className="grille">
          <div className="champ">
            <label htmlFor="m-ancien">Mot de passe actuel</label>
            <input id="m-ancien" type="password" autoComplete="current-password" value={ancien} onChange={(e) => setAncien(e.target.value)} />
          </div>
          <div className="champ">
            <label htmlFor="m-nouveau">Nouveau (6 caracteres min.)</label>
            <input id="m-nouveau" type="password" autoComplete="new-password" value={nouveau} onChange={(e) => setNouveau(e.target.value)} />
          </div>
          <div className="champ">
            <label htmlFor="m-conf">Confirmation</label>
            <input id="m-conf" type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
          </div>
          <div className="champ" style={{ justifyContent: 'flex-end' }}>
            <button type="submit" className="bouton bouton--principal" disabled={!ancien || nouveau.length < 6}>Changer</button>
          </div>
        </form>
      </section>
      <section className="carte">
        <h2 className="carte__titre">Cet appareil</h2>
        <div className="formulaire-ligne">
          <div className="champ champ--extensible">
            <label htmlFor="m-app">Nom de l&apos;appareil (journal d&apos;activite)</label>
            <input id="m-app" type="text" maxLength={60} value={appareil} onChange={(e) => setAppareil(e.target.value)} placeholder="PC Decoration, Tel. Karim…" />
          </div>
          <button type="button" className="bouton bouton--discret" onClick={() => { definirNomAppareilLocal(appareil); notifier('Nom enregistre.'); }}>Enregistrer</button>
        </div>
      </section>
    </AppShell>
  );
}
