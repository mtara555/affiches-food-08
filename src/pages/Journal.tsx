import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { LIBELLE_ACTION, LIBELLE_RESSOURCE, lireJournal, type EntreeJournal } from '../lib/journal';
import { messageErreur } from '../lib/firebase';

type Periode = 'jour' | '7j' | '30j' | '90j';
const PERIODES: Readonly<Record<Periode, string>> = {
  jour: "Aujourd'hui",
  '7j': '7 jours',
  '30j': '30 jours',
  '90j': '90 jours',
};

function debut(p: Periode): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const jours = { jour: 0, '7j': 6, '30j': 29, '90j': 89 }[p];
  d.setDate(d.getDate() - jours);
  return d;
}

const dateHeure = (d: Date) =>
  d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });

const evenement = (e: EntreeJournal) =>
  e.ressource === 'session' ? (/^Deconnexion/.test(e.detail) ? 'Deconnexion' : /^Ouverture/.test(e.detail) ? 'Ouverture' : 'Connexion') : `${LIBELLE_RESSOURCE[e.ressource] ?? e.ressource} — ${LIBELLE_ACTION[e.action] ?? e.action}`;

const PAR_PAGE = 50;

export function Journal() {
  const [periode, setPeriode] = useState<Periode>('7j');
  const [lignes, setLignes] = useState<EntreeJournal[]>([]);
  const [filtre, setFiltre] = useState('');
  const [page, setPage] = useState(0);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      setLignes(await lireJournal(debut(periode)));
      setPage(0);
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setChargement(false);
    }
  }, [periode]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const visibles = useMemo(() => {
    const f = filtre.trim().toLowerCase();
    return f ? lignes.filter((l) => `${l.utilisateur} ${l.appareil} ${evenement(l)} ${l.detail}`.toLowerCase().includes(f)) : lignes;
  }, [lignes, filtre]);

  function exporterCsv() {
    const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const contenu = [
      ['Date', 'Utilisateur', 'Appareil', 'Evenement', 'Detail'].join(';'),
      ...visibles.map((e) => [dateHeure(e.date), e.utilisateur, e.appareil, evenement(e), e.detail].map(q).join(';')),
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob(['﻿' + contenu], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `journal_affiches_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const pages = Math.max(1, Math.ceil(visibles.length / PAR_PAGE));

  return (
    <AppShell
      titre="Journal d'activite"
      sousTitre={`${visibles.length} evenement(s) — ${PERIODES[periode].toLowerCase()}`}
      actions={<button type="button" className="bouton bouton--discret" onClick={exporterCsv} disabled={!visibles.length}>Exporter CSV</button>}
    >
      {erreur ? <p className="bandeau bandeau--erreur">{erreur}</p> : null}
      <section className="carte">
        <div className="barre-filtres">
          <div className="segments">
            {(Object.keys(PERIODES) as Periode[]).map((p) => (
              <button key={p} type="button" className={`segments__bouton${periode === p ? ' est-actif' : ''}`} onClick={() => setPeriode(p)}>
                {PERIODES[p]}
              </button>
            ))}
          </div>
          <input type="search" className="recherche" placeholder="Filtrer (utilisateur, campagne, code…)" value={filtre} onChange={(e) => { setFiltre(e.target.value); setPage(0); }} />
        </div>
        {chargement ? (
          <p className="carte__texte carte__texte--discret">Chargement…</p>
        ) : visibles.length === 0 ? (
          <p className="carte__texte carte__texte--discret">Aucun evenement.</p>
        ) : (
          <table className="tableau">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Utilisateur</th>
                <th scope="col">Evenement</th>
                <th scope="col">Detail</th>
                <th scope="col">Appareil</th>
              </tr>
            </thead>
            <tbody>
              {visibles.slice(page * PAR_PAGE, (page + 1) * PAR_PAGE).map((e) => (
                <tr key={e.id}>
                  <th scope="row" style={{ whiteSpace: 'nowrap', fontWeight: 400 }}>{dateHeure(e.date)}</th>
                  <td>{e.utilisateur}</td>
                  <td>{evenement(e)}</td>
                  <td>{e.detail}</td>
                  <td className="carte__texte--discret">{e.appareil}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {pages > 1 ? (
          <div className="pagination">
            <button type="button" className="bouton bouton--discret bouton--petit" disabled={page === 0} onClick={() => setPage(page - 1)}>‹ Precedent</button>
            <span className="pagination__position">{page + 1} / {pages}</span>
            <button type="button" className="bouton bouton--discret bouton--petit" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Suivant ›</button>
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}
