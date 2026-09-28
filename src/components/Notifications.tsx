/**
 * Notifications ephemeres (« Ajoute a la campagne », « PDF genere »…).
 * notifier() peut etre appele de n'importe ou, sans contexte React.
 */

import { useEffect, useState } from 'react';
import './Notifications.css';

export type GenreNotification = 'succes' | 'erreur' | 'info';

interface Notification {
  readonly id: number;
  readonly texte: string;
  readonly genre: GenreNotification;
}

type Ecouteur = (n: Notification) => void;
const ecouteurs = new Set<Ecouteur>();
let compteur = 0;

export function notifier(texte: string, genre: GenreNotification = 'succes'): void {
  const n = { id: ++compteur, texte, genre };
  ecouteurs.forEach((e) => e(n));
}

export function Notifications() {
  const [liste, setListe] = useState<Notification[]>([]);

  useEffect(() => {
    const ecouteur: Ecouteur = (n) => {
      setListe((l) => [...l.slice(-3), n]);
      window.setTimeout(() => setListe((l) => l.filter((x) => x.id !== n.id)), n.genre === 'erreur' ? 6000 : 3200);
    };
    ecouteurs.add(ecouteur);
    return () => {
      ecouteurs.delete(ecouteur);
    };
  }, []);

  return (
    <div className="notifications" role="status" aria-live="polite">
      {liste.map((n) => (
        <div key={n.id} className={`notification notification--${n.genre}`}>
          {n.texte}
        </div>
      ))}
    </div>
  );
}
