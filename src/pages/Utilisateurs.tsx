import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AppShell } from '../components/AppShell';
import { notifier } from '../components/Notifications';
import { useAuth } from '../context/AuthContext';
import { creerUtilisateur, listerUtilisateurs, modifierUtilisateur, type FicheUtilisateur } from '../lib/utilisateurs';
import { afficherIdentifiant, envoyerReinitialisation } from '../lib/auth';
import { DOMAINE_IDENTIFIANT, LIBELLE_ROLE } from '../config/constants';
import { messageErreur } from '../lib/firebase';
import { tracer } from '../lib/journal';

export function Utilisateurs() {
  const { utilisateur } = useAuth();
  const [liste, setListe] = useState<FicheUtilisateur[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [nom, setNom] = useState('');
  const [identifiant, setIdentifiant] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [role, setRole] = useState<'operateur' | 'administrateur'>('operateur');
  const [envoi, setEnvoi] = useState(false);

  const charger = useCallback(async () => {
    try {
      setListe(await listerUtilisateurs());
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  async function creer(e: FormEvent) {
    e.preventDefault();
    if (motDePasse.length < 6) {
      notifier('Mot de passe : 6 caracteres minimum.', 'erreur');
      return;
    }
    setEnvoi(true);
    try {
      await creerUtilisateur(nom || identifiant, identifiant, motDePasse, role);
      tracer('creation', 'utilisateurs', `Compte « ${nom || identifiant} » (${identifiant}) cree, role ${role}`);
      notifier(`Compte cree. Communiquez l'identifiant « ${identifiant} » et le mot de passe.`);
      setNom('');
      setIdentifiant('');
      setMotDePasse('');
      await charger();
    } catch (err) {
      notifier(messageErreur(err), 'erreur');
    } finally {
      setEnvoi(false);
    }
  }

  async function maj(u: FicheUtilisateur, champs: Partial<Pick<FicheUtilisateur, 'role' | 'actif' | 'nom'>>, journal: string) {
    try {
      await modifierUtilisateur(u.id, champs);
      tracer('modification', 'utilisateurs', journal);
      await charger();
    } catch (e) {
      notifier(messageErreur(e), 'erreur');
    }
  }

  async function reinitialiser(u: FicheUtilisateur) {
    if (u.email.endsWith(`@${DOMAINE_IDENTIFIANT}`)) {
      notifier("Identifiant sans e-mail : desactivez ce compte puis recreez-le avec un nouveau mot de passe.", 'info');
      return;
    }
    try {
      await envoyerReinitialisation(u.email);
      notifier(`E-mail de reinitialisation envoye a ${u.email}.`);
    } catch (e) {
      notifier(messageErreur(e), 'erreur');
    }
  }

  return (
    <AppShell titre="Utilisateurs" sousTitre="Comptes et roles — operateurs : saisie et impression ; administrateurs : tout">
      {erreur ? <p className="bandeau bandeau--erreur">{erreur}</p> : null}

      <section className="carte">
        <h2 className="carte__titre">Nouveau compte</h2>
        <form onSubmit={creer}>
          <div className="grille">
            <div className="champ">
              <label htmlFor="u-nom">Nom affiche</label>
              <input id="u-nom" type="text" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Karim B." />
            </div>
            <div className="champ">
              <label htmlFor="u-id">Identifiant ou e-mail</label>
              <input id="u-id" type="text" autoCapitalize="none" value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} placeholder="karim" required />
            </div>
            <div className="champ">
              <label htmlFor="u-mdp">Mot de passe initial</label>
              <input id="u-mdp" type="text" autoComplete="new-password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} placeholder="6 caracteres minimum" required />
            </div>
            <div className="champ">
              <label htmlFor="u-role">Role</label>
              <select id="u-role" value={role} onChange={(e) => setRole(e.target.value as 'operateur' | 'administrateur')}>
                <option value="operateur">Operateur</option>
                <option value="administrateur">Administrateur</option>
              </select>
            </div>
          </div>
          <button type="submit" className="bouton bouton--principal" disabled={envoi || !identifiant}>
            {envoi ? 'Creation…' : 'Creer le compte'}
          </button>
        </form>
      </section>

      <section className="carte">
        <h2 className="carte__titre">Comptes ({liste.length})</h2>
        <table className="tableau">
          <thead>
            <tr>
              <th scope="col">Nom</th>
              <th scope="col">Identifiant</th>
              <th scope="col">Role</th>
              <th scope="col">Etat</th>
              <th scope="col"><span className="visually-hidden">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {liste.map((u) => {
              const moi = u.id === utilisateur?.id;
              return (
                <tr key={u.id} className={u.actif ? undefined : 'est-inactif'}>
                  <th scope="row" style={{ fontFamily: 'var(--font-ui)' }}>{u.nom}{moi ? ' (vous)' : ''}</th>
                  <td>{afficherIdentifiant(u.email)}</td>
                  <td>
                    <select
                      className="recherche"
                      style={{ minWidth: 0, marginLeft: 0 }}
                      value={u.role}
                      disabled={moi}
                      onChange={(e) => void maj(u, { role: e.target.value as FicheUtilisateur['role'] }, `Role de ${u.nom} : ${e.target.value}`)}
                    >
                      <option value="operateur">{LIBELLE_ROLE.operateur}</option>
                      <option value="administrateur">{LIBELLE_ROLE.administrateur}</option>
                    </select>
                  </td>
                  <td>{u.actif ? <span className="etiquette etiquette--ok">actif</span> : <span className="etiquette etiquette--inactive">desactive</span>}</td>
                  <td className="colonne-actions">
                    <button type="button" className="bouton bouton--discret bouton--petit" onClick={() => {
                      const n = window.prompt('Nom affiche :', u.nom);
                      if (n?.trim()) void maj(u, { nom: n.trim() }, `${u.nom} renomme ${n.trim()}`);
                    }}>Renommer</button>
                    <button type="button" className="bouton bouton--discret bouton--petit" onClick={() => void reinitialiser(u)}>Mot de passe</button>
                    {!moi ? (
                      <button
                        type="button"
                        className={`bouton bouton--petit ${u.actif ? 'bouton--danger' : 'bouton--discret'}`}
                        onClick={() => void maj(u, { actif: !u.actif }, `${u.nom} ${u.actif ? 'desactive' : 'reactive'}`)}
                      >
                        {u.actif ? 'Desactiver' : 'Reactiver'}
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

    </AppShell>
  );
}
